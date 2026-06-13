const Papa = require('papaparse');

/**
 * Parses raw CSV string or buffer, standardizes headers to lowercase, and strips whitespaces.
 * @param {string|Buffer} csvContent String or Buffer content of the uploaded CSV file.
 * @returns {Array} Array of parsed rows with normalized keys and values.
 */
function parseCsv(csvContent) {
  const contentStr = typeof csvContent === 'string' ? csvContent : csvContent.toString('utf-8');

  // Strip Byte Order Mark (BOM) if present
  const sanitizedStr = contentStr.replace(/^\uFEFF/, '');

  const result = Papa.parse(sanitizedStr, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (header) => {
      return header
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9_]/g, '_') // Normalize headers: alphabets, numbers, and underscores only
        .replace(/_+/g, '_')         // Replace consecutive underscores with a single underscore
        .replace(/(^_+|_+$)/g, '');  // Trim leading/trailing underscores
    },
    transform: (value) => {
      return value.trim();
    }
  });

  if (result.errors && result.errors.length > 0) {
    console.warn('PapaParse encountered parsing warnings/errors:', result.errors);
  }

  return result.data;
}

module.exports = { parseCsv };
