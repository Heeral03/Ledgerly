# 🏛️ Ledgerly — Multi-Tenant Financial Reporting & Ingestion Platform

[![Node.js](https://img.shields.io/badge/Node.js-v22.x-brightgreen.svg)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-v4.18-blue.svg)](https://expressjs.com/)
[![SQLite WAL](https://img.shields.io/badge/Database-SQLite3_WAL_Mode-orange.svg)](https://www.sqlite.org/wal.html)
[![React](https://img.shields.io/badge/Frontend-React_19-61dafb.svg)](https://react.dev/)
[![Tests](https://img.shields.io/badge/Tests-8%2F8_Passed-success.svg)](./backend/tests/multitenant_sde.test.js)

**One sentence:** Connect your Google account, point Ledgerly at your spreadsheets, get a CEO-readable financial dashboard, and share it securely with colleagues without passing files around.

---

## 🎯 Product Vision & Core Flow

 Ledgerly solves a real problem for founders, CEOs, and ops teams who manage financials in Google Sheets: raw rows are hard to read quickly, and passing files around leads to version confusion. Ledgerly provides a fast, visual dashboard with scoped workspace permissions (OWNER, EDITOR, VIEWER).

```text
Google OAuth ─┐
Sheet Upload ─┴─> Sheet Fetcher/Parser ─> Fuzzy Header Normalizer ─> staging_rows
                                                                          │
                                                                          ▼
                                                              Accounting Validator
                                                              (balance check, spike detection)
                                                                          │
                                                                          ▼
                                                                 ledger_records (commit)
                                                                          │
                                                                          ▼
                                                        Dashboard API (reads from DB only,
                                                        never live Sheets calls per request)
                                                                          │
                                                                          ▼
                                                            React dashboard (charts, KPIs)
```

> ⚠️ **Critical Architectural Rule**: The dashboard **never** calls the Google Sheets API on page load. All reads come directly from `ledger_records` or cached aggregates. Google Sheets is only called during a sync job.

---

## 🗺️ Build & Roadmap Phases

### Phase 1 — Core Production MVP (Fully Implemented)
- **Google OAuth Login**: Session management issuing JWT tokens.
- **Google Sheets & File Ingestion**: Pick a Google Sheet OR upload `.xlsx`/`.csv` fallback.
- **Fuzzy Header Normalization**: Maps headers like `"Sales & Revenue"`, `"Turnover"`, or `"Income"` to canonical schema fields.
- **Staging & Validation Pipeline**: Checks balance invariants ($\sum \text{Debits} = \sum \text{Credits}$ or $\text{Revenue} - \text{Expenses} = \text{Net Profit}$), flags missing categories, and detects statistical spikes (>3x historical moving average).
- **Atomic Ledger Commit**: Promotes staged rows to `ledger_records` and records audit events atomically within a single SQL transaction.
- **Multi-Tenant Workspace Roles**: Scoped workspace access (`OWNER`, `EDITOR`, `VIEWER`), with email invitations.
- **Executive Visual Dashboard**: Renders Revenue, Expenses, Net Profit, MoM Growth KPIs, and Recharts trend visualizations.
- **Manual "Sync Now" Endpoint**: Re-fetches connected sheets and re-runs the pipeline, rate-limited to 1 per 5 minutes per workspace to respect Google API quotas (~60 read reqs/min).

### Phase 2 — Automation & AI (Post-MVP Enhancements)
- **Scheduled Background Sync**: Automatic daily/hourly syncs via background queue.
- **LLM Header Mapping Fallback**: AI fallback for edge-case unmapped headers when fuzzy match confidence is low.
- **Automated Anomaly Explanations**: Plain-English explanations when the spike detector flags a financial anomaly.
- **Financial Tool-Calling Query Agent**: Conversational agent allowing CFOs to query ledger records using fixed, workspace-scoped tools (`get_kpi()`, `get_category_breakdown()`, `compare_periods()`, `get_variance_flags()`).

### Phase 3 — Scale Hardening & Infrastructure Triggers

| Signal Observed | Action to Take |
| :--- | :--- |
| **SQLite write locks/timeouts under heavy load** | Migrate to PostgreSQL |
| **Running 2+ app instances for uptime** | Move response cache to Redis |
| **Google API 429 rate limit responses** | Add per-workspace exponential backoff/queuing |
| **Sheet imports blocking API requests** | Move imports to dedicated background worker scripts |
| **Multiple advisor users managing several clients** | Re-evaluate multi-source integrations (QuickBooks/Xero/Plaid) |

---

## 🗄️ Database Schema (`database.js`)

```sql
-- Workspaces (Multi-Tenant Boundaries)
CREATE TABLE workspaces (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  owner_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Workspace Members (Role-Based Access Control)
CREATE TABLE workspace_members (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id      INTEGER REFERENCES users(id) ON DELETE CASCADE,
  email        TEXT NOT NULL COLLATE NOCASE,
  role         TEXT NOT NULL DEFAULT 'VIEWER', -- 'OWNER' | 'EDITOR' | 'VIEWER'
  status       TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(workspace_id, email)
);

-- Connected Google Sheets
CREATE TABLE connected_sheets (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id     TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  google_sheet_id  TEXT NOT NULL,
  sheet_name       TEXT NOT NULL,
  connected_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  sync_frequency   TEXT NOT NULL DEFAULT 'DAILY', -- 'MANUAL' | 'DAILY' | 'HOURLY'
  last_synced_at   TEXT,
  last_sync_status TEXT, -- 'SUCCESS' | 'FAILED' | 'RATE_LIMITED'
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Background Sync Jobs Tracker
CREATE TABLE sync_jobs (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  connected_sheet_id INTEGER NOT NULL REFERENCES connected_sheets(id) ON DELETE CASCADE,
  status             TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED'
  error_message      TEXT,
  started_at         TEXT,
  finished_at        TEXT
);

-- Import Batches (Staging Tracker)
CREATE TABLE import_batches (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id     TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  filename         TEXT NOT NULL,
  file_hash        TEXT NOT NULL, -- SHA-256 Idempotency Key
  status           TEXT NOT NULL DEFAULT 'STAGED',
  ingested_by      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  row_count        INTEGER NOT NULL DEFAULT 0,
  validation_notes TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Relational Ledger Records
CREATE TABLE ledger_records (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id  TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  batch_id      INTEGER NOT NULL REFERENCES import_batches(id) ON DELETE CASCADE,
  period        TEXT NOT NULL,
  category      TEXT NOT NULL,
  revenue       REAL NOT NULL DEFAULT 0,
  expenses      REAL NOT NULL DEFAULT 0,
  net_profit    REAL NOT NULL DEFAULT 0,
  debit         REAL NOT NULL DEFAULT 0,
  credit        REAL NOT NULL DEFAULT 0,
  row_data_json TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Audit Events
CREATE TABLE audit_events (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id  TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
  actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  event_type    TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id   TEXT,
  metadata_json TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
```

---

## 🧪 Verification & Testing

Run the multi-tenant test suite:

```bash
cd backend
npm test
```

### Output:
```text
🧪 Starting Ledgerly Multi-Tenant SDE Test Suite...

  ✅ PASSED: Cryptographic AES-256-GCM Cell Encryption & Decryption
  ✅ PASSED: Cryptographic Tamper Detection Rejection
  ✅ PASSED: Cross-Tenant Workspace Data Isolation
  ✅ PASSED: Transactional Rollback on Staged Import Failure
  ✅ PASSED: Deterministic Financial Metrics Calculation
  ✅ PASSED: Tamper-Evident SHA-256 Audit Log Hash Chain Verification
  ✅ PASSED: Accounting Rule Validator (Balance Invariants & Validation)
  ✅ PASSED: Idempotent Ingestion & Staging Area Pipeline

📊 Test Suite Summary: 8 Passed, 0 Failed.
```

---

## 🚀 Quickstart & Local Setup

```bash
git clone https://github.com/Heeral03/Ledgerly.git
cd Ledgerly

# Backend Setup
cd backend
npm install
npm start

# Frontend Setup (in separate terminal)
cd ../frontend
npm install
npm run dev
```

---

## 📜 License
Distributed under the **MIT License**.
