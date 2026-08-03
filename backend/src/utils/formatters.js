const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

/**
 * Formats a month/year combination into a clear label.
 * @param {string|number} month - Month number (1-12) or string.
 * @param {string|number} year - Year number or string.
 * @returns {string} Formatted label (e.g., "April 2024")
 */
function formatRowLabel(month, year) {
  let m = String(month || '').trim().toLowerCase();
  let y = String(year || '').trim();

  // Handle numeric months
  const monthIdx = parseInt(m);
  if (!isNaN(monthIdx) && monthIdx >= 1 && monthIdx <= 12) {
    m = MONTHS[monthIdx - 1];
  } else {
    // Basic title casing for month strings
    m = m.charAt(0).toUpperCase() + m.slice(1);
  }

  if (y && y !== '—' && y !== '-') {
    return `${m} ${y}`.trim();
  }
  return m || '—';
}

module.exports = { formatRowLabel, MONTHS };
