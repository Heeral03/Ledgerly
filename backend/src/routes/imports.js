const express = require('express');
const router = express.Router({ mergeParams: true });
const multer = require('multer');
const { verifyToken } = require('../middleware/auth');
const { requireWorkspaceRole } = require('../middleware/rbac');
const { parseSheetToRows } = require('../utils/sheetParser');
const { stageImportBatch, commitStagedBatch } = require('../services/stagingEngine');
const XLSX = require('xlsx');

const upload = multer({ limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB limit

/**
 * POST /api/workspaces/:workspaceId/imports/stage
 * Step 1: Idempotency Check -> Staging Area -> Accounting Rule Validation
 * Access: EDITOR or OWNER
 */
router.post(
  '/stage',
  verifyToken,
  requireWorkspaceRole('EDITOR'),
  upload.single('file'),
  async (req, res) => {
    try {
      const { workspaceId } = req.params;
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded.' });
      }

      // Parse XLSX / CSV using sheetParser
      const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows = parseSheetToRows(sheet);

      if (!rows || rows.length === 0) {
        return res.status(400).json({ error: 'No valid data rows parsed from spreadsheet.' });
      }

      // Execute Staging Engine Pipeline
      const result = stageImportBatch(
        workspaceId,
        req.file.originalname,
        req.file.buffer,
        rows,
        req.user.id
      );

      if (result.isDuplicate) {
        return res.status(409).json(result); // 409 Conflict for Idempotent Duplicate
      }

      return res.status(201).json(result);
    } catch (err) {
      console.error('Import Staging Error:', err);
      return res.status(500).json({ error: 'Failed to stage import batch.', details: err.message });
    }
  }
);

/**
 * POST /api/workspaces/:workspaceId/imports/:batchId/commit
 * Step 2: Atomic Transactional Commit to Ledger & Transaction-Bound Audit Trail
 * Access: EDITOR or OWNER
 */
router.post(
  '/:batchId/commit',
  verifyToken,
  requireWorkspaceRole('EDITOR'),
  async (req, res) => {
    try {
      const { workspaceId, batchId } = req.params;
      const result = commitStagedBatch(batchId, workspaceId, req.user.id);
      return res.json(result);
    } catch (err) {
      console.error('Import Commit Error:', err);
      return res.status(500).json({ error: 'Failed to commit staged batch to ledger.', details: err.message });
    }
  }
);

module.exports = router;
