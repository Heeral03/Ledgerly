/**
 * Converts a standard or published Google Sheets URL to an export URL.
 * @param {string} url - The Google Sheets URL.
 * @returns {string} The export URL or the original if not a Google Sheet.
 */
function getGoogleSheetsExportUrl(url) {
  if (!url || typeof url !== 'string' || !url.includes('docs.google.com/spreadsheets')) return url;
  
  // If already a direct export or published output URL, return as-is
  if (url.includes('/export?') || url.includes('/pub?')) {
    return url;
  }

  // Published to web format: /d/e/2PACX-1v.../pubhtml or /pub
  const pubMatch = url.match(/\/d\/e\/([a-zA-Z0-9-_]+)/);
  if (pubMatch && pubMatch[1]) {
    return `https://docs.google.com/spreadsheets/d/e/${pubMatch[1]}/pub?output=xlsx`;
  }

  // Standard sheet URL: /d/SPREADSHEET_ID/...
  const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1] && match[1] !== 'e') {
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
