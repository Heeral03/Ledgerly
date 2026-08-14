# 📊 Ledgerly — Financial Analytics & Multi-Tenant Workspace Platform

**Ledgerly** is a secure, enterprise-grade financial analytics and workspace platform designed to simplify financial reporting, spreadsheet data ingestion, team collaboration, and executive decision-making. 

It transforms messy, fragmented Excel files and Google Sheets into encrypted, actionable visual dashboards with role-based access control (RBAC) and AI-driven executive insights.

---

## 🎯 Problem It Solves

Modern businesses, financial advisors, and executive leaders often face critical challenges when managing financial metrics:

1. **Fragmented Data Across Spreadsheets**: Financial metrics (Sales, Revenue, Capex, Salaries, Cash & Bank, Loans, P&L) are often scattered across disconnected Excel files and Google Sheets, making cross-company or cross-department analysis tedious and error-prone.
2. **Data Privacy & Confidentiality Vulnerabilities**: Unencrypted spreadsheets containing sensitive figures (payroll, debt, net profit) sent over email or stored unencrypted on shared drives pose severe compliance and data breach risks.
3. **Inconsistent Column Naming & Formats**: Different team members or subsidiaries label columns differently (e.g., `"Capax"`, `"Capex Investment"`, `"R&D Exp."`, `"Salary / Wages"`), write negative numbers in parenthetical format like `(50,000)`, or add extra header rows, breaking standard data tools.
4. **Lack of Granular Access Control**: Traditional file sharing is binary (all-or-nothing). Executives need a unified overview without exposing raw operational spreadsheet access to unauthorized internal or external users.

**Ledgerly resolves these issues** by offering automated sheet ingestion with fuzzy column normalization, cell-level AES-256-GCM encryption, whitelisted authentication, multi-tenant workspace team management, and consolidated CEO dashboards.

---

## ⚙️ How It Works

Ledgerly provides an end-to-end pipeline from raw data upload to visual analytics and role-based sharing:

```
┌───────────────────────────┐     ┌────────────────────────────────┐     ┌─────────────────────────────┐
│ Multi-Tab Excel / XLSX    │ ──> │ Smart Header Normalization     │ ──> │ Cell-Level AES-256-GCM      │
│ Google Sheets Integration │     │ & Data Cleaning Engine         │     │ Database Encryption         │
└───────────────────────────┘     └────────────────────────────────┘     └─────────────────────────────┘
                                                                                        │
                                                                                        ▼
┌───────────────────────────┐     ┌────────────────────────────────┐     ┌─────────────────────────────┐
│ Interactive Recharts      │ <── │ Multi-Tenant Workspaces & RBAC │ <── │ Fast SQLite (Better-SQLite3)│
│ & Executive CEO Dashboard │     │ (Owner, Editor, Viewer Roles)  │     │ Storage Engine              │
└───────────────────────────┘     └────────────────────────────────┘     └─────────────────────────────┘
```

### 1. Data Ingestion & Smart Normalization
- **Flexible Header Auto-Detection**: Scans uploaded Excel (`.xlsx`, `.xls`, `.csv`) or linked Google Sheets to automatically detect header rows (skipping empty rows or titles).
- **Fuzzy Column Variant Mapping**: Normalizes common variations in column headers into standardized schema fields:
  - `"Sales & Revenue"` ← `["sales", "revenue", "income", "turnover", "sales/revenue"]`
  - `"Capex Investment"` ← `["capax", "capex", "capital investment", "capital expenditure"]`
  - `"R&D Expense"` ← `["r&d exp.", "r&d expense", "research & development"]`
  - `"Salary / Wages"` ← `["salaries & wages", "payroll", "employee expense"]`
  - `"Profit & Loss"` ← `["p&l", "net profit", "profit / loss"]`
- **Data Sanitization**: Strips currency symbols (`$`, `₹`, `,`), converts parenthetical negative numbers (e.g. `(15,000)` → `-15000`), and sanitizes string inputs against formula injection.

### 2. Cell-Level AES-256-GCM Encryption
- Before storing financial row data in the database, each cell value is individually encrypted using **AES-256-GCM** with 96-bit Random IVs and Authentication Tags.
- Even if the database file (`data.db`) is accessed directly, sensitive numbers (payroll, revenue, bank balances) remain encrypted at rest.

### 3. Role-Based Access Control (RBAC) & Whitelisting
- **Admin Whitelist Enforcement**: Only users whose email addresses have been approved/whitelisted by an Admin (or invited by a Workspace Owner) can sign in.
- **Granular Member Roles**:
  - **OWNER**: Complete control over the workspace, spreadsheet sync settings, member management, and workspace deletion.
  - **EDITOR**: Can update dashboard configuration, sync data, and manage spreadsheet content.
  - **VIEWER**: Read-only access to visual analytics, charts, and metrics summaries.

### 4. Multi-Tenant Workspaces & Executive CEO Dashboard
- **Workspace Dashboards**: Users can create distinct financial workspaces tied to specific projects, business units, or clients.
- **CEO / Executive Dashboard**: Consolidates global batch data across multiple companies or business entities into unified financial metrics with automated text analysis.

---

## 🛠️ Tech Stack

### Frontend
- **Framework**: [React 19](https://react.dev/) + [Vite 8](https://vitejs.dev/)
- **Routing**: [React Router DOM v7](https://reactrouter.com/)
- **Authentication**: [@react-oauth/google](https://www.npmjs.com/package/@react-oauth/google) (Google OAuth 2.0 Integration)
- **Data Visualization**: [Recharts v3](https://recharts.org/) (Bar charts, line trends, pie charts, metric cards)
- **Icons**: [Lucide React](https://lucide.dev/)
- **HTTP Client**: [Axios](https://axios-http.com/) (with JWT request interceptors)
- **Parsing**: [SheetJS (xlsx)](https://sheetjs.com/)
- **Styling**: Modern Vanilla CSS Design System with dark mode support, glassmorphism, responsive grid layouts, and custom animations.

### Backend
- **Runtime**: Node.js (CommonJS)
- **Server Framework**: [Express 4](https://expressjs.com/)
- **Database**: [Better-SQLite3](https://github.com/WiseLibs/better-sqlite3) (Configured with WAL mode and foreign key enforcement)
- **Authentication & Security**:
  - Google Auth Library (`google-auth-library`) for Google ID & Access Token verification
  - JSON Web Tokens (`jsonwebtoken`) for authenticated user sessions
  - Node `crypto` for AES-256-GCM authenticated cell encryption
  - [Helmet](https://helmetjs.github.io/) for HTTP security headers
  - [CORS](https://expressjs.com/en/resources/middleware/cors.html) configured for frontend origin protection
- **File Uploads**: [Multer](https://github.com/expressjs/multer) & [XLSX](https://www.npmjs.com/package/xlsx) parser

---

## 🚀 Getting Started

Follow these instructions to set up and run Ledgerly locally on your system.

### Prerequisites
- **Node.js**: `v18.0.0` or higher
- **npm**: `v9.0.0` or higher
- **Google OAuth Client ID**: Obtained from [Google Cloud Console](https://console.cloud.google.com/) for Google Sign-In authentication.

---

### 1. Environment Setup

#### Backend Environment Variables
Create a file named `.env` in the `backend/` directory:

```env
# Backend Server Port
PORT=4000

# Frontend URL (for CORS allowance)
FRONTEND_URL=http://localhost:5173

# Google OAuth Client ID (must match Google Cloud Console settings)
GOOGLE_CLIENT_ID=your_google_client_id_here.apps.googleusercontent.com

# JWT Secret Key for Session Tokens
JWT_SECRET=super_secret_jwt_key_change_in_production

# Encryption Key for AES-256-GCM (64 hex characters / 32 bytes)
ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef

# Default System Admin Email Address
ADMIN_EMAIL=admin@yourdomain.com
```

#### Frontend Environment Variables
Create a file named `.env` in the `frontend/` directory:

```env
# Backend API Base URL
VITE_API_URL=http://localhost:4000

# Google OAuth Client ID
VITE_GOOGLE_CLIENT_ID=your_google_client_id_here.apps.googleusercontent.com
```

---

### 2. Installation & Running Locally

#### Step A: Start the Backend Server

```bash
# 1. Navigate to backend directory
cd backend

# 2. Install backend dependencies
npm install

# 3. Start development server with auto-reload
npm run dev
```

The backend server will run on **`http://localhost:4000`** and automatically create the SQLite database at `backend/data.db`.

#### Step B: Start the Frontend Application

In a new terminal window:

```bash
# 1. Navigate to frontend directory
cd frontend

# 2. Install frontend dependencies
npm install

# 3. Start Vite development server
npm run dev
```

The frontend application will be available at **`http://localhost:5173`**.

---

## 🔑 Initial Admin & User Access Flow

1. Set your email in `backend/.env` under `ADMIN_EMAIL`.
2. When you log in with Google using that email address, the system automatically assigns you the **`admin`** role with upload permissions.
3. As an Admin, you can access the **Admin Dashboard** (`/admin`) to whitelist team members, approve pending users, and grant workspace permissions.
4. Non-admin users whose email is added to the Whitelist or invited to a Workspace Dashboard can log in and immediately access their designated dashboards.

---

## 📁 Directory Structure

```text
FinancialApp/
├── backend/
│   ├── src/
│   │   ├── db/
│   │   │   └── database.js          # SQLite Schema, WAL initialization & migrations
│   │   ├── middleware/
│   │   │   ├── auth.js              # JWT verification middleware
│   │   │   ├── rbac.js              # Role-Based Access Control middleware
│   │   │   └── upload.js            # Multer file upload setup
│   │   ├── routes/
│   │   │   ├── admin.js             # User whitelist & admin controls
│   │   │   ├── auth.js              # Google OAuth token verification & JWT issuance
│   │   │   ├── dashboard.js         # Workspace CRUD, membership & permissions
│   │   │   └── user.js              # Financial data upload, parsing & retrieval
│   │   ├── utils/
│   │   │   ├── crypto.js            # AES-256-GCM cell-level encryption / decryption
│   │   │   ├── formatters.js        # Number & date formatting utilities
│   │   │   ├── googleSheets.js      # Public Google Sheet fetcher
│   │   │   └── sheetParser.js       # XLSX header normalization & cleaner
│   │   └── index.js                 # Express application entry point
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── components/              # WorkspaceSidebar, TeamManagement, ProtectedRoute
│   │   ├── context/                 # AuthContext & API Axios instance
│   │   ├── hooks/                   # Custom application hooks
│   │   ├── pages/                   # UserDashboard, AdminDashboard, CEODashboard, Login, Signup
│   │   ├── App.jsx                  # Main routing & layout structure
│   │   ├── main.jsx                 # Entry point with GoogleOAuthProvider & AuthProvider
│   │   └── index.css                # Core design system & theme variables
│   ├── package.json
│   └── vite.config.js
└── README.md                        # Project documentation
```

---

## 🔌 API Endpoints Summary

| Method | Endpoint | Access Level | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/google` | Public | Authenticate user via Google ID Token |
| `POST` | `/api/auth/google-token` | Public | Authenticate user via Google Access Token |
| `GET` | `/api/dashboards` | Authenticated | List workspaces owned or joined by user |
| `POST` | `/api/dashboards` | Authenticated | Create a new financial workspace |
| `GET` | `/api/dashboards/:id` | Viewer+ | Get workspace details and user role |
| `PUT` | `/api/dashboards/:id` | Editor+ | Update workspace metadata & sheet URL |
| `DELETE` | `/api/dashboards/:id` | Owner | Delete financial workspace |
| `GET` | `/api/dashboards/:id/members` | Viewer+ | List workspace members and invites |
| `POST` | `/api/dashboards/:id/invite` | Owner | Invite user by email to workspace |
| `POST` | `/api/user/upload` | Upload Access | Upload and parse financial Excel spreadsheet |
| `POST` | `/api/user/sync-sheet` | Upload Access | Sync spreadsheet data from Google Sheet URL |
| `GET` | `/api/admin/whitelist` | Admin | List whitelisted email addresses |
| `POST` | `/api/admin/whitelist` | Admin | Add email address to whitelist |
| `DELETE` | `/api/admin/whitelist/:id` | Admin | Remove email from whitelist |

---

## 🛡️ Security Best Practices

- **Cell-Level Encryption**: All numeric and text financial metrics are encrypted using `AES-256-GCM` before being written to SQLite.
- **Security Headers**: Express server uses `helmet()` for securing HTTP headers against common vulnerabilities.
- **Formula Injection Prevention**: Input sanitization strips spreadsheet formula prefixes (`=`, `+`, `-`, `@`) from string fields.
- **Prepared Statements**: SQLite queries use parameter binding (`better-sqlite3` prepared statements) to completely eliminate SQL Injection risks.
- **Strict CORS**: Cross-Origin requests are restricted to the configured `FRONTEND_URL`.

---

## 📄 License

This project is licensed under the **MIT License**.
