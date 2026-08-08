const db = require('../db/database');

const ROLE_LEVELS = {
  OWNER: 3,
  EDITOR: 2,
  VIEWER: 1,
};

/**
 * Middleware factory to enforce Server-Side RBAC on dashboards.
 * @param {string} minimumRole - 'OWNER', 'EDITOR', or 'VIEWER'
 */
function checkDashboardAccess(minimumRole = 'VIEWER') {
  return (req, res, next) => {
    try {
      const dashboardId = req.params.id || req.params.dashboardId || req.body.dashboardId || req.query.dashboardId;
      
      if (!dashboardId) {
        return res.status(400).json({ error: 'Dashboard ID is required' });
      }

      if (!req.user || !req.user.id) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // 1. Check if user is the direct owner in `dashboards` table
      const dashboard = db.prepare('SELECT * FROM dashboards WHERE id = ?').get(dashboardId);
      if (!dashboard) {
        return res.status(404).json({ error: 'Dashboard not found' });
      }

      let userRole = null;

      if (dashboard.owner_id === req.user.id) {
        userRole = 'OWNER';
      } else {
        // 2. Check membership table (must be ACTIVE status)
        const member = db.prepare(`
          SELECT role, status FROM dashboard_members 
          WHERE dashboard_id = ? AND (user_id = ? OR email = ? COLLATE NOCASE)
        `).get(dashboardId, req.user.id, req.user.email);

        if (member && member.status === 'ACTIVE') {
          userRole = member.role.toUpperCase();
          // Ensure user_id is updated if previously matched by email only
          if (req.user.id) {
            db.prepare('UPDATE dashboard_members SET user_id = ? WHERE id = ? AND user_id IS NULL')
              .run(req.user.id, member.id);
          }
        }
      }

      if (!userRole) {
        return res.status(403).json({ error: 'Access denied. You are not a member of this dashboard.' });
      }

      const requiredLevel = ROLE_LEVELS[minimumRole.toUpperCase()] || 1;
      const userLevel = ROLE_LEVELS[userRole] || 0;

      if (userLevel < requiredLevel) {
        return res.status(403).json({
          error: `Permission denied. Requires '${minimumRole}' role or higher. Your role is '${userRole}'.`,
          userRole,
          requiredRole: minimumRole,
        });
      }

      // Attach dashboard and role to request
      req.dashboard = dashboard;
      req.userRole = userRole;

      next();
    } catch (err) {
      console.error('RBAC Error:', err);
      return res.status(500).json({ error: 'Internal server error validating authorization.' });
    }
  };
}

/**
 * Simple middleware factory to check user global/system role (e.g. 'admin').
 * @param {string} role - 'admin', 'user', etc.
 */
function requireRole(role) {
  return (req, res, next) => {
    if (!req.user || req.user.role !== role) {
      return res.status(403).json({ error: `Access denied. Requires '${role}' role.` });
    }
    next();
  };
}

module.exports = {
  checkDashboardAccess,
  requireRole,
  ROLE_LEVELS,
};
