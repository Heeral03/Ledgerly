const express = require('express');
const crypto = require('crypto');
const db = require('../db/database');
const { authenticate } = require('../middleware/auth');
const { checkDashboardAccess } = require('../middleware/rbac');

const router = express.Router();

// Require authentication for all dashboard routes
router.use(authenticate);

/**
 * GET /api/dashboards
 * List all dashboards the authenticated user owns or is a member of.
 */
router.get('/', (req, res) => {
  try {
    const userId = req.user.id;
    const userEmail = req.user.email;

    // Get dashboards where user is direct owner or active/pending member
    const dashboards = db.prepare(`
      SELECT 
        d.id, d.name, d.spreadsheet_url, d.selected_tab, d.owner_id, d.created_at,
        u.name as owner_name, u.email as owner_email,
        COALESCE(dm.role, CASE WHEN d.owner_id = ? THEN 'OWNER' ELSE 'VIEWER' END) as user_role,
        COALESCE(dm.status, 'ACTIVE') as member_status
      FROM dashboards d
      JOIN users u ON d.owner_id = u.id
      LEFT JOIN dashboard_members dm ON d.id = dm.dashboard_id AND (dm.user_id = ? OR dm.email = ? COLLATE NOCASE)
      WHERE d.owner_id = ? OR (dm.id IS NOT NULL AND dm.status = 'ACTIVE')
      ORDER BY d.created_at DESC
    `).all(userId, userId, userEmail, userId);

    res.json(dashboards);
  } catch (err) {
    console.error('List Dashboards Error:', err);
    res.status(500).json({ error: 'Failed to retrieve dashboards' });
  }
});

/**
 * POST /api/dashboards
 * Create a new dashboard workspace. Creator becomes OWNER.
 */
router.post('/', (req, res) => {
  try {
    const { name, spreadsheet_url, selected_tab } = req.body;
    if (!name) return res.status(400).json({ error: 'Dashboard name is required' });

    const ownerId = req.user.id;

    const result = db.prepare(`
      INSERT INTO dashboards (name, owner_id, spreadsheet_url, selected_tab)
      VALUES (?, ?, ?, ?)
    `).run(name, ownerId, spreadsheet_url || '', selected_tab || 'all');

    const dashboardId = result.lastInsertRowid;

    // Also add owner to dashboard_members table for consistency
    db.prepare(`
      INSERT INTO dashboard_members (dashboard_id, email, user_id, role, status)
      VALUES (?, ?, ?, 'OWNER', 'ACTIVE')
      ON CONFLICT(dashboard_id, email) DO UPDATE SET role = 'OWNER', status = 'ACTIVE'
    `).run(dashboardId, req.user.email, ownerId);

    const created = db.prepare('SELECT * FROM dashboards WHERE id = ?').get(dashboardId);
    res.status(201).json({ ...created, user_role: 'OWNER' });
  } catch (err) {
    console.error('Create Dashboard Error:', err);
    res.status(500).json({ error: 'Failed to create dashboard workspace' });
  }
});

/**
 * GET /api/dashboards/:id
 * Retrieve dashboard details & role. Accessible to OWNER, EDITOR, VIEWER.
 */
router.get('/:id', checkDashboardAccess('VIEWER'), (req, res) => {
  res.json({
    dashboard: req.dashboard,
    role: req.userRole,
  });
});

/**
 * PUT /api/dashboards/:id
 * Update dashboard metadata. Accessible to OWNER and EDITOR.
 */
router.put('/:id', checkDashboardAccess('EDITOR'), (req, res) => {
  try {
    const { name, spreadsheet_url, selected_tab } = req.body;
    const dashboardId = req.params.id;

    db.prepare(`
      UPDATE dashboards 
      SET name = COALESCE(?, name),
          spreadsheet_url = COALESCE(?, spreadsheet_url),
          selected_tab = COALESCE(?, selected_tab)
      WHERE id = ?
    `).run(name, spreadsheet_url, selected_tab, dashboardId);

    const updated = db.prepare('SELECT * FROM dashboards WHERE id = ?').get(dashboardId);
    res.json({ dashboard: updated, role: req.userRole });
  } catch (err) {
    console.error('Update Dashboard Error:', err);
    res.status(500).json({ error: 'Failed to update dashboard settings' });
  }
});

/**
 * DELETE /api/dashboards/:id
 * Delete workspace. Accessible ONLY to OWNER.
 */
router.delete('/:id', checkDashboardAccess('OWNER'), (req, res) => {
  try {
    const dashboardId = req.params.id;
    db.prepare('DELETE FROM dashboards WHERE id = ?').run(dashboardId);
    res.json({ message: 'Dashboard workspace deleted successfully' });
  } catch (err) {
    console.error('Delete Dashboard Error:', err);
    res.status(500).json({ error: 'Failed to delete workspace' });
  }
});

/**
 * GET /api/dashboards/:id/members
 * List all dashboard members and pending invitations. Accessible to OWNER, EDITOR, VIEWER.
 */
router.get('/:id/members', checkDashboardAccess('VIEWER'), (req, res) => {
  try {
    const dashboardId = req.params.id;

    const members = db.prepare(`
      SELECT 
        dm.id, dm.email, dm.user_id, dm.role, dm.status, dm.invite_token, dm.created_at,
        u.name, u.picture
      FROM dashboard_members dm
      LEFT JOIN users u ON dm.user_id = u.id OR dm.email = u.email COLLATE NOCASE
      WHERE dm.dashboard_id = ?
      ORDER BY 
        CASE dm.role WHEN 'OWNER' THEN 1 WHEN 'EDITOR' THEN 2 ELSE 3 END,
        dm.created_at ASC
    `).all(dashboardId);

    res.json({
      members,
      currentUserRole: req.userRole,
    });
  } catch (err) {
    console.error('Get Members Error:', err);
    res.status(500).json({ error: 'Failed to retrieve members list' });
  }
});

/**
 * POST /api/dashboards/:id/invite
 * Invite user by email. Accessible ONLY to OWNER.
 * Creates a PENDING membership entry if user hasn't registered yet.
 */
router.post('/:id/invite', checkDashboardAccess('OWNER'), (req, res) => {
  try {
    const { email, role = 'VIEWER' } = req.body;
    const dashboardId = req.params.id;

    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      return res.status(400).json({ error: 'Valid email address required' });
    }

    const targetRole = ['EDITOR', 'VIEWER'].includes(role.toUpperCase()) ? role.toUpperCase() : 'VIEWER';
    const inviteToken = crypto.randomBytes(16).toString('hex');

    // Check if target user already registered
    const existingUser = db.prepare('SELECT id FROM users WHERE email = ? COLLATE NOCASE').get(email);
    const userId = existingUser ? existingUser.id : null;
    const status = existingUser ? 'ACTIVE' : 'PENDING';

    const insertOrUpdate = db.prepare(`
      INSERT INTO dashboard_members (dashboard_id, email, user_id, role, status, invite_token, invited_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(dashboard_id, email) DO UPDATE SET
        role = excluded.role,
        status = excluded.status,
        invite_token = excluded.invite_token,
        invited_by = excluded.invited_by
    `);

    insertOrUpdate.run(dashboardId, email, userId, targetRole, status, inviteToken, req.user.id);

    const memberRecord = db.prepare(`
      SELECT * FROM dashboard_members WHERE dashboard_id = ? AND email = ? COLLATE NOCASE
    `).get(dashboardId, email);

    res.status(201).json({
      message: status === 'PENDING' ? 'Invitation sent! User can join using Google Login.' : 'User added to dashboard!',
      member: memberRecord,
      inviteUrl: `${req.protocol}://${req.get('host')}/invite/${inviteToken}`,
    });
  } catch (err) {
    console.error('Invite Member Error:', err);
    res.status(500).json({ error: 'Failed to create member invitation' });
  }
});

/**
 * PUT /api/dashboards/:id/members/:memberId
 * Update a member's role (OWNER only). Cannot change OWNER role.
 */
router.put('/:id/members/:memberId', checkDashboardAccess('OWNER'), (req, res) => {
  try {
    const { role } = req.body;
    const { id: dashboardId, memberId } = req.params;

    if (!['EDITOR', 'VIEWER'].includes(role?.toUpperCase())) {
      return res.status(400).json({ error: 'Invalid role. Must be EDITOR or VIEWER' });
    }

    const targetMember = db.prepare('SELECT * FROM dashboard_members WHERE id = ? AND dashboard_id = ?').get(memberId, dashboardId);
    if (!targetMember) return res.status(404).json({ error: 'Member not found' });

    if (targetMember.role === 'OWNER') {
      return res.status(403).json({ error: 'Cannot change the role of the workspace Owner' });
    }

    db.prepare('UPDATE dashboard_members SET role = ? WHERE id = ?').run(role.toUpperCase(), memberId);

    res.json({ message: 'Role updated successfully' });
  } catch (err) {
    console.error('Update Member Role Error:', err);
    res.status(500).json({ error: 'Failed to update member role' });
  }
});

/**
 * DELETE /api/dashboards/:id/members/:memberId
 * Remove a member or pending invitation (OWNER only). Cannot remove workspace owner.
 */
router.delete('/:id/members/:memberId', checkDashboardAccess('OWNER'), (req, res) => {
  try {
    const { id: dashboardId, memberId } = req.params;

    const targetMember = db.prepare('SELECT * FROM dashboard_members WHERE id = ? AND dashboard_id = ?').get(memberId, dashboardId);
    if (!targetMember) return res.status(404).json({ error: 'Member not found' });

    if (targetMember.role === 'OWNER') {
      return res.status(403).json({ error: 'Cannot remove the workspace Owner' });
    }

    db.prepare('DELETE FROM dashboard_members WHERE id = ?').run(memberId);

    res.json({ message: 'Member removed from dashboard' });
  } catch (err) {
    console.error('Remove Member Error:', err);
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

module.exports = router;
