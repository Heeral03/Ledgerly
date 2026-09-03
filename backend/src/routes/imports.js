const express = require('express');
const router = express.Router({ mergeParams: true });
const multer = require('multer');
const upload = multer({ dest: '/tmp/uploads/' });
const db = require('../db/database');
const { requireWorkspaceRole } = require('../middleware/rbac');
const { parseSheet } = require('../utils/sheetParser');
const { encryptCell } = require('../utils/crypto');
const { logAuditEvent } = require('../utils/auditLogger');
const crypto = require('crypto');

// 1. Stage and Validate File Upload
router.post('/upload', requireWorkspaceRole('EDITOR'), upload.single('file'), (req, res) => {
  try {
    const { workspaceId } = req.params;
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const importId = `imp_${crypto.randomBytes(8).toString('hex')}`;
    const dataSourceId = `ds_${crypto.randomBytes(8).toString('hex')}`;

    // Ensure Data Source exists or create it
    db.prepare(`
      INSERT OR IGNORE INTO data_sources (id, workspace_id, type, name)
      VALUES (?, ?, 'FILE', ?)
    `).run(dataSourceId, workspaceId, req.file.originalname);

    // Parse spreadsheet rows
    const parsedData = parseSheet(req.file.path);
    const rows = parsedData.rows || [];

    let validCount = 0;
    let rejectedCount = 0;
    let warningCount = 0;

    const insertStaging = db.prepare(`
      INSERT INTO staging_import_rows (import_id, row_index, raw_data_json, validation_errors_json)
      VALUES (?, ?, ?, ?)
    `);

    // Process & Validate Rows into Staging
    db.transaction(() => {
      rows.forEach((row, idx) => {
        const errors = [];
        if (!row.period) errors.push('Missing period date');
        if (!row.category) errors.push('Unmapped or missing category');
        const numVal = parseFloat(row.amount);
        if (isNaN(numVal)) errors.push('Invalid numeric amount');

        if (errors.length === 0) {
          validCount++;
        } else {
          rejectedCount++;
        }

        insertStaging.run(
          importId,
          idx + 1,
          JSON.stringify(row),
          errors.length > 0 ? JSON.stringify(errors) : null
        );
      });

      // Insert Import record
      db.prepare(`
        INSERT INTO imports (id, workspace_id, data_source_id, status, rows_read, rows_valid, rows_rejected, warnings)
        VALUES (?, ?, ?, 'VALIDATING', ?, ?, ?, ?)
      `).run(importId, workspaceId, dataSourceId, rows.length, validCount, rejectedCount, warningCount);
    })();

    logAuditEvent({
      workspaceId,
      actorUserId: req.user ? req.user.id : null,
      eventType: 'IMPORT_STARTED',
      resourceType: 'IMPORT',
      resourceId: importId,
      metadata: { filename: req.file.originalname, rowsRead: rows.length, validCount, rejectedCount },
      requestId: req.traceId || null,
    });

    return res.status(201).json({
      message: 'File staged successfully and validated',
      importId,
      workspaceId,
      status: 'VALIDATING',
      summary: {
        rowsRead: rows.length,
        rowsValid: validCount,
        rowsRejected: rejectedCount,
        warnings: warningCount,
      },
    });
  } catch (err) {
    console.error('Import Upload Error:', err);
    return res.status(500).json({ error: 'Failed to parse and stage upload: ' + err.message });
  }
});

// 2. Transactional Commit (Confirm Import)
router.post('/:importId/confirm', requireWorkspaceRole('EDITOR'), (req, res) => {
  try {
    const { workspaceId, importId } = req.params;

    const importRec = db.prepare('SELECT * FROM imports WHERE id = ? AND workspace_id = ?').get(importId, workspaceId);
    if (!importRec) {
      return res.status(404).json({ error: 'Import record not found' });
    }

    if (importRec.status !== 'VALIDATING') {
      return res.status(400).json({ error: `Import cannot be confirmed. Current status: ${importRec.status}` });
    }

    const stagingRows = db.prepare('SELECT * FROM staging_import_rows WHERE import_id = ?').all(importId);
    if (stagingRows.length === 0) {
      return res.status(400).json({ error: 'No staged rows found for this import' });
    }

    // Atomic Transactional Commit
    db.transaction(() => {
      const insertRecord = db.prepare(`
        INSERT INTO financial_records (workspace_id, import_id, period, category, encrypted_amount, iv, auth_tag)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      for (const sRow of stagingRows) {
        if (sRow.validation_errors_json) continue; // Skip rejected rows

        const data = JSON.parse(sRow.raw_data_json);
        const encrypted = encryptCell(String(data.amount));

        insertRecord.run(
          workspaceId,
          importId,
          data.period || '2026-01',
          data.category || 'General',
          encrypted.encryptedText,
          encrypted.iv,
          encrypted.authTag
        );
      }

      // Update status to READY
      db.prepare("UPDATE imports SET status = 'READY' WHERE id = ?").run(importId);

      // Clean up staging table
      db.prepare('DELETE FROM staging_import_rows WHERE import_id = ?').run(importId);
    })();

    logAuditEvent({
      workspaceId,
      actorUserId: req.user ? req.user.id : null,
      eventType: 'IMPORT_COMPLETED',
      resourceType: 'IMPORT',
      resourceId: importId,
      metadata: { rowsCommitted: importRec.rows_valid },
      requestId: req.traceId || null,
    });

    return res.status(200).json({
      message: 'Import committed transactionally to workspace financial records',
      importId,
      status: 'READY',
      rowsCommitted: importRec.rows_valid,
    });
  } catch (err) {
    console.error('Import Confirm Error:', err);
    // Mark import as FAILED on error
    db.prepare("UPDATE imports SET status = 'FAILED' WHERE id = ?").run(req.params.importId);
    return res.status(500).json({ error: 'Transaction failed during import commit: ' + err.message });
  }
});

module.exports = router;
