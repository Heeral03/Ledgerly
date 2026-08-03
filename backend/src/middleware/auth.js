const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'dev_secret_replace_in_production';

/**
 * Verify a JWT from the Authorization header.
 * Attaches req.user = { id, email, role } on success.
 */
function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }
  const token = header.slice(7);
  try {
    req.user = jwt.verify(token, SECRET);
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
