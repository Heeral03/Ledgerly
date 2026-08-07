const express = require('express');
const XLSX = require('xlsx');
const path = require('path');
const db = require('../db/database');
const { authenticate } = require('../middleware/auth');
const { encrypt, decrypt } = require('../utils/crypto');
const { formatRowLabel } = require('../utils/formatters');
const { getGoogleSheetsExportUrl, isValidGoogleSheetsUrl } = require('../utils/googleSheets');
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
    const { spreadsheetUrl: rawUrl, selectedTab, googleAccessToken } = req.body;
    if (!rawUrl) return res.status(400).json({ error: 'Spreadsheet URL required' });

    // Convert to export URL
    const spreadsheetUrl = getGoogleSheetsExportUrl(rawUrl);

    if (!isValidGoogleSheetsUrl(spreadsheetUrl)) {
      return res.status(400).json({ error: 'Invalid Google Sheets URL. Please check the link and try again.' });
    }

    const axios = require('axios');
    const headers = {};
    if (googleAccessToken) {
      headers['Authorization'] = `Bearer ${googleAccessToken}`;
    }

    const response = await axios.get(spreadsheetUrl, { 
      headers,
      responseType: 'arraybuffer',
      timeout: 15000,
      maxRedirects: 5,
    });

    // Check if response is HTML (login page redirect)
    const textSample = Buffer.from(response.data.slice(0, 100)).toString('utf8');
    if (textSample.trim().startsWith('<!DOCTYPE html') || textSample.trim().startsWith('<html')) {
      return res.status(400).json({
        error: 'Google Sheet is not accessible. Please ensure the link is correct and your account has access to it.'
      });
    }

    const workbook = XLSX.read(response.data, { type: 'buffer' });

    let totalRowsCount = 0;
    const allColumns = new Set();
    
    // Clear old data once before sync
    db.prepare('DELETE FROM uploads WHERE user_id = ?').run(req.user.id);

    // Filter to selectedTab if one is specified (not 'all')
    const tabsToSync = (!selectedTab || selectedTab === 'all')
      ? workbook.SheetNames
      : workbook.SheetNames.filter(n => n === selectedTab);

    tabsToSync.forEach(sheetName => {
      const sheet = workbook.Sheets[sheetName];
      const jsonRows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      if (jsonRows.length > 0) {
        const count = processAndStoreRows(req.user.id, `${sheetName}`, jsonRows, true);
        totalRowsCount += count;
        Object.keys(jsonRows[0]).forEach(c => allColumns.add(c));
      }
    });

    if (totalRowsCount === 0) return res.status(400).json({ error: 'No data found in the selected tab.' });

    res.json({
      message: `Synced ${totalRowsCount} rows from ${tabsToSync.join(', ')}`,
      rows: totalRowsCount,
      columns: Array.from(allColumns),
    });
  } catch (err) {
    console.error('Google Sync Error:', err.message);
    res.status(500).json({ error: 'Failed to fetch or parse Google Sheet. Ensure it is shared correctly or reconnect your account.' });
  }
});

/**
 * GET /api/user/auto-kpis
 * Auto-detects 3-5 meaningful KPIs from the user's stored data.
 */
router.get('/auto-kpis', (req, res) => {
  const rows = db.prepare(
    'SELECT row_data FROM uploads WHERE user_id = ? ORDER BY row_index ASC'
  ).all(req.user.id);

  if (!rows.length) return res.json({ kpis: [] });

  const decryptedRows = rows.map(row => {
    const enc = JSON.parse(row.row_data);
    const cells = {};
    for (const [col, val] of Object.entries(enc)) cells[col] = decrypt(val);
    return cells;
  });

  const columns = Object.keys(decryptedRows[0] || {});
  const numericCols = columns.filter(col =>
    decryptedRows.filter(r => r[col] !== '' && !isNaN(Number(r[col]))).length >= Math.ceil(decryptedRows.length * 0.5)
  );

  // Compute stats for each numeric column
  const stats = numericCols.map(col => {
    const vals = decryptedRows.map(r => parseFloat(r[col]) || 0);
    const sum = vals.reduce((a, b) => a + b, 0);
    const latest = vals[vals.length - 1];
    const prev = vals.length > 1 ? vals[vals.length - 2] : latest;
    const trend = prev !== 0 ? ((latest - prev) / Math.abs(prev)) * 100 : 0;
    const avg = sum / vals.length;
    const max = Math.max(...vals);
    // Score: prefer columns with non-zero sum and meaningful variance
    const variance = vals.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / vals.length;
    const score = sum > 0 ? variance / (avg * avg + 1) : 0;
    return { col, latest, trend, sum, avg, max, score };
  });

  // Sort by score descending, pick top 5
  stats.sort((a, b) => b.score - a.score);
  const top = stats.slice(0, 5);

  const kpis = top.map(s => ({
    key: s.col,
    label: s.col,
    value: s.latest,
    trend: Math.round(s.trend * 10) / 10,
    sum: s.sum,
    avg: s.avg,
    unit: 'raw',
  }));

  res.json({ kpis, totalRows: decryptedRows.length, columns: numericCols });
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

    const reply = await aiService.chat(message, decryptedRows, company);
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
