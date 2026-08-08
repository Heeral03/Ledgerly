const XLSX = require('xlsx');

// Standard header mapping definitions
const HEADER_MAPPINGS = {
  'Company': ['company', 'company name', 'entity', 'business'],
  'Month': ['month', 'period', 'mo', 'month/period', 'mnth'],
  'Year': ['year', 'yr', 'fy', 'financial year'],
  'Sales & Revenue': [
    'sales & revenue', 'sales', 'revenue', 'income', 'sales/revenue',
    'turnover', 'total sales', 'sales & revenue exp.', 'sales and revenue'
  ],
  'Capex Investment': [
    'capax investment', 'capax', 'capex investment', 'capex',
    'capital investment', 'capital expenditure', 'capax investment '
  ],
  'R&D Expense': [
    'r& d exp.', 'r&d exp.', 'r & d exp.', 'r&d expense', 'r&d', 'r & d',
    'research & development', 'r& d', 'r & d exp', 'r&d exp'
  ],
  'Direct Expense': [
    'direct exp.', 'direct exp', 'direct expense', 'direct expenses',
    'cogs', 'direct cost', 'direct exp '
  ],
  'Salary / Wages': [
    'salary / wages exp.', 'salary / wages', 'salaries & wages',
    'salary', 'wages', 'salary & wages', 'payroll', 'employee expense',
    'salary/wages'
  ],
  'Other Expense': [
    'other exp.', 'other exp', 'other expense', 'other expenses',
    'admin expense', 'misc expense', 'other exp '
  ],
  'Profit & Loss': [
    'profit & loss', 'profit & loass', 'profit / loss', 'p&l', 'p & l',
    'net profit', 'profit', 'loss', 'loass', 'profit & loss exp.'
  ],
  'Receivable': [
    'receivable', 'receivables', 'receivable ', 'trade receivables',
    'accounts receivable'
  ],
  'Payable': [
    'payable', 'payables', 'payable ', 'trade payables',
    'accounts payable'
  ],
  'Bank & Cash': [
    'bank & cash fund', 'bank & cash', 'bank and cash', 'cash & bank',
    'cash fund', 'bank', 'cash', 'bank & cash fund '
  ],
  'Unsecured Loan': [
    'unsecure loan', 'unsecured loan', 'unsecured loans', 'unsecure',
    'unsecured', 'unsecured borrowing'
  ],
  'Bank Loan': [
    'bank loan', 'bank loans', 'secured loan', 'loan from bank'
  ]
};

const NUMERIC_FIELDS = new Set([
  'Sales & Revenue', 'Capex Investment', 'R&D Expense', 'Direct Expense',
  'Salary / Wages', 'Other Expense', 'Profit & Loss', 'Receivable',
  'Payable', 'Bank & Cash', 'Unsecured Loan', 'Bank Loan'
]);

/**
 * Normalizes a raw column header string to standard column name.
 */
function normalizeHeader(rawHeader) {
  if (!rawHeader) return null;
  const clean = String(rawHeader).trim();
  if (!clean || /^__EMPTY/i.test(clean)) return null;

  const lower = clean.toLowerCase();

  for (const [standardKey, variants] of Object.entries(HEADER_MAPPINGS)) {
    for (const variant of variants) {
      if (lower === variant || lower === variant.trim()) {
        return standardKey;
      }
    }
  }

  // Secondary partial match check
  for (const [standardKey, variants] of Object.entries(HEADER_MAPPINGS)) {
    for (const variant of variants) {
      const v = variant.trim();
      if (v.length >= 4 && lower.includes(v)) {
        return standardKey;
      }
    }
  }

  return clean; // Return original trimmed header if no standard variant matched
}

/**
 * Cleans individual cell values for storage and frontend consumption.
 */
function cleanCellValue(val, isNumeric = false) {
  if (val === null || val === undefined) {
    return isNumeric ? 0 : '';
  }

  if (typeof val === 'number') {
    return isNaN(val) ? 0 : val;
  }

  let str = String(val).trim();
  if (str === '' || str.toLowerCase() === 'null' || str.toLowerCase() === 'undefined') {
    return isNumeric ? 0 : '';
  }

  if (isNumeric) {
    const isNegative = str.startsWith('(') && str.endsWith(')');
    if (isNegative) str = str.slice(1, -1);
    const cleanedNum = str.replace(/[,₹$\s]/g, '');
    const num = parseFloat(cleanedNum);
    if (isNaN(num)) return 0;
    return isNegative ? -num : num;
  }

  // Strip formula prefixes for string cells
  return str.replace(/^[=+\-@]/, "'$&");
}

/**
 * Parses an XLSX sheet into clean JSON rows with header row auto-detection and variant normalization.
 * @param {object} sheet - XLSX sheet object
 * @returns {Array<object>} Cleaned rows
 */
function parseSheetToRows(sheet) {
  if (!sheet || !sheet['!ref']) return [];

  // Read raw 2D array matrix of values
  const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  if (!rawRows || !rawRows.length) return [];

  // Find the header row by searching top 15 rows for header keywords
  let headerRowIdx = -1;
  const keywords = ['month', 'company', 'sales', 'revenue', 'capax', 'capex', 'profit', 'bank', 'exp', 'loan', 'year'];

  for (let i = 0; i < Math.min(rawRows.length, 15); i++) {
    const row = rawRows[i];
    if (Array.isArray(row)) {
      const matchCount = row.filter(cell => {
        if (!cell) return false;
        const s = String(cell).toLowerCase().trim();
        return keywords.some(k => s.includes(k));
      }).length;

      if (matchCount >= 2) {
        headerRowIdx = i;
        break;
      }
    }
  }

  // Fallback to row 0 if no header row was detected
  if (headerRowIdx === -1) headerRowIdx = 0;

  const rawHeaders = rawRows[headerRowIdx] || [];
  const columnMap = []; // Array of { colIndex, standardKey, isNumeric }

  rawHeaders.forEach((header, colIndex) => {
    const standardKey = normalizeHeader(header);
    if (standardKey && !/^__EMPTY/i.test(standardKey)) {
      columnMap.push({
        colIndex,
        standardKey,
        isNumeric: NUMERIC_FIELDS.has(standardKey)
      });
    }
  });

  if (!columnMap.length) return [];

  const cleanedRows = [];
  const dataRows = rawRows.slice(headerRowIdx + 1);

  for (const rawRow of dataRows) {
    if (!Array.isArray(rawRow)) continue;

    const rowObj = {};
    let hasValidData = false;

    for (const col of columnMap) {
      const rawVal = rawRow[col.colIndex];
      const cleanedVal = cleanCellValue(rawVal, col.isNumeric);
      rowObj[col.standardKey] = cleanedVal;

      if (cleanedVal !== '' && cleanedVal !== 0 && cleanedVal !== null) {
        hasValidData = true;
      }
    }

    if (hasValidData) {
      cleanedRows.push(rowObj);
    }
  }

  return cleanedRows;
}

module.exports = {
  HEADER_MAPPINGS,
  NUMERIC_FIELDS,
  normalizeHeader,
  cleanCellValue,
  parseSheetToRows
};
