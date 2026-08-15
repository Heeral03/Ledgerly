const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'dev_secret_replace_in_production';

/**
 * Verify a JWT from the Authorization header.
 * Attaches req.user from DB on success.
 */
function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }
  const token = header.slice(7);
  try {
    const decoded = jwt.verify(token, SECRET);
    const db = require('../db/database');
    let dbUser = db.prepare('SELECT id, email, name, picture, role, status, permission FROM users WHERE id = ?').get(decoded.id);
    if (!dbUser && decoded.email) {
      dbUser = db.prepare('SELECT id, email, name, picture, role, status, permission FROM users WHERE email = ? COLLATE NOCASE').get(decoded.email);
    }
    if (!dbUser) {
      return res.status(401).json({ error: 'User session no longer valid. Please sign in again.' });
    }
    req.user = dbUser;
    next();
  } catch {
    return res.status(401).json({ error: 'Token expired or invalid' });
  }
}

/**
 * Sign a new JWT for a verified user.
 */
function signToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: '8h' });
}

module.exports = { authenticate, signToken };
