const express = require('express');
const XLSX = require('xlsx');
const path = require('path');
const db = require('../db/database');
const { authenticate } = require('../middleware/auth');
const { encrypt, decrypt } = require('../utils/crypto');
const { formatRowLabel } = require('../utils/formatters');
const { getGoogleSheetsExportUrl } = require('../utils/googleSheets');
const upload = require('../middleware/upload');

const router = express.Router();

// All user routes require a valid JWT
router.use(authenticate);

/**
 * Helper to process and store rows for a user.
 */
function processAndStoreRows(userId, filename, jsonRows, append = false) {
  if (!jsonRows.length) return 0;

  const sanitise = (val) => String(val).replace(/^[=+\-@]/, "'$&");

  if (!append) {
    db.prepare('DELETE FROM uploads WHERE user_id = ?').run(userId);
  }

  const insert = db.prepare(
    'INSERT INTO uploads (user_id, filename, row_index, row_data) VALUES (?, ?, ?, ?)'
  );

  // Get current max index for appending
  let startIndex = 0;
  if (append) {
    const last = db.prepare('SELECT MAX(row_index) as maxIdx FROM uploads WHERE user_id = ?').get(userId);
    startIndex = (last?.maxIdx || 0) + 1;
  }

  const insertMany = db.transaction((rows) => {
    rows.forEach((row, i) => {
      const encryptedRow = {};
      for (const [col, val] of Object.entries(row)) {
        encryptedRow[col] = encrypt(sanitise(val));
      }
      insert.run(userId, filename, startIndex + i, JSON.stringify(encryptedRow));
    });
  });

  insertMany(jsonRows);
  return jsonRows.length;
}

/**
 * POST /api/user/upload
 * Accepts multipart form-data with field "file".
 * Parses sheet → sanitises cells → encrypts each cell → stores rows.
 */
router.post('/upload', upload.single('file'), (req, res, next) => {
  try {
    if (req.user.permission !== 'upload') {
      return res.status(403).json({ error: 'Permission denied. You only have View access.' });
    }

    if (!req.file) return res.status(400).json({ error: 'No file provided' });

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const jsonRows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    const count = processAndStoreRows(req.user.id, req.file.originalname, jsonRows);

    res.json({
      message: 'File uploaded and encrypted successfully',
      rows: count,
      columns: Object.keys(jsonRows[0] || {}),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/user/sync-google-sheet
 * Fetches data from a published Google Sheet CSV URL.
 */
router.post('/sync-google-sheet', async (req, res, next) => {
  try {
    if (req.user.permission !== 'upload') {
      return res.status(403).json({ error: 'Permission denied. You only have View access.' });
    }

    const { spreadsheetUrl: rawUrl } = req.body;
    if (!rawUrl) return res.status(400).json({ error: 'Spreadsheet URL required' });

    // Convert to export URL
    const spreadsheetUrl = getGoogleSheetsExportUrl(rawUrl);

    if (!isValidGoogleSheetsUrl(spreadsheetUrl)) {
      return res.status(400).json({ error: 'Invalid Google Sheets URL. Please check the link and try again.' });
    }

    const axios = require('axios');
    const response = await axios.get(spreadsheetUrl, { 
      responseType: 'arraybuffer',
      timeout: 15000 
    });
    const workbook = XLSX.read(response.data, { type: 'buffer' });

    let totalRowsCount = 0;
    const allColumns = new Set();
    
    // Clear old data once before multi-tab sync
    db.prepare('DELETE FROM uploads WHERE user_id = ?').run(req.user.id);

    workbook.SheetNames.forEach(sheetName => {
      const sheet = workbook.Sheets[sheetName];
      const jsonRows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      if (jsonRows.length > 0) {
        const count = processAndStoreRows(req.user.id, `Google Sheets Sync (${sheetName})`, jsonRows, true); // Pass true to append
        totalRowsCount += count;
        Object.keys(jsonRows[0]).forEach(c => allColumns.add(c));
      }
    });

    if (totalRowsCount === 0) return res.status(400).json({ error: 'No data found in any sheet.' });

    res.json({
      message: 'Google Sheets synced and encrypted successfully from all tabs',
      rows: totalRowsCount,
      columns: Array.from(allColumns),
    });
  } catch (err) {
    console.error('Google Sync Error:', err.message);
    res.status(500).json({ error: 'Failed to fetch or parse Google Sheet. Ensure it is shared correctly.' });
  }
});

/**
 * GET /api/user/data
 * Returns the authenticated user's own decrypted data rows.
 */
router.get('/data', (req, res) => {
  const rows = db.prepare(
    'SELECT * FROM uploads WHERE user_id = ? ORDER BY row_index ASC'
  ).all(req.user.id);

  if (!rows.length) return res.json([]);

  const decrypted = rows.map(row => {
    const enc = JSON.parse(row.row_data);
    const cells = {};
    for (const [col, val] of Object.entries(enc)) cells[col] = decrypt(val);
    return { row_index: row.row_index, filename: row.filename, cells, uploaded_at: row.uploaded_at };
  });

  res.json(decrypted);
});

/**
 * GET /api/user/charts
 * Returns chart-ready JSON: { columns, rows, numericCols }
 * Frontend renders Recharts from this.
 */
router.get('/charts', (req, res) => {
  const rows = db.prepare(
    'SELECT row_data FROM uploads WHERE user_id = ? ORDER BY row_index ASC'
  ).all(req.user.id);

  if (!rows.length) return res.json({ columns: [], rows: [], numericCols: [] });

  const decryptedRows = rows.map(row => {
    const enc = JSON.parse(row.row_data);
    const cells = {};
    for (const [col, val] of Object.entries(enc)) cells[col] = decrypt(val);
    return cells;
  });

  const columns = Object.keys(decryptedRows[0] || {});

  // Detect numeric columns for charting
  const numericCols = columns.filter(col =>
    decryptedRows.some(r => r[col] !== '' && !isNaN(Number(r[col])))
  );

  // Label column: first non-numeric column
  const labelCol = columns.find(col =>
    ['month', 'year', 'period'].includes(col.toLowerCase())
  ) || columns.find(col => !numericCols.includes(col));

  res.json({ columns, rows: decryptedRows, numericCols, labelCol });
});

/**
 * GET /api/user/ceo-charts
 * Returns chart-ready JSON for the CEO Dashboard.
 * Optionally filtered by ?company=Name
 */
router.get('/ceo-charts', (req, res) => {
  const { company, batchId } = req.query;
  
  let rows;
  let defaultCompany = company;

  if (!defaultCompany) {
    const batchToUse = batchId || db.prepare('SELECT MAX(id) as id FROM global_upload_history').get()?.id;
    if (batchToUse) {
      const dbCompany = db.prepare('SELECT company_name FROM global_uploads WHERE batch_id = ? LIMIT 1').get(batchToUse);
      if (dbCompany) defaultCompany = dbCompany.company_name;
    }
  }

  if (batchId) {
    if (defaultCompany) {
      rows = db.prepare(
        'SELECT row_data FROM global_uploads WHERE batch_id = ? AND company_name = ? ORDER BY row_index ASC'
      ).all(batchId, defaultCompany);
    } else {
      // Empty
      rows = [];
    }
  } else {
    if (defaultCompany) {
      rows = db.prepare(
        'SELECT row_data FROM global_uploads WHERE company_name = ? ORDER BY row_index ASC'
      ).all(defaultCompany);
    } else {
      rows = [];
    }
  }

  if (!rows.length) return res.json({ columns: [], rows: [], numericCols: [] });

  const decryptedRows = rows.map(row => {
    const enc = JSON.parse(row.row_data);
    const cells = {};
    for (const [col, val] of Object.entries(enc)) {
      const trimmedCol = col.trim();
      cells[trimmedCol] = decrypt(val);
    }
    // Add formatted label for charts
    cells._label = formatRowLabel(cells.Month, cells.Year);
    return cells;
  });

  const columns = Object.keys(decryptedRows[0] || {});
  const numericCols = columns.filter(col =>
    decryptedRows.some(r => r[col] !== '' && !isNaN(Number(r[col])))
  );
  const labelCol = '_label'; // Use our unified label column

  // Get list of available companies for the selector
  const batchToUse = batchId || db.prepare('SELECT MAX(id) as id FROM global_upload_history').get().id;
  const companies = db.prepare('SELECT DISTINCT company_name FROM global_uploads WHERE batch_id = ?').all(batchToUse).map(c => c.company_name);

  res.json({ columns, rows: decryptedRows, numericCols, labelCol, availableCompanies: companies, selectedBatchId: batchToUse });
});

/**
 * GET /api/user/ceo-analysis
 * Returns the AI analysis for a specific company in the latest batch.
 */
router.get('/ceo-analysis', (req, res) => {
  const { company, batchId } = req.query;
  if (!company) return res.status(400).json({ error: 'Company name required' });

  const queryBatch = batchId ? '?' : '(SELECT MAX(id) FROM global_upload_history)';
  const params = batchId ? [company, batchId] : [company];

  const analysis = db.prepare(`
    SELECT analysis_text 
    FROM ai_analyses 
    WHERE company_name = ? 
    AND batch_id = ${queryBatch}
  `).get(...params);

  res.json({ analysis: analysis?.analysis_text || "" });
});

/**
 * GET /api/user/portfolio
 * Aggregates the LATEST month data for each company in a specific batch.
 */
router.get('/portfolio', (req, res) => {
  const { batchId } = req.query;
  const batchToUse = batchId || db.prepare('SELECT MAX(id) as id FROM global_upload_history').get()?.id;

  if (!batchToUse) return res.json({ portfolio: [] });

  const rawRows = db.prepare('SELECT company_name, row_data FROM global_uploads WHERE batch_id = ? ORDER BY row_index ASC').all(batchToUse);
  
  // Group by company
  const companyData = {};
  rawRows.forEach(r => {
    if (!companyData[r.company_name]) companyData[r.company_name] = [];
    const enc = JSON.parse(r.row_data);
    const cells = {};
    for (const [col, val] of Object.entries(enc)) cells[col.trim()] = decrypt(val);
    companyData[r.company_name].push(cells);
  });

  // Extract the latest month for each company
  const portfolio = Object.keys(companyData).map(companyName => {
    const rows = companyData[companyName];
    const latest = rows[rows.length - 1] || {};
    
    const rev = parseFloat(latest['Sales & Revenue']) || 0;
    const pl = parseFloat(latest['Profit & Loss']) || 0;
    const cash = parseFloat(latest['Bank & Cash']) || 0;
    const expense = (parseFloat(latest['Direct Expense']) || 0) + (parseFloat(latest['Salary / Wages']) || 0) + (parseFloat(latest['Other Expense']) || 0) + (parseFloat(latest['R&D Expense']) || 0) + (parseFloat(latest['Capex Investment']) || 0);

    return {
      companyName,
      revenue: rev,
      pl: pl,
      cash: cash,
      expense: expense,
      month: latest['Month'] || '-',
      year: latest['Year'] || '-'
    };
  });

  res.json({ portfolio, selectedBatchId: batchToUse });
});

/**
 * POST /api/user/generate-analysis
 * On-demand generation of the AI Briefing for a specific company inside a batch.
 */
router.post('/generate-analysis', async (req, res, next) => {
  const { company, batchId } = req.body;
  if (!company) return res.status(400).json({ error: 'Company required' });

  const aiService = require('../services/ai');
  const batchToUse = batchId || db.prepare('SELECT MAX(id) as id FROM global_upload_history').get()?.id;

  try {
    const rawRows = db.prepare(
      'SELECT row_data FROM global_uploads WHERE batch_id = ? AND company_name = ? ORDER BY row_index ASC'
    ).all(batchToUse, company);

    if (!rawRows.length) return res.status(400).json({ error: 'No data found' });

    const summary = rawRows.map(row => {
      const enc = JSON.parse(row.row_data);
      const cells = {};
      for (const [col, val] of Object.entries(enc)) cells[col.trim()] = decrypt(val);
      const capex   = Number(cells['Capex Investment']) || 0;
      const rnd     = Number(cells['R&D Expense']) || 0;
      const direct  = Number(cells['Direct Expense']) || 0;
      const salary  = Number(cells['Salary / Wages']) || 0;
      const other   = Number(cells['Other Expense']) || 0;
      return {
        Month:           cells['Month'],
        Year:            cells['Year'],
        Revenue:         Number(cells['Sales & Revenue']) || 0,
        ProfitLoss:      Number(cells['Profit & Loss']) || 0,
        TotalExpenses:   capex + rnd + direct + salary + other,
        CapexInvestment: capex,
        RnDExpense:      rnd,
        DirectExpense:   direct,
        SalaryWages:     salary,
        OtherExpense:    other,
        BankCash:        Number(cells['Bank & Cash']) || 0,
        Receivables:     Number(cells['Receivable']) || 0,
        Payables:        Number(cells['Payable']) || 0,
        UnsecuredLoan:   Number(cells['Unsecured Loan']) || 0,
        BankLoan:        Number(cells['Bank Loan']) || 0,
      };
    });

    const analysis = await aiService.analyzeCompany(company, summary);
    if (!analysis) {
      return res.status(502).json({ error: 'AI service failed to generate analysis. Please check your GROQ_API_KEY and try again.' });
    }
    
    // Save to DB (Update if exists, else insert)
    const existing = db.prepare('SELECT id FROM ai_analyses WHERE batch_id = ? AND company_name = ?').get(batchToUse, company);
    if (existing) {
      db.prepare('UPDATE ai_analyses SET analysis_text = ? WHERE id = ?').run(analysis, existing.id);
    } else {
      db.prepare('INSERT INTO ai_analyses (batch_id, company_name, analysis_text) VALUES (?, ?, ?)')
        .run(batchToUse, company, analysis);
    }

    res.json({ analysis });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/user/chat
 * Interactive financial consultancy.
 */
router.post('/chat', async (req, res, next) => {
  const { message, company, batchId } = req.body;
  const aiService = require('../services/ai');

  try {
    const batchToUse = batchId || db.prepare('SELECT MAX(id) as id FROM global_upload_history').get().id;
    
    // Fetch context data
    const rows = db.prepare(
      'SELECT row_data FROM global_uploads WHERE company_name = ? AND batch_id = ? ORDER BY row_index ASC'
    ).all(company, batchToUse);

    if (!rows.length) {
      return res.json({ reply: "I don't have enough data to answer that right now." });
    }

    const decryptedRows = rows.map(row => {
      const enc = JSON.parse(row.row_data);
      const cells = {};
      for (const [col, val] of Object.entries(enc)) cells[col.trim()] = decrypt(val);
      return {
        Month: cells['Month'],
        Year: cells['Year'],
        Revenue: cells['Sales & Revenue'],
        PL: cells['Profit & Loss'],
        Cash: cells['Bank & Cash'],
        Debt: (Number(cells['Unsecured Loan']) || 0) + (Number(cells['Bank Loan']) || 0)
      };
    });

    const reply = await aiService.chat(message, decryptedRows);
    res.json({ reply });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/user/me
 * Returns the current user's profile.
 */
router.get('/me', (req, res) => {
  const user = db.prepare('SELECT id, email, name, picture, role, status, permission FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

module.exports = router;
