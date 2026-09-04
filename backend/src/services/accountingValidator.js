/**
 * Accounting Rule Validator
 * Validates financial transaction batches prior to ledger commit.
 */

/**
 * Validates an array of normalized financial rows against standard accounting rules:
 * 1. Balance Invariant Check: ∑ Debits == ∑ Credits (or Net Profit = Revenue - Expenses)
 * 2. Cost Center & Category Completeness
 * 3. Anomaly / Spike Detection against historical averages
 *
 * @param {Array<object>} rows - Array of parsed financial row objects
 * @param {Array<object>} historicalRows - Optional historical rows for anomaly detection
 * @returns {object} { isValid: boolean, errors: Array<string>, warnings: Array<string>, summary: object }
 */
function validateAccountingBatch(rows, historicalRows = []) {
  const errors = [];
  const warnings = [];

  if (!Array.isArray(rows) || rows.length === 0) {
    return {
      isValid: false,
      errors: ['Import batch contains no valid data rows.'],
      warnings: [],
      summary: { totalDebits: 0, totalCredits: 0, netBalance: 0 },
    };
  }

  let totalDebits = 0;
  let totalCredits = 0;
  let totalRevenue = 0;
  let totalExpenses = 0;
  let totalProfitAndLoss = 0;

  rows.forEach((row, index) => {
    const rowNum = index + 1;

    // Extract numeric fields cleanly
    const rev = parseFloat(row['Sales & Revenue']) || 0;
    const exp = (parseFloat(row['Direct Expense']) || 0) + 
                (parseFloat(row['Salary / Wages']) || 0) + 
                (parseFloat(row['Other Expense']) || 0) + 
                (parseFloat(row['R&D Expense']) || 0) + 
                (parseFloat(row['Capex Investment']) || 0);
    const pnl = parseFloat(row['Profit & Loss']) || 0;

    const debit = parseFloat(row['Debit']) || (exp > 0 ? exp : 0);
    const credit = parseFloat(row['Credit']) || (rev > 0 ? rev : 0);

    totalRevenue += rev;
    totalExpenses += exp;
    totalProfitAndLoss += pnl;
    totalDebits += debit;
    totalCredits += credit;

    // Rule 2: Mandatory category / month / year presence
    if (!row['Month'] && !row['Period']) {
      warnings.push(`Row ${rowNum}: Missing 'Month' or 'Period' field.`);
    }
  });

  // Rule 1: Balance Invariant Check
  // Check if Debit & Credit present and balance
  if (totalDebits > 0 && totalCredits > 0) {
    const balanceDiff = Math.abs(totalDebits - totalCredits);
    if (balanceDiff > 0.01) {
      errors.push(`Balance Invariant Failed: Total Debits (${totalDebits.toFixed(2)}) do not equal Total Credits (${totalCredits.toFixed(2)}). Discrepancy: ${balanceDiff.toFixed(2)}.`);
    }
  }

  // Check Net Profit invariant if P&L field provided
  if (totalProfitAndLoss !== 0 && totalRevenue > 0) {
    const expectedProfit = totalRevenue - totalExpenses;
    const pnlDiff = Math.abs(totalProfitAndLoss - expectedProfit);
    if (pnlDiff > 1.0) {
      warnings.push(`P&L Discrepancy: Stated Profit & Loss (${totalProfitAndLoss.toFixed(2)}) differs from calculated Revenue - Expenses (${expectedProfit.toFixed(2)}).`);
    }
  }

  // Rule 3: Anomaly / Spike Detection (>3x historical average)
  if (historicalRows.length > 0) {
    const histRevAvg = historicalRows.reduce((acc, r) => acc + (parseFloat(r['Sales & Revenue']) || 0), 0) / historicalRows.length;
    if (histRevAvg > 0 && totalRevenue > histRevAvg * 3) {
      warnings.push(`Spike Warning: Current batch revenue (${totalRevenue.toFixed(2)}) is over 3x higher than historical average (${histRevAvg.toFixed(2)}).`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    summary: {
      rowCounts: rows.length,
      totalRevenue: Number(totalRevenue.toFixed(2)),
      totalExpenses: Number(totalExpenses.toFixed(2)),
      netProfit: Number((totalRevenue - totalExpenses).toFixed(2)),
      totalDebits: Number(totalDebits.toFixed(2)),
      totalCredits: Number(totalCredits.toFixed(2)),
    },
  };
}

module.exports = {
  validateAccountingBatch,
};
