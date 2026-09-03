const Database = require('better-sqlite3');
const path = require('path');

const dbPath = process.env.DB_PATH || path.join(__dirname, '../../data.db');
const db = new Database(dbPath);

// Enable WAL for better concurrent read performance & high throughput tuning
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('synchronous = NORMAL');
db.pragma('cache_size = -16000'); // 16MB cache size
db.pragma('temp_store = MEMORY');

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

  -- ── NEW SDE MULTI-TENANT ARCHITECTURE ─────────────────────────────

  -- Workspaces (Explicit Multi-Tenant Boundaries)
  CREATE TABLE IF NOT EXISTS workspaces (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    owner_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Workspace Members (Role-Based Authorization)
  CREATE TABLE IF NOT EXISTS workspace_members (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id      INTEGER REFERENCES users(id) ON DELETE CASCADE,
    email        TEXT NOT NULL COLLATE NOCASE,
    role         TEXT NOT NULL DEFAULT 'VIEWER', -- 'OWNER' | 'EDITOR' | 'VIEWER'
    status       TEXT NOT NULL DEFAULT 'ACTIVE', -- 'PENDING' | 'ACTIVE'
    invite_token TEXT UNIQUE,
    created_at   TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(workspace_id, email)
  );

  -- Data Sources (File uploads, Google Sheets integrations)
  CREATE TABLE IF NOT EXISTS data_sources (
    id           TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    type         TEXT NOT NULL DEFAULT 'FILE', -- 'FILE' | 'GOOGLE_SHEETS'
    name         TEXT NOT NULL,
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Transactional Import Workflow Tracker
  CREATE TABLE IF NOT EXISTS imports (
    id             TEXT PRIMARY KEY,
    workspace_id   TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    data_source_id TEXT REFERENCES data_sources(id) ON DELETE SET NULL,
    status         TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING' | 'VALIDATING' | 'READY' | 'FAILED'
    rows_read      INTEGER DEFAULT 0,
    rows_valid     INTEGER DEFAULT 0,
    rows_rejected  INTEGER DEFAULT 0,
    warnings       INTEGER DEFAULT 0,
    created_at     TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Staging Table for Two-Phase Imports
  CREATE TABLE IF NOT EXISTS staging_import_rows (
    id                     INTEGER PRIMARY KEY AUTOINCREMENT,
    import_id              TEXT NOT NULL REFERENCES imports(id) ON DELETE CASCADE,
    row_index              INTEGER NOT NULL,
    raw_data_json          TEXT NOT NULL,
    validation_errors_json TEXT
  );

  -- Financial Records (Scoped by Workspace & Encrypted Cell Data)
  CREATE TABLE IF NOT EXISTS financial_records (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    workspace_id     TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    import_id        TEXT REFERENCES imports(id) ON DELETE SET NULL,
    period           TEXT NOT NULL,
    category         TEXT NOT NULL,
    encrypted_amount TEXT NOT NULL,
    iv               TEXT NOT NULL,
    auth_tag         TEXT NOT NULL,
    created_at       TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Deterministic Normalized Metrics
  CREATE TABLE IF NOT EXISTS normalized_metrics (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    workspace_id  TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    period        TEXT NOT NULL,
    metric_name   TEXT NOT NULL,
    value         REAL NOT NULL,
    metadata_json TEXT,
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(workspace_id, period, metric_name)
  );

  -- Audit Events (Tamper-Evident SHA-256 Hash Chain)
  CREATE TABLE IF NOT EXISTS audit_events (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    workspace_id  TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
    actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    event_type    TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id   TEXT,
    metadata_json TEXT,
    request_id    TEXT,
    event_hash    TEXT NOT NULL,
    previous_hash TEXT NOT NULL,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- ── Production Performance & Isolation Indexes ────────────────────
  CREATE INDEX IF NOT EXISTS idx_uploads_user_id ON uploads(user_id);
  CREATE INDEX IF NOT EXISTS idx_global_uploads_batch_comp ON global_uploads(batch_id, company_name);
  CREATE INDEX IF NOT EXISTS idx_dashboard_members_dash_email ON dashboard_members(dashboard_id, email);
  CREATE INDEX IF NOT EXISTS idx_dashboard_members_user ON dashboard_members(user_id);
  CREATE INDEX IF NOT EXISTS idx_whitelist_email ON whitelist(email);
  CREATE INDEX IF NOT EXISTS idx_ai_analyses_batch_comp ON ai_analyses(batch_id, company_name);
  CREATE INDEX IF NOT EXISTS idx_dashboards_owner ON dashboards(owner_id);

  CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON workspace_members(user_id);
  CREATE INDEX IF NOT EXISTS idx_workspace_members_ws ON workspace_members(workspace_id);
  CREATE INDEX IF NOT EXISTS idx_imports_ws_status ON imports(workspace_id, status);
  CREATE INDEX IF NOT EXISTS idx_staging_import_id ON staging_import_rows(import_id);
  CREATE INDEX IF NOT EXISTS idx_financial_records_ws_period ON financial_records(workspace_id, period);
  CREATE INDEX IF NOT EXISTS idx_audit_events_ws_created ON audit_events(workspace_id, created_at);
`);

// ── Migrations (if tables already exist) ───────────────────────────
try { db.exec("ALTER TABLE users ADD COLUMN permission TEXT NOT NULL DEFAULT 'view'"); } catch(e){}
try { db.exec("ALTER TABLE whitelist ADD COLUMN permission TEXT NOT NULL DEFAULT 'view'"); } catch(e){}
try { db.exec("ALTER TABLE global_uploads ADD COLUMN batch_id INTEGER REFERENCES global_upload_history(id)"); } catch(e){}
try { db.exec("ALTER TABLE global_uploads ADD COLUMN company_name TEXT"); } catch(e){}

module.exports = db;
