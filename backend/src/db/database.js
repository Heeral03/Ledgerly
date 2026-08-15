const Database = require('better-sqlite3');
const path = require('path');

const dbPath = process.env.DB_PATH || path.join(__dirname, '../../data.db');
const db = new Database(dbPath);

// Enable WAL for better concurrent read performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── Schema ──────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    email       TEXT    NOT NULL UNIQUE COLLATE NOCASE,
    name        TEXT,
    picture     TEXT,
    role        TEXT    NOT NULL DEFAULT 'user',  -- 'admin' | 'user'
    status      TEXT    NOT NULL DEFAULT 'pending', -- 'pending' | 'active' | 'blocked'
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    permission  TEXT    NOT NULL DEFAULT 'view' -- 'view' | 'upload'
  );

  -- Whitelist entries: admin adds an email before the user can sign in
  CREATE TABLE IF NOT EXISTS whitelist (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    email       TEXT    NOT NULL UNIQUE COLLATE NOCASE,
    added_by    INTEGER NOT NULL REFERENCES users(id),
    used        INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    permission  TEXT    NOT NULL DEFAULT 'view' -- 'view' | 'upload'
  );

  -- Uploaded financial data rows (each cell value is AES-encrypted)
  CREATE TABLE IF NOT EXISTS uploads (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id),
    filename    TEXT    NOT NULL,
    row_index   INTEGER NOT NULL,
    row_data    TEXT    NOT NULL,  -- JSON string of encrypted { col: encryptedValue }
    uploaded_at TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  -- Cross-user access grants
  CREATE TABLE IF NOT EXISTS access_grants (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    grantor_id  INTEGER NOT NULL REFERENCES users(id),  -- always admin
    grantee_id  INTEGER NOT NULL REFERENCES users(id),  -- user who gets access
    target_id   INTEGER NOT NULL REFERENCES users(id),  -- user whose data is shared
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE(grantee_id, target_id)
  );

  -- Global CEO Dashboard data (shared across all users)
  CREATE TABLE IF NOT EXISTS global_uploads (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_id      INTEGER NOT NULL REFERENCES global_upload_history(id),
    company_name  TEXT    NOT NULL,
    filename      TEXT    NOT NULL,
    row_index     INTEGER NOT NULL,
    row_data      TEXT    NOT NULL, -- JSON string of encrypted cell data
    uploaded_at   TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  -- Track master file uploads
  CREATE TABLE IF NOT EXISTS global_upload_history (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    filename      TEXT    NOT NULL,
    uploaded_by   INTEGER NOT NULL REFERENCES users(id),
    uploaded_at   TEXT    NOT NULL DEFAULT (datetime('now')),
    metadata      TEXT    -- for storing company list etc
  );

  -- Store AI-generated analyses per company
  CREATE TABLE IF NOT EXISTS ai_analyses (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_id      INTEGER NOT NULL REFERENCES global_upload_history(id),
    company_name  TEXT    NOT NULL,
    analysis_text TEXT    NOT NULL,
    created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  -- Dashboards table for Workspace / Spreadsheet ownership
  CREATE TABLE IF NOT EXISTS dashboards (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT    NOT NULL,
    owner_id        INTEGER NOT NULL REFERENCES users(id),
    spreadsheet_url TEXT,
    selected_tab    TEXT    DEFAULT 'all',
    created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  -- Dashboard Members table for Server-Side RBAC & Pending Invitations
  CREATE TABLE IF NOT EXISTS dashboard_members (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    dashboard_id  INTEGER NOT NULL REFERENCES dashboards(id) ON DELETE CASCADE,
    email         TEXT    NOT NULL COLLATE NOCASE,
    user_id       INTEGER REFERENCES users(id) ON DELETE SET NULL,
    role          TEXT    NOT NULL DEFAULT 'VIEWER', -- 'OWNER' | 'EDITOR' | 'VIEWER'
    status        TEXT    NOT NULL DEFAULT 'PENDING', -- 'PENDING' | 'ACTIVE'
    invite_token  TEXT    UNIQUE,
    invited_by    INTEGER REFERENCES users(id),
    created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE(dashboard_id, email)
  );
`);

// ── Migrations (if tables already exist) ───────────────────────────
try { db.exec("ALTER TABLE users ADD COLUMN permission TEXT NOT NULL DEFAULT 'view'"); } catch(e){}
try { db.exec("ALTER TABLE whitelist ADD COLUMN permission TEXT NOT NULL DEFAULT 'view'"); } catch(e){}
try { db.exec("ALTER TABLE global_uploads ADD COLUMN batch_id INTEGER REFERENCES global_upload_history(id)"); } catch(e){}
try { db.exec("ALTER TABLE global_uploads ADD COLUMN company_name TEXT"); } catch(e){}

module.exports = db;
