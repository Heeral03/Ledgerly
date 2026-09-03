const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { requireWorkspaceRole } = require('../middleware/rbac');
const { computeWorkspaceMetrics } = require('../services/metricsEngine');
const { verifyAuditChain } = require('../utils/auditLogger');
const { logAuditEvent } = require('../utils/auditLogger');
const crypto = require('crypto');

// 1. Create Workspace
router.post('/', (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Workspace name is required' });

    const workspaceId = `ws_${crypto.randomBytes(8).toString('hex')}`;

    db.transaction(() => {
      db.prepare('INSERT INTO workspaces (id, name, owner_id) VALUES (?, ?, ?)').run(workspaceId, name, req.user.id);
      db.prepare(`
        INSERT INTO workspace_members (workspace_id, user_id, email, role, status)
        VALUES (?, ?, ?, 'OWNER', 'ACTIVE')
      `).run(workspaceId, req.user.id, req.user.email);
    })();

    logAuditEvent({
      workspaceId,
      actorUserId: req.user.id,
      eventType: 'WORKSPACE_CREATED',
      resourceType: 'WORKSPACE',
      resourceId: workspaceId,
      metadata: { name },
      requestId: req.traceId || null,
    });

    return res.status(201).json({ message: 'Workspace created', workspaceId, name, role: 'OWNER' });
  } catch (err) {
    console.error('Create Workspace Error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// 2. Fetch Workspace Deterministic Metrics
router.get('/:workspaceId/metrics', requireWorkspaceRole('VIEWER'), (req, res) => {
  try {
    const { workspaceId } = req.params;
    const period = req.query.period || '2026-05';

    const metricsResult = computeWorkspaceMetrics(workspaceId, period);

    logAuditEvent({
      workspaceId,
      actorUserId: req.user ? req.user.id : null,
      eventType: 'METRICS_ACCESSED',
      resourceType: 'METRICS',
      resourceId: period,
      metadata: { dataQuality: metricsResult.dataQuality },
      requestId: req.traceId || null,
    });

    return res.status(200).json(metricsResult);
  } catch (err) {
    console.error('Fetch Metrics Error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// 3. Fetch Audit Logs (Restricted to OWNER)
router.get('/:workspaceId/audit-logs', requireWorkspaceRole('OWNER'), (req, res) => {
  try {
    const { workspaceId } = req.params;

    const events = db.prepare(`
      SELECT id, workspace_id, actor_user_id, event_type, resource_type, resource_id, metadata_json, request_id, event_hash, previous_hash, created_at
      FROM audit_events WHERE workspace_id = ? ORDER BY id DESC LIMIT 100
    `).all(workspaceId);

    const integrity = verifyAuditChain(workspaceId);

    return res.status(200).json({
      workspaceId,
      auditChainIntegrity: integrity,
      eventCount: events.length,
      events,
    });
  } catch (err) {
    console.error('Fetch Audit Logs Error:', err);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
