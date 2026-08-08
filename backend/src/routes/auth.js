const express = require('express');
const { OAuth2Client } = require('google-auth-library');
const axios = require('axios');
const db = require('../db/database');
const { signToken } = require('../middleware/auth');

const router = express.Router();
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/**
 * POST /api/auth/google
 * Body: { credential: <Google ID token> }
 * Original flow for backward compat.
 */
router.post('/google', async (req, res, next) => {
  try {
    const { credential } = req.body;
    if (!credential) return res.status(400).json({ error: 'Missing credential' });

    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const { email, name, picture } = ticket.getPayload();
    return upsertAndRespond(email, name, picture, res);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/google-token
 * Body: { access_token, email, name, picture }
 * New flow: frontend uses useGoogleLogin (implicit) and sends user info
 * along with an access_token we verify by calling Google's userinfo endpoint.
 */
router.post('/google-token', async (req, res, next) => {
  try {
    const { access_token, email, name, picture } = req.body;
    if (!access_token || !email) return res.status(400).json({ error: 'Missing token or email' });

    // Verify the access token by calling Google's tokeninfo endpoint
    const tokenInfo = await axios.get(
      `https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${access_token}`
    );

    // Make sure the token belongs to the claimed email
    if (tokenInfo.data.email?.toLowerCase() !== email.toLowerCase()) {
      return res.status(403).json({ error: 'Token does not match claimed email' });
    }

    return upsertAndRespond(email, name, picture, res);
  } catch (err) {
    if (err.response?.status === 400) {
      return res.status(401).json({ error: 'Invalid or expired Google access token' });
    }
    next(err);
  }
});

/**
 * Shared logic: check whitelist, upsert user, issue JWT
 */
async function upsertAndRespond(email, name, picture, res) {
  const ADMIN_EMAIL = process.env.ADMIN_EMAIL || '';
  const isAdmin = email.toLowerCase() === ADMIN_EMAIL.toLowerCase();

  // Check if user has pending or existing dashboard invitations
  const pendingInvites = db.prepare(
    'SELECT * FROM dashboard_members WHERE email = ? COLLATE NOCASE'
  ).all(email);

  let permission = 'view';
  if (!isAdmin) {
    const entry = db.prepare(
      'SELECT permission FROM whitelist WHERE email = ? COLLATE NOCASE'
    ).get(email);

    if (entry) {
      permission = entry.permission;
    } else if (pendingInvites.length > 0) {
      // User was invited to a dashboard! Grant access.
      permission = pendingInvites.some(i => i.role === 'OWNER' || i.role === 'EDITOR') ? 'upload' : 'view';
    } else {
      return res.status(403).json({
        error: 'not_whitelisted',
        message: 'Your email is not approved or invited to any workspace. Please contact an Admin or Workspace Owner.',
      });
    }
  } else {
    permission = 'upload';
  }

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

  if (!isAdmin) {
    db.prepare('UPDATE whitelist SET used = 1 WHERE email = ? COLLATE NOCASE').run(email);
  }

  // Activate pending invitations and link user_id
  if (pendingInvites.length > 0) {
    db.prepare(`
      UPDATE dashboard_members 
      SET user_id = ?, status = 'ACTIVE' 
      WHERE email = ? COLLATE NOCASE
    `).run(user.id, email);
  }

  const token = signToken({
    id: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
    permission: user.permission,
  });

  res.json({
    token,
    user: {
      id: user.id, email: user.email, name: user.name,
      picture: user.picture, role: user.role, permission: user.permission,
    },
  });
}

module.exports = router;
