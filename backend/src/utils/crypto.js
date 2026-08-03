const crypto = require('crypto');

const ALGO = 'aes-256-gcm';
// Key must be 32 bytes (64 hex chars). Pad short keys for dev safety.
const rawKey = process.env.ENCRYPTION_KEY || 'dev_key_replace_in_production_00000000000000000000000000000000';
const KEY = Buffer.from(rawKey.padEnd(64, '0').slice(0, 64), 'hex');

/**
 * Encrypt a plain-text string.
 * Returns a Base64 string: iv:authTag:ciphertext
 */
function encrypt(plaintext) {
  if (plaintext == null) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString('base64'), tag.toString('base64'), encrypted.toString('base64')].join(':');
}

/**
 * Decrypt a value produced by encrypt().
 */
function decrypt(ciphertext) {
  if (ciphertext == null) return null;
  try {
    const [ivB64, tagB64, dataB64] = ciphertext.split(':');
    const iv = Buffer.from(ivB64, 'base64');
    const tag = Buffer.from(tagB64, 'base64');
    const data = Buffer.from(dataB64, 'base64');
    const decipher = crypto.createDecipheriv(ALGO, KEY, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  } catch {
    return null; // Tampered or wrong key
  }
}

module.exports = { encrypt, decrypt };
