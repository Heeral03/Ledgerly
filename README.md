# Ledgerly

Ledgerly is a multi-tenant financial analytics and spreadsheet ingestion platform. It connects to Google Sheets (or accepts Excel/CSV uploads), parses and validates accounting records, and presents CEO-readable visual dashboards with role-based workspace permissions.

## Core Features

- Google OAuth 2.0 authentication with JWT session management.
- Multi-tenant workspace model with role-based access control (OWNER, EDITOR, VIEWER).
- Intelligent spreadsheet header parsing with fuzzy dictionary matching.
- Accounting rule validation (balance invariants, missing category flags, and statistical spike detection).
- Two-phase import pipeline (staging area -> accounting validation -> atomic ledger commit).
- Executive visual dashboard displaying Revenue, Expenses, Net Profit, MoM Growth, and Cash Runway.
- Rate-limited manual sheet synchronisation.

## System Pipeline Architecture

1. User connects Google Account or uploads an Excel/CSV file.
2. File data is parsed and normalized into standard accounting categories.
3. Raw data is stored in a staging schema and validated against accounting balance rules.
4. Validated records are committed to the primary ledger inside an atomic database transaction.
5. Dashboards read exclusively from committed database records and cached aggregates.

## Setup and Running

### Prerequisites

- Node.js v18+
- npm v9+

### Backend Setup

```bash
cd backend
npm install
npm start
```

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

### Running Tests

```bash
cd backend
npm test
```

## License

MIT License
