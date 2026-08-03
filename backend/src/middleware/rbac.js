/**
 * RBAC middleware factory.
 * Usage: router.get('/route', authenticate, requireRole('admin'), handler)
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthenticated' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

/**
 * Ensures a user can only access their own data — unless they are admin,
 * or have been explicitly granted access by an admin.
 */
function requireOwnerOrAdmin(db) {
  return (req, res, next) => {
    const targetId = parseInt(req.params.userId || req.params.id);
    if (!targetId) return res.status(400).json({ error: 'Missing user ID' });

    const { id: requesterId, role } = req.user;
    if (role === 'admin') return next();
    if (requesterId === targetId) return next();

    // Check access_grants table
    const grant = db.prepare(
      'SELECT id FROM access_grants WHERE grantee_id = ? AND target_id = ?'
    ).get(requesterId, targetId);

    if (grant) return next();
    return res.status(403).json({ error: 'Access denied' });
  };
}

module.exports = { requireRole, requireOwnerOrAdmin };
