const express = require('express');
const { OAuth2Client } = require('google-auth-library');
const db = require('../db/database');
const { signToken } = require('../middleware/auth');

const router = express.Router();
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/**
 * POST /api/auth/google
 * Body: { credential: <Google ID token> }
 *
 * Flow:
 *  1. Verify the Google ID token with Google's servers
 *  2. Check the user's email against the whitelist (or is the admin)
 *  3. Upsert the user record
 *  4. Issue our own short-lived JWT
 */
router.post('/google', async (req, res, next) => {
  try {
    const { credential } = req.body;
    if (!credential) return res.status(400).json({ error: 'Missing credential' });

    // 1. Verify token with Google
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const { email, name, picture } = ticket.getPayload();

    const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
    const isAdmin = email.toLowerCase() === ADMIN_EMAIL.toLowerCase();

    // 2. Check whitelist (admin always passes)
    let permission = 'view';
    if (!isAdmin) {
      const entry = db.prepare(
        'SELECT permission FROM whitelist WHERE email = ? COLLATE NOCASE'
      ).get(email);
      if (!entry) {
        return res.status(403).json({
          error: 'not_whitelisted',
          message: 'Your email is not approved. Please contact your Admin.',
        });
      }
      permission = entry.permission;
    } else {
      permission = 'upload'; // Admins always have upload power
    }

    // 3. Upsert user
    const existing = db.prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE').get(email);
    let user;
    if (existing) {
      db.prepare('UPDATE users SET name = ?, picture = ?, permission = ? WHERE id = ?')
        .run(name, picture, permission, existing.id);
      user = { ...existing, name, picture, permission };
    } else {
      const info = db.prepare(
        'INSERT INTO users (email, name, picture, role, status, permission) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(email, name, picture, isAdmin ? 'admin' : 'user', 'active', permission);
      user = { id: info.lastInsertRowid, email, name, picture, role: isAdmin ? 'admin' : 'user', status: 'active', permission };
    }

    // Mark whitelist entry as used
    if (!isAdmin) {
      db.prepare('UPDATE whitelist SET used = 1 WHERE email = ? COLLATE NOCASE').run(email);
    }

    // 4. Issue JWT
    const token = signToken({
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      permission: user.permission
    });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        picture: user.picture,
        role: user.role,
        permission: user.permission
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
