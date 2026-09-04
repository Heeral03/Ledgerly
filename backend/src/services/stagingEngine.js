const crypto = require('crypto');
const db = require('../db/database');
const { validateAccountingBatch } = require('./accountingValidator');
const { logAuditEvent } = require('../utils/auditLogger');

/**
 * Computes an Idempotency Key (SHA-256 hash of file content + workspaceId).
 */
function computeIdempotencyKey(fileBuffer, workspaceId) {
  const hash = crypto.createHash('sha256');
  hash.update(fileBuffer);
  hash.update(String(workspaceId));
  return hash.digest('hex');
}

/**
 * Stage an incoming spreadsheet batch into the staging area.
 */
function stageImportBatch(workspaceId, filename, fileBuffer, rows, userId) {
  const fileHash = computeIdempotencyKey(fileBuffer, workspaceId);

  // Check Idempotency: Reject duplicate financial cycle imports
  const existingBatch = db.prepare(`
    SELECT * FROM import_batches WHERE workspace_id = ? AND file_hash = ? AND status = 'COMMITTED'
  `).get(workspaceId, fileHash);

  if (existingBatch) {
    return {
      isDuplicate: true,
      status: 'IDEMPOTENT_ALREADY_COMMITTED',
      message: 'This financial file has already been ingested and committed for this workspace.',
      batchId: existingBatch.id,
    };
  }

  // Run Accounting Rule Validator
  const historicalRows = db.prepare(`
    SELECT * FROM ledger_records WHERE workspace_id = ? ORDER BY created_at DESC LIMIT 100
  `).all(workspaceId);

  const validationResult = validateAccountingBatch(rows, historicalRows);

  const status = validationResult.isValid ? 'STAGED' : 'VALIDATION_FAILED';

  // Atomic insertion into import_batches & staging_rows
  const insertBatch = db.prepare(`
    INSERT INTO import_batches (workspace_id, filename, file_hash, status, ingested_by, row_count, validation_notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const insertStagingRow = db.prepare(`
    INSERT INTO staging_rows (batch_id, row_index, raw_data_json, status)
    VALUES (?, ?, ?, ?)
  `);

  let batchId = null;

  const stageTx = db.transaction(() => {
    const res = insertBatch.run(
      workspaceId,
      filename,
      fileHash,
      status,
      userId,
      rows.length,
      JSON.stringify(validationResult)
    );
    batchId = res.lastInsertRowid;

    rows.forEach((row, idx) => {
      insertStagingRow.run(batchId, idx, JSON.stringify(row), status);
    });

    logAuditEvent({
      workspaceId,
      actorUserId: userId,
      eventType: 'IMPORT_BATCH_STAGED',
      resourceType: 'IMPORT_BATCH',
      resourceId: batchId,
      metadata: { filename, rowCount: rows.length, status, validationResult },
    });
  });

  stageTx();

  return {
    isDuplicate: false,
    batchId,
    status,
    validationResult,
  };
}

/**
 * Commits a validated staged batch into the main relational Ledger.
 */
function commitStagedBatch(batchId, workspaceId, userId) {
  const batch = db.prepare(`
    SELECT * FROM import_batches WHERE id = ? AND workspace_id = ?
  `).get(batchId, workspaceId);

  if (!batch) {
    throw new Error('Import batch not found.');
  }

  if (batch.status === 'COMMITTED') {
    return { success: true, message: 'Batch is already committed.' };
  }

  const stagingRows = db.prepare(`
    SELECT * FROM staging_rows WHERE batch_id = ?
  `).all(batchId);

  const insertLedgerRecord = db.prepare(`
    INSERT INTO ledger_records (
      workspace_id, batch_id, period, category, revenue, expenses, net_profit, debit, credit, row_data_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const updateBatch = db.prepare(`
    UPDATE import_batches SET status = 'COMMITTED', updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `);

  const updateStaging = db.prepare(`
    UPDATE staging_rows SET status = 'COMMITTED' WHERE batch_id = ?
  `);

  let committedCount = 0;

  const commitTx = db.transaction(() => {
    stagingRows.forEach((staged) => {
      const row = JSON.parse(staged.raw_data_json);
      const rev = parseFloat(row['Sales & Revenue']) || 0;
      const exp = (parseFloat(row['Direct Expense']) || 0) + 
                  (parseFloat(row['Salary / Wages']) || 0) + 
                  (parseFloat(row['Other Expense']) || 0) + 
                  (parseFloat(row['R&D Expense']) || 0) + 
                  (parseFloat(row['Capex Investment']) || 0);
      const net = rev - exp;
      const period = row['Month'] || row['Period'] || '2026-01';
      const category = row['Category'] || 'General';

      insertLedgerRecord.run(
        workspaceId,
        batchId,
        period,
        category,
        rev,
        exp,
        net,
        exp,
        rev,
        JSON.stringify(row)
      );
      committedCount++;
    });

    updateBatch.run(batchId);
    updateStaging.run(batchId);

    // Transaction-Bound Audit Log Outbox
    logAuditEvent({
      workspaceId,
      actorUserId: userId,
      eventType: 'IMPORT_BATCH_COMMITTED',
      resourceType: 'IMPORT_BATCH',
      resourceId: batchId,
      metadata: { committedCount, status: 'COMMITTED' },
    });
  });

  commitTx();

  return {
    success: true,
    batchId,
    committedCount,
    status: 'COMMITTED',
  };
}

module.exports = {
  computeIdempotencyKey,
  stageImportBatch,
  commitStagedBatch,
};
