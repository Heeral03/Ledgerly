/**
 * Converts a standard Google Sheets URL to an .xlsx export URL.
 * @param {string} url - The Google Sheets URL.
 * @returns {string} The export URL or the original if not a Google Sheet.
 */
function getGoogleSheetsExportUrl(url) {
  if (!url || !url.includes('docs.google.com/spreadsheets')) return url;
  
  // Extract spreadsheet ID
  const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=xlsx`;
  }
  
  return url;
}

/**
 * Validates if a string is a potentially valid Google Sheets URL.
 * @param {string} url 
 * @returns {boolean}
 */
function isValidGoogleSheetsUrl(url) {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    return parsed.hostname.includes('docs.google.com');
  } catch (err) {
    return false;
  }
}

module.exports = { getGoogleSheetsExportUrl, isValidGoogleSheetsUrl };
