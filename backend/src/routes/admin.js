const express = require('express');
const db = require('../db/database');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { decrypt } = require('../utils/crypto');
const { formatRowLabel } = require('../utils/formatters');
const { getGoogleSheetsExportUrl, isValidGoogleSheetsUrl } = require('../utils/googleSheets');

const router = express.Router();

// All admin routes require a valid JWT + admin role
router.use(authenticate, requireRole('admin'));

/**
 * GET /api/admin/users
 * Returns all users with their status and upload count.
 */
router.get('/users', (req, res) => {
  const users = db.prepare(`
    SELECT u.id, u.email, u.name, u.picture, u.role, u.status, u.created_at,
           COUNT(DISTINCT up.id) AS upload_count
    FROM users u
    LEFT JOIN uploads up ON up.user_id = u.id
    GROUP BY u.id
    ORDER BY u.created_at DESC
  `).all();
  res.json(users);
});

/**
 * POST /api/admin/whitelist
 * Body: { email }
 * Adds a Google email to the whitelist so that user can sign in.
 */
router.post('/whitelist', (req, res) => {
  const { email, permission = 'view' } = req.body;
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email required' });
  }
  try {
    db.prepare('INSERT OR IGNORE INTO whitelist (email, added_by, permission) VALUES (?, ?, ?)').run(
      email.toLowerCase().trim(),
      req.user.id,
      permission
    );
    res.json({ message: `${email} added to whitelist with '${permission}' access.` });
  } catch (err) {
    res.status(400).json({ error: 'Email already whitelisted or invalid data' });
  }
});

/**
 * DELETE /api/admin/whitelist/:email
 * Remove an email from the whitelist (also blocks re-login if not yet used)
 */
router.delete('/whitelist/:email', (req, res) => {
  db.prepare('DELETE FROM whitelist WHERE email = ? COLLATE NOCASE').run(req.params.email);
  res.json({ message: 'Email removed from whitelist' });
});

/**
 * GET /api/admin/whitelist
 * List all whitelisted emails and their status.
 */
router.get('/whitelist', (req, res) => {
  const list = db.prepare('SELECT * FROM whitelist ORDER BY created_at DESC').all();
  res.json(list);
});

/**
 * GET /api/admin/users/:userId/data
 * View any user's decrypted uploaded data (admin only).
 */
router.get('/users/:userId/data', (req, res) => {
  const userId = parseInt(req.params.userId);
  const rows = db.prepare(
    'SELECT * FROM uploads WHERE user_id = ? ORDER BY row_index ASC'
  ).all(userId);

  const decrypted = rows.map(row => {
    const encryptedCells = JSON.parse(row.row_data);
    const cells = {};
    for (const [col, encVal] of Object.entries(encryptedCells)) {
      cells[col] = decrypt(encVal);
    }
    return { id: row.id, row_index: row.row_index, filename: row.filename, cells, uploaded_at: row.uploaded_at };
  });

  res.json(decrypted);
});

/**
 * GET /api/admin/users/:userId/charts
 * Returns aggregated chart data for any user.
 */
router.get('/users/:userId/charts', (req, res) => {
  const userId = parseInt(req.params.userId);
  const rows = db.prepare(
    'SELECT row_data, row_index FROM uploads WHERE user_id = ? ORDER BY row_index ASC'
  ).all(userId);

  if (!rows.length) return res.json({ columns: [], rows: [] });

  const decryptedRows = rows.map(row => {
    const enc = JSON.parse(row.row_data);
    const cells = {};
    for (const [col, val] of Object.entries(enc)) cells[col] = decrypt(val);
    cells._label = formatRowLabel(cells.Month, cells.Year);
    return cells;
  });

  const columns = Object.keys(decryptedRows[0] || {});
  res.json({ columns, rows: decryptedRows, labelCol: '_label' });
});

/**
 * POST /api/admin/grant
 * Body: { granteeId, targetId }
 * Allow granteeId (a user) to view targetId's data.
 */
router.post('/grant', (req, res) => {
  const { granteeId, targetId } = req.body;
  if (!granteeId || !targetId) return res.status(400).json({ error: 'granteeId and targetId required' });
  try {
    db.prepare(
      'INSERT OR IGNORE INTO access_grants (grantor_id, grantee_id, target_id) VALUES (?, ?, ?)'
    ).run(req.user.id, granteeId, targetId);
    res.json({ message: 'Access granted' });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/admin/grant
 * Body: { granteeId, targetId }
 */
router.delete('/grant', (req, res) => {
  const { granteeId, targetId } = req.body;
  db.prepare('DELETE FROM access_grants WHERE grantee_id = ? AND target_id = ?').run(granteeId, targetId);
  res.json({ message: 'Access revoked' });
});

/**
 * POST /api/admin/users/:userId/upload
 * Admin uploads a file on behalf of a user.
 */
router.post('/users/:userId/upload', require('../middleware/upload').single('file'), (req, res) => {
  const userId = parseInt(req.params.userId);
  const { encrypt } = require('../utils/crypto');
  const xlsx = require('xlsx');

  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  try {
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = xlsx.utils.sheet_to_json(sheet);

    const insert = db.prepare(
      'INSERT INTO uploads (user_id, filename, row_index, row_data) VALUES (?, ?, ?, ?)'
    );

    const transaction = db.transaction((rows) => {
      rows.forEach((row, idx) => {
        const encryptedRow = {};
        for (const [col, val] of Object.entries(row)) {
          // Sanitise input (CSV injection check)
          const cleanVal = String(val).startsWith('=') ? `'${val}` : val;
          encryptedRow[col] = encrypt(String(cleanVal));
        }
        insert.run(userId, req.file.originalname, idx, JSON.stringify(encryptedRow));
      });
    });

    transaction(data);
    res.json({ message: 'Data uploaded successfully by Admin', rows: data.length });
  } catch (err) {
    res.status(500).json({ error: 'Failed to process spreadsheet' });
  }
});

/**
 * Map variations of headers to internal standards
 */
const normalizeHeaders = (row) => {
  const cleaned = {};
  const mapping = {
    'Company': ['company'],
    'Month': ['month'],
    'Year': ['year'],
    'Sales & Revenue': ['sales', 'revenue', 'income'],
    'Capex Investment': ['capax', 'capex', 'capital'],
    'R&D Expense': ['r&d', 'r & d', 'r& d', 'r& d exp', 'r & d exp', 'research', 'r& d exp.'],
    'Direct Expense': ['direct exp', 'direct', 'direct exp.'],
    'Salary / Wages': ['salary', 'wages', 'salary / wages exp.'],
    'Other Expense': ['other exp', 'other', 'other exp.'],
    'Profit & Loss': ['profit', 'loss', 'loass', 'p&l', 'p & l'],
    'Receivable': ['receivable', 'receivable '],
    'Payable': ['payable', 'payable '],
    'Bank & Cash': ['bank & cash', 'bank', 'cash fund', 'cash', 'bank & cash fund', 'bank & cash fund '],
    'Unsecured Loan': ['unsecure', 'unsecured', 'unsecure loan', 'unsecured loan'],
    'Bank Loan': ['bank loan', 'loan from bank'],
  };

  const cleanNumber = (val) => {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    let str = String(val).trim();
    const isNegative = str.startsWith('(') && str.endsWith(')');
    if (isNegative) str = str.slice(1, -1);
    const cleanedNum = str.replace(/[,₹\s]/g, '');
    let num = parseFloat(cleanedNum) || 0;
    return isNegative ? -num : num;
  };

  const keys = Object.keys(row);
  Object.entries(mapping).forEach(([standard, variants]) => {
    const foundKey = keys.find(k => {
      const cleanK = k.toLowerCase().trim();
      return variants.some(v => cleanK === v.toLowerCase() || cleanK.includes(v.toLowerCase()));
    });
    if (foundKey !== undefined) {
      const val = row[foundKey];
      cleaned[standard] = standard !== 'Month' && standard !== 'Year' && standard !== 'Company'
        ? cleanNumber(val)
        : val;
    }
  });
  Object.keys(mapping).forEach(std => {
    if (cleaned[std] === undefined && row[std] !== undefined) cleaned[std] = row[std];
  });
  return cleaned;
};

/**
 * POST /api/admin/global-sync-sheets
 * Admin syncs MASTER data from a published Google Sheet CSV URL.
 */
router.post('/global-sync-sheets', async (req, res, next) => {
  try {
    const { spreadsheetUrl: rawUrl } = req.body;
    if (!rawUrl) return res.status(400).json({ error: 'Spreadsheet URL required' });

    const axios = require('axios');
    const xlsx = require('xlsx');
    const { encrypt } = require('../utils/crypto');

    const spreadsheetUrl = getGoogleSheetsExportUrl(rawUrl);
    if (!isValidGoogleSheetsUrl(spreadsheetUrl)) {
      return res.status(400).json({ error: 'Invalid Google Sheets URL. Please check the link and try again.' });
    }

    const response = await axios.get(spreadsheetUrl, { 
      responseType: 'arraybuffer',
      timeout: 15000 // Add timeout for network robustness
    });
    const workbook = xlsx.read(response.data, { type: 'buffer' });

    const allSheetData = [];
    workbook.SheetNames.forEach(sheetName => {
      const sheet = workbook.Sheets[sheetName];
      const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });
      if (!rows.length) return;

      let headerRowIndex = -1;
      for (let i = 0; i < Math.min(rows.length, 10); i++) {
        const row = rows[i];
        if (row.some(cell => {
          const c = String(cell).toLowerCase();
          return c.includes('month') || c.includes('company');
        })) {
          headerRowIndex = i;
          break;
        }
      }

      if (headerRowIndex !== -1) {
        const rawHeaders = rows[headerRowIndex];
        const rawDataRows = rows.slice(headerRowIndex + 1);
        const data = rawDataRows.map(rawRow => {
          const rowObj = {};
          rawHeaders.forEach((header, colIdx) => { if (header) rowObj[header] = rawRow[colIdx]; });
          return normalizeHeaders(rowObj);
        }).filter(r => r.Company || r.Month || r['Sales & Revenue']);
        
        allSheetData.push({ sheetName, data });
      }
    });

    if (allSheetData.length === 0) return res.status(400).json({ error: 'No valid data found in any sheet.' });

    const dbTransaction = db.transaction(() => {
      const history = db.prepare('INSERT INTO global_upload_history (filename, uploaded_by) VALUES (?, ?)')
        .run('Google Sheets Sync (Global)', req.user.id);
      const batchId = history.lastInsertRowid;

      const allCompanies = new Set();
      const insertRow = db.prepare(
        'INSERT INTO global_uploads (batch_id, company_name, filename, row_index, row_data) VALUES (?, ?, ?, ?, ?)'
      );

      let totalRows = 0;
      allSheetData.forEach(sheetResult => {
        sheetResult.data.forEach((row, idx) => {
          const encryptedRow = {};
          for (const [col, val] of Object.entries(row)) {
            const cleanVal = String(val).startsWith('=') ? `'${val}` : val;
            encryptedRow[col] = encrypt(String(cleanVal));
          }
          const rowCompany = row.Company || sheetResult.sheetName;
          allCompanies.add(rowCompany);
          insertRow.run(batchId, rowCompany, 'Google Sheets Sync', totalRows + idx, JSON.stringify(encryptedRow));
        });
        totalRows += sheetResult.data.length;
      });

      const companies = Array.from(allCompanies);
      db.prepare('UPDATE global_upload_history SET metadata = ? WHERE id = ?')
        .run(JSON.stringify({ companies }), batchId);

      return { batchId, rows: totalRows, companies };
    });

    const result = dbTransaction();
    res.json({
      message: `Global CEO Dashboard synced. Processed ${result.companies.length} companies, ${result.rows} rows.`,
      batchId: result.batchId
    });
  } catch (err) {
    console.error('Global Sync Error:', err);
    res.status(500).json({ error: 'Failed to sync Google Sheet: ' + err.message });
  }
});

/**
 * POST /api/admin/global-upload
 * Admin uploads a MASTER file for the CEO Dashboard (shared by all users).
 * Now supports MULTIPLE sheets (one per company).
 */
router.post('/global-upload', require('../middleware/upload').single('file'), (req, res) => {
  const { encrypt } = require('../utils/crypto');
  const xlsx = require('xlsx');

  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  try {
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetNames = workbook.SheetNames;

    const dbTransaction = db.transaction(() => {
      const history = db.prepare('INSERT INTO global_upload_history (filename, uploaded_by) VALUES (?, ?)')
        .run(req.file.originalname, req.user.id);
      const batchId = history.lastInsertRowid;

      let totalRows = 0;
      const companies = [];

      for (const sheetName of sheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });
        if (!rows.length) continue;

        let headerRowIndex = -1;
        for (let i = 0; i < Math.min(rows.length, 10); i++) {
          const row = rows[i];
          if (row.some(cell => {
            const c = String(cell).toLowerCase();
            return c.includes('month') || c.includes('company');
          })) {
            headerRowIndex = i;
            break;
          }
        }
        if (headerRowIndex === -1) continue;

        const rawHeaders = rows[headerRowIndex];
        const rawDataRows = rows.slice(headerRowIndex + 1);

        const data = rawDataRows.map(rawRow => {
          const rowObj = {};
          rawHeaders.forEach((header, colIdx) => { if (header) rowObj[header] = rawRow[colIdx]; });
          return normalizeHeaders(rowObj);
        }).filter(r => r.Company || r.Month || r['Sales & Revenue']);

        companies.push(sheetName);
        totalRows += data.length;

        const insertRow = db.prepare(
          'INSERT INTO global_uploads (batch_id, company_name, filename, row_index, row_data) VALUES (?, ?, ?, ?, ?)'
        );

        data.forEach((row, idx) => {
          const encryptedRow = {};
          for (const [col, val] of Object.entries(row)) {
            const cleanVal = String(val).startsWith('=') ? `'${val}` : val;
            encryptedRow[col] = encrypt(String(cleanVal));
          }
          insertRow.run(batchId, sheetName, req.file.originalname, idx, JSON.stringify(encryptedRow));
        });
      }
      db.prepare('UPDATE global_upload_history SET metadata = ? WHERE id = ?')
        .run(JSON.stringify({ companies }), batchId);
      return { batchId, totalRows, companies };
    });

    const result = dbTransaction();
    res.json({
      message: `CEO Dashboard Updated. Processed ${result.companies.length} companies, ${result.totalRows} rows.`,
      batchId: result.batchId
    });
  } catch (err) {
    console.error('Global upload error:', err);
    res.status(500).json({ error: 'Failed to process CEO spreadsheet: ' + err.message });
  }
});

/**
 * GET /api/admin/global-history
 * Returns history of master uploads.
 */
router.get('/global-history', (req, res) => {
  const history = db.prepare(`
    SELECT h.*, u.name as uploader_name 
    FROM global_upload_history h
    JOIN users u ON h.uploaded_by = u.id
    ORDER BY h.uploaded_at DESC
  `).all();
  res.json(history);
});

module.exports = router;
