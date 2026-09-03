const crypto = require('crypto');
const db = require('../db/database');

/**
 * Log an application-level audit event with SHA-256 hash chaining.
 * event_hash = SHA256(previous_hash + canonical_event_json)
 */
function logAuditEvent({ workspaceId, actorUserId, eventType, resourceType, resourceId, metadata = {}, requestId = null }) {
  try {
    // 1. Fetch previous hash for the workspace (or global fallback '0000000000000000000000000000000000000000000000000000000000000000')
    const lastEvent = db.prepare(`
      SELECT event_hash FROM audit_events 
      WHERE workspace_id = ? OR (workspace_id IS NULL AND ? IS NULL)
      ORDER BY id DESC LIMIT 1
    `).get(workspaceId || null, workspaceId || null);

    const previousHash = lastEvent ? lastEvent.event_hash : '0000000000000000000000000000000000000000000000000000000000000000';
    const metadataJson = JSON.stringify(metadata);

    const rId = resourceId != null ? String(resourceId) : '';
    const aId = actorUserId != null ? String(actorUserId) : '';
    const canonicalString = `${previousHash}:${workspaceId || ''}:${aId}:${eventType}:${resourceType}:${rId}:${metadataJson}:${requestId || ''}`;
    const eventHash = crypto.createHash('sha256').update(canonicalString).digest('hex');

    db.prepare(`
      INSERT INTO audit_events 
      (workspace_id, actor_user_id, event_type, resource_type, resource_id, metadata_json, request_id, event_hash, previous_hash)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      workspaceId || null,
      actorUserId || null,
      eventType,
      resourceType,
      rId || null,
      metadataJson,
      requestId || null,
      eventHash,
      previousHash
    );

    return { eventHash, previousHash };
  } catch (err) {
    console.error('Audit Logger Error:', err.message);
    return null;
  }
}

/**
 * Verify integrity of audit log hash chain for a workspace.
 */
function verifyAuditChain(workspaceId) {
  const events = db.prepare(`
    SELECT * FROM audit_events WHERE workspace_id = ? ORDER BY id ASC
  `).all(workspaceId);

  let expectedPreviousHash = '0000000000000000000000000000000000000000000000000000000000000000';
  for (const event of events) {
    if (event.previous_hash !== expectedPreviousHash) {
      return { valid: false, brokenEventId: event.id, reason: 'Previous hash mismatch' };
    }
    const rId = event.resource_id != null ? String(event.resource_id) : '';
    const aId = event.actor_user_id != null ? String(event.actor_user_id) : '';
    const canonicalString = `${expectedPreviousHash}:${event.workspace_id || ''}:${aId}:${event.event_type}:${event.resource_type}:${rId}:${event.metadata_json || '{}'}:${event.request_id || ''}`;
    const calculatedHash = crypto.createHash('sha256').update(canonicalString).digest('hex');

    if (calculatedHash !== event.event_hash) {
      return { valid: false, brokenEventId: event.id, reason: 'Calculated hash mismatch' };
    }
    expectedPreviousHash = event.event_hash;
  }
  return { valid: true, count: events.length };
}

module.exports = {
  logAuditEvent,
  verifyAuditChain,
};
