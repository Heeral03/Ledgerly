const db = require('../db/database');
const { decryptCell } = require('../utils/crypto');

/**
 * Pure Deterministic Financial Metrics Calculation Engine
 */

function calculateRevenue(records) {
  return records
    .filter(r => /sales|revenue|income|turnover/i.test(r.category))
    .reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
}

function calculateExpenses(records) {
  return records
    .filter(r => /expense|salary|wages|payroll|capex|cost|rent/i.test(r.category))
    .reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
}

function calculateNetProfit(revenue, expenses) {
  return revenue - expenses;
}

function calculateMoMGrowth(currentValue, previousValue) {
  if (!previousValue || previousValue === 0) {
    return { value: 0, dataQuality: 'INSUFFICIENT_HISTORICAL_DATA' };
  }
  const growth = (currentValue - previousValue) / previousValue;
  return {
    metric: 'mom_revenue_growth',
    value: Number(growth.toFixed(4)),
    formula: '(current_revenue - previous_revenue) / previous_revenue',
    currentRevenue: currentValue,
    previousRevenue: previousValue,
    dataQuality: 'VALID',
  };
}

function calculateCashRunway(bankCash, monthlyBurn) {
  if (!monthlyBurn || monthlyBurn <= 0) {
    return { metric: 'cash_runway_months', value: 999, dataQuality: 'NET_POSITIVE_CASH_FLOW' };
  }
  const runway = bankCash / monthlyBurn;
  return {
    metric: 'cash_runway_months',
    value: Number(runway.toFixed(1)),
    formula: 'bank_and_cash_reserve / net_monthly_burn_rate',
    cashReserve: bankCash,
    monthlyBurn: monthlyBurn,
    dataQuality: 'VALID',
  };
}

/**
 * Fetch financial records for workspace & period, decrypt amounts, and compute all deterministic metrics.
 */
function computeWorkspaceMetrics(workspaceId, period) {
  const records = db.prepare(`
    SELECT * FROM financial_records WHERE workspace_id = ? AND period = ?
  `).all(workspaceId, period);

  // Decrypt cell amounts
  const decryptedRecords = records.map(r => {
    let amount = 0;
    try {
      amount = parseFloat(decryptCell(r.encrypted_amount, r.iv, r.auth_tag)) || 0;
    } catch (e) {
      amount = 0;
    }
    return { ...r, amount };
  });

  const revenue = calculateRevenue(decryptedRecords);
  const expenses = calculateExpenses(decryptedRecords);
  const netProfit = calculateNetProfit(revenue, expenses);

  // Fetch previous period for MoM calculation
  const prevPeriod = getPreviousPeriod(period);
  const prevRecords = db.prepare(`
    SELECT * FROM financial_records WHERE workspace_id = ? AND period = ?
  `).all(workspaceId, prevPeriod);

  const prevDecrypted = prevRecords.map(r => {
    try { return { ...r, amount: parseFloat(decryptCell(r.encrypted_amount, r.iv, r.auth_tag)) || 0 }; }
    catch(e) { return { ...r, amount: 0 }; }
  });
  const prevRevenue = calculateRevenue(prevDecrypted);
  const momGrowth = calculateMoMGrowth(revenue, prevRevenue);

  const metricsResult = {
    workspaceId,
    period,
    metrics: {
      revenue: { value: revenue, formula: 'SUM(category LIKE sales|revenue|income)' },
      expenses: { value: expenses, formula: 'SUM(category LIKE expense|salary|capex)' },
      netProfit: { value: netProfit, formula: 'revenue - expenses' },
      momRevenueGrowth: momGrowth,
    },
    dataQuality: decryptedRecords.length > 0 ? 'VALID' : 'NO_RECORDS_FOR_PERIOD',
    recordCount: decryptedRecords.length,
  };

  // Upsert into normalized_metrics table for fast querying
  const insertMetric = db.prepare(`
    INSERT INTO normalized_metrics (workspace_id, period, metric_name, value, metadata_json)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(workspace_id, period, metric_name) DO UPDATE SET
      value = excluded.value,
      metadata_json = excluded.metadata_json
  `);

  insertMetric.run(workspaceId, period, 'revenue', revenue, JSON.stringify({ formula: 'SUM(revenue)' }));
  insertMetric.run(workspaceId, period, 'expenses', expenses, JSON.stringify({ formula: 'SUM(expenses)' }));
  insertMetric.run(workspaceId, period, 'net_profit', netProfit, JSON.stringify({ formula: 'revenue - expenses' }));
  insertMetric.run(workspaceId, period, 'mom_revenue_growth', momGrowth.value || 0, JSON.stringify(momGrowth));

  return metricsResult;
}

function getPreviousPeriod(periodStr) {
  // Simple format e.g. "2026-05" -> "2026-04"
  const [year, month] = periodStr.split('-').map(Number);
  if (!year || !month) return periodStr;
  if (month === 1) return `${year - 1}-12`;
  const pMonth = String(month - 1).padStart(2, '0');
  return `${year}-${pMonth}`;
}

module.exports = {
  calculateRevenue,
  calculateExpenses,
  calculateNetProfit,
  calculateMoMGrowth,
  calculateCashRunway,
  computeWorkspaceMetrics,
};
