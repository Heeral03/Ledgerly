const path = require('path');
const XLSX = require(path.join(__dirname, 'backend/node_modules/xlsx'));
const { parseSheetToRows } = require('./backend/src/utils/sheetParser');

const headers = [
  'Company', 'Month', 'Year', 'Sales & Revenue', 'Capax Investment',
  'R& D Exp.', 'Direct Exp.', 'Salary / Wages Exp.', 'Other Exp.',
  'Profit & Loss', '', 'Receivable ', 'Payable ', 'Bank & Cash fund',
  'Unsecure Loan', 'Bank Loan'
];

const row1 = ['Sarthak', 4, 2026, 0, 650000, 350000, 657500, 115000, 115000, -1887500, '', 0, 5525000, 165200, 500000, 0];
const row2 = ['Sarthak', 5, 2026, 0, 75000, 51000, 751000, 115000, 126000, -1118000, '', 0, 1050000, 201500, 5000000, 0];

const sheetData = [
  ['Financial Report Header Title'],
  [],
  headers,
  row1,
  row2
];

const workbook = XLSX.utils.book_new();
const sheet = XLSX.utils.aoa_to_sheet(sheetData);
XLSX.utils.book_append_sheet(workbook, sheet, 'Sarthak');

const parsed = parseSheetToRows(sheet);
console.log('--- PARSED ROWS COUNT ---');
console.log(parsed.length);

console.log('--- PARSED ROW 0 KEYS ---');
console.log(Object.keys(parsed[0]));

console.log('--- PARSED ROW 0 DATA ---');
console.log(parsed[0]);

console.log('--- PARSED ROW 1 DATA ---');
console.log(parsed[1]);

const hasEmptyKey = Object.keys(parsed[0]).some(k => /^__EMPTY/i.test(k));
if (!hasEmptyKey && parsed[0]['Capex Investment'] === 650000 && parsed[0]['R&D Expense'] === 350000 && parsed[0]['Direct Expense'] === 657500) {
  console.log('VERIFICATION SUCCESS: Sheet parser correctly mapped all standard fields without __EMPTY columns!');
} else {
  console.error('VERIFICATION FAILURE: Unexpected parsed data structure.');
  process.exit(1);
}
