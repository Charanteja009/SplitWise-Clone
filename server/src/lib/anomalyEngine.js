const { createHash } = require('crypto');

/**
 * Robust date normalizer using multiple regex patterns to format variations into standard Date.
 * Supports: YYYY-MM-DD, DD-MM-YYYY, MM/DD/YYYY, YYYY/MM/DD, and standard ISO formats.
 */
function normalizeDate(dateStr) {
  if (!dateStr) return null;
  
  const cleanStr = dateStr.trim();
  
  // Try standard Date parsing first (handles ISO strings)
  const directDate = new Date(cleanStr);
  if (!isNaN(directDate.getTime())) {
    return directDate;
  }

  // Regex 1: DD/MM/YYYY or DD-MM-YYYY
  const ddMmYyyy = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/;
  let match = cleanStr.match(ddMmYyyy);
  if (match) {
    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1; // 0-indexed month
    const year = parseInt(match[3], 10);
    const date = new Date(year, month, day);
    if (!isNaN(date.getTime())) return date;
  }

  // Regex 2: MM/DD/YYYY or MM-DD-YYYY
  const mmDdYyyy = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/;
  match = cleanStr.match(mmDdYyyy);
  if (match) {
    const month = parseInt(match[1], 10) - 1;
    const day = parseInt(match[2], 10);
    const year = parseInt(match[3], 10);
    if (month >= 0 && month < 12 && day > 0 && day <= 31) {
      const date = new Date(year, month, day);
      if (!isNaN(date.getTime())) return date;
    }
  }

  // Regex 3: YYYY/MM/DD
  const yyyyMmDd = /^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/;
  match = cleanStr.match(yyyyMmDd);
  if (match) {
    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1;
    const day = parseInt(match[3], 10);
    const date = new Date(year, month, day);
    if (!isNaN(date.getTime())) return date;
  }

  return null;
}

/**
 * Computes the deterministic hash ID for Anomaly 7.
 */
function computeDeterministicHash(dateStr, amountCents, paidBy, description) {
  const hashString = `${dateStr.trim()}_${amountCents}_${paidBy.trim().toLowerCase()}_${description.trim()}`;
  return createHash('md5').update(hashString).digest('hex');
}

/**
 * Parses raw split string e.g., "Aisha:50; Rohan:50" or "Aisha:10; Sam:20"
 */
function parseCsvSplits(splitsStr) {
  if (!splitsStr || splitsStr.trim() === '') return [];
  
  return splitsStr
    .split(/[;,]/)
    .map((s) => {
      const match = s.trim().match(/^([A-Za-z\s_]+?)(?::|\s+)?(\d+(?:\.\d+)?)\s*%?$/);
      if (!match) return null;
      const name = match[1].trim();
      const value = parseFloat(match[2]);
      if (!name || isNaN(value)) return null;
      return { name, value };
    })
    .filter((item) => item !== null);
}

/**
 * Parses raw participant string e.g., "Aisha, Rohan, Priya"
 */
function parseCsvParticipants(participantsStr) {
  if (!participantsStr || participantsStr.trim() === '') return [];
  return participantsStr
    .split(/[;,]/)
    .map((p) => p.trim())
    .filter((p) => p !== '');
}

/**
 * Validates a parsed row against our 12 data validation filters.
 * Returns the classification, sanitized data, and any caught anomalies.
 */
function evaluateAnomaly(row, registeredUserNames, existingExpenseIds, batchSeenIds) {
  const anomalies = [];
  const quarantineReason = [];
  let shouldInsert = true;
  let status = 'ACTIVE';

  // 1. Core Structural Header Verification
  const rawDate = row.date;
  const rawAmount = row.amount;
  const rawPaidBy = row.paid_by;
  const rawDescription = row.description;

  // 2. Anomaly 2: Zero Amount Check (Hard Fail)
  const parsedAmount = parseFloat(rawAmount);
  if (isNaN(parsedAmount) || parsedAmount === 0) {
    anomalies.push('ZERO_AMOUNT');
    return {
      shouldInsert: false,
      quarantineReason: ['Zero or NaN amount is not allowed. Row blocked.'],
      status: 'ACTIVE',
      sanitizedData: {
        id: '',
        description: rawDescription || '',
        amountCents: 0,
        originalAmountCents: null,
        originalCurrency: null,
        isRefund: false,
        date: new Date(),
        paidByName: rawPaidBy || '',
        splitType: 'EQUAL',
        rawSplits: [],
        rawParticipants: [],
        anomalies
      }
    };
  }

  // 3. Anomaly 1: Negative Amount Check (Auto-resolve to absolute, flag Refund)
  let isRefund = false;
  let amountVal = parsedAmount;
  if (amountVal < 0) {
    amountVal = Math.abs(amountVal);
    isRefund = true;
    anomalies.push('NEGATIVE_AMOUNT');
  }

  // Convert amount to cents (avoiding binary floating point representation issues)
  let amountCents = Math.round(amountVal * 100);

  // 4. Anomaly 3: Empty Description Check (Auto-resolve)
  let description = rawDescription || '';
  if (!description.trim()) {
    description = 'Imported Uncategorized Expense';
    anomalies.push('EMPTY_DESCRIPTION');
  }

  // 5. Anomaly 5: Invalid Date Format (Auto-resolve via regex)
  let dateObj = normalizeDate(rawDate);
  if (!dateObj) {
    anomalies.push('INVALID_DATE');
    return {
      shouldInsert: false,
      quarantineReason: [`Invalid date format: "${rawDate}". Date format failed parsing filters.`],
      status: 'ACTIVE',
      sanitizedData: {
        id: '',
        description,
        amountCents,
        originalAmountCents: null,
        originalCurrency: null,
        isRefund,
        date: new Date(),
        paidByName: rawPaidBy || '',
        splitType: 'EQUAL',
        rawSplits: [],
        rawParticipants: [],
        anomalies
      }
    };
  }

  // 6. Anomaly 4: Future Date (Quarantine)
  const now = new Date();
  if (dateObj.getTime() > now.getTime()) {
    anomalies.push('FUTURE_DATE');
    quarantineReason.push(`Future date detected: "${rawDate}". Transaction is quarantined.`);
    status = 'PENDING_APPROVAL';
  }

  // 7. Anomaly 6: Currency Discrepancies (Auto-resolve: Convert USD -> INR with rate 83)
  const currencyColumn = row.currency ? row.currency.trim().toUpperCase() : null;
  const hasTripKeyword = description.toLowerCase().includes('trip');
  const hasDollarSign = description.includes('$');
  const isUsd = currencyColumn === 'USD' || hasDollarSign || hasTripKeyword;

  let originalAmountCents = null;
  let originalCurrency = null;

  if (isUsd) {
    anomalies.push('CURRENCY_DISCREPANCY');
    originalAmountCents = amountCents;
    originalCurrency = 'USD';
    amountCents = amountCents * 83;
  }

  // 8. Anomaly 7: Missing Transaction ID (Auto-resolve: Generate deterministic hash)
  const rawId = row.id || row.transaction_id;
  let id = rawId;
  if (!id || !id.trim()) {
    const dateFormatted = dateObj.toISOString().split('T')[0];
    id = computeDeterministicHash(dateFormatted, amountCents, rawPaidBy || '', description);
    anomalies.push('MISSING_TRANSACTION_ID');
  }

  // 9. Anomaly 8: Duplicate Transactions (Quarantine)
  if (existingExpenseIds.has(id) || batchSeenIds.has(id)) {
    anomalies.push('DUPLICATE');
    quarantineReason.push(`Duplicate transaction ID detected: "${id}". Sent to Approval Panel.`);
    status = 'DUPLICATE';
  }

  // 10. Split Type & Parse Split Parameters
  const splitTypeRaw = (row.split_type || 'EQUAL').toUpperCase();
  const splitType = ['EQUAL', 'UNEQUAL', 'PERCENTAGE', 'SHARE'].includes(splitTypeRaw)
    ? splitTypeRaw
    : 'EQUAL';

  const rawSplits = parseCsvSplits(row.split_detail || row.splits || '');
  const rawParticipants = parseCsvParticipants(row.split_with || row.participants || '');

  // 11. Anomaly 10: Division-by-Zero / Empty Splits Check (Hard Fail)
  if (splitType === 'EQUAL' && rawParticipants.length === 0) {
    anomalies.push('EMPTY_SPLITS');
    return {
      shouldInsert: false,
      quarantineReason: ['Equal split type requires at least one participant.'],
      status: 'ACTIVE',
      sanitizedData: {
        id,
        description,
        amountCents,
        originalAmountCents,
        originalCurrency,
        isRefund,
        date: dateObj,
        paidByName: rawPaidBy || '',
        splitType,
        rawSplits,
        rawParticipants,
        anomalies
      }
    };
  }

  if (splitType !== 'EQUAL' && rawSplits.length === 0) {
    anomalies.push('EMPTY_SPLITS');
    return {
      shouldInsert: false,
      quarantineReason: [`Split type "${splitType}" requires detailed split ratios/amounts.`],
      status: 'ACTIVE',
      sanitizedData: {
        id,
        description,
        amountCents,
        originalAmountCents,
        originalCurrency,
        isRefund,
        date: dateObj,
        paidByName: rawPaidBy || '',
        splitType,
        rawSplits,
        rawParticipants,
        anomalies
      }
    };
  }

  // 12. Anomaly 9: Unknown Participants Check (Quarantine)
  const paidByClean = (rawPaidBy || '').trim().toLowerCase();
  const allParticipantNames = splitType === 'EQUAL' 
    ? rawParticipants.map(p => p.toLowerCase()) 
    : rawSplits.map(s => s.name.toLowerCase());

  const isPayerRegistered = registeredUserNames.has(paidByClean);
  const areParticipantsRegistered = allParticipantNames.every(name => registeredUserNames.has(name));

  if (!isPayerRegistered || !areParticipantsRegistered) {
    anomalies.push('UNKNOWN_USER');
    quarantineReason.push(`Contains unregistered participant(s). Payer: "${rawPaidBy}", Participants: ${allParticipantNames.join(', ')}`);
  }

  // 13. Split checksum validations (Vector 2.11 & 2.12)
  if (splitType === 'PERCENTAGE') {
    const pctSum = rawSplits.reduce((sum, s) => sum + s.value, 0);
    if (Math.abs(pctSum - 100) > 0.01) {
      anomalies.push('PERCENTAGE_MISMATCH');
      quarantineReason.push(`Percentage splits sum to ${pctSum}% instead of exactly 100%.`);
    }
  } else if (splitType === 'UNEQUAL') {
    const rawSum = rawSplits.reduce((sum, s) => sum + s.value, 0);
    const centsSum = Math.round(rawSum * 100);
    if (centsSum !== amountCents) {
      anomalies.push('UNEQUAL_MISMATCH');
      quarantineReason.push(`Unequal splits sum to ${rawSum} instead of stated total ${amountCents / 100}.`);
    }
  }

  const hasQuarantineReason = quarantineReason.length > 0;

  return {
    shouldInsert: !hasQuarantineReason || status === 'PENDING_APPROVAL' || status === 'DUPLICATE',
    quarantineReason: hasQuarantineReason ? quarantineReason : null,
    status: status,
    sanitizedData: {
      id,
      description,
      amountCents,
      originalAmountCents,
      originalCurrency,
      isRefund,
      date: dateObj,
      paidByName: rawPaidBy || '',
      splitType,
      rawSplits,
      rawParticipants,
      anomalies
    }
  };
}

module.exports = {
  normalizeDate,
  computeDeterministicHash,
  evaluateAnomaly
};
