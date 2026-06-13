/**
 * Checks if a user was an active member of the group on a specific transaction date.
 * Residency boundaries are evaluated down to the exact calendar day (ignoring time).
 */
function isMemberActiveOnDate(membership, transactionDate) {
  const tx = new Date(transactionDate);
  tx.setHours(0, 0, 0, 0);

  const joined = new Date(membership.joinedAt);
  joined.setHours(0, 0, 0, 0);

  if (membership.leftAt) {
    const left = new Date(membership.leftAt);
    left.setHours(0, 0, 0, 0);
    return tx >= joined && tx <= left;
  }

  return tx >= joined;
}

/**
 * Split Engine: Computes precise splits for participants, filtering by group membership timelines.
 * Performs floor truncation and dynamically maps any rounding remaining penny to the primary payer.
 */
function calculateSplits({
  amountCents,
  splitType,
  paidByUserId,
  transactionDate,
  groupMemberships, // all memberships for the group
  userMap,          // Map of lowercase names to user IDs
  rawSplits = [],   // for UNEQUAL, PERCENTAGE, SHARE
  rawParticipants = [] // for EQUAL
}) {
  if (amountCents <= 0) return [];

  // 1. Map memberships for quick lookup by userId
  const membershipMap = new Map();
  for (const m of groupMemberships) {
    membershipMap.set(m.userId, m);
  }

  // 2. Identify intended participants based on splitType
  let intendedUserIds = [];

  if (splitType === 'EQUAL') {
    intendedUserIds = rawParticipants
      .map((name) => userMap.get(name.trim().toLowerCase()))
      .filter((id) => id !== undefined);
  } else {
    intendedUserIds = rawSplits
      .map((s) => userMap.get(s.name.trim().toLowerCase()))
      .filter((id) => id !== undefined);
  }

  // Remove duplicates just in case
  intendedUserIds = Array.from(new Set(intendedUserIds));

  // 3. Filter participants by active residency timeline on transactionDate (Vector 3)
  const activeUserIds = intendedUserIds.filter((userId) => {
    const membership = membershipMap.get(userId);
    if (!membership) return false;
    return isMemberActiveOnDate(membership, transactionDate);
  });

  if (activeUserIds.length === 0) {
    throw new Error('No active group members found for this transaction date.');
  }

  const splits = [];
  let allocatedSum = 0;

  // 4. Perform math splits based on splitType
  if (splitType === 'EQUAL') {
    const N = activeUserIds.length;
    const baseShare = Math.floor(amountCents / N);
    
    for (const userId of activeUserIds) {
      splits.push({ userId, owedAmount: baseShare });
      allocatedSum += baseShare;
    }
  } 
  
  else if (splitType === 'SHARE') {
    const activeSharesMap = new Map();
    let totalShares = 0;
    
    for (const rawSplit of rawSplits) {
      const uId = userMap.get(rawSplit.name.trim().toLowerCase());
      if (uId && activeUserIds.includes(uId)) {
        const shares = Math.max(0, Math.round(rawSplit.value));
        activeSharesMap.set(uId, shares);
        totalShares += shares;
      }
    }

    if (totalShares === 0) {
      throw new Error('Total active shares sum to zero.');
    }

    for (const userId of activeUserIds) {
      const shares = activeSharesMap.get(userId) || 0;
      const owedAmount = Math.floor((shares / totalShares) * amountCents);
      splits.push({ userId, owedAmount });
      allocatedSum += owedAmount;
    }
  } 
  
  else if (splitType === 'PERCENTAGE') {
    const activePctMap = new Map();
    let activePctSum = 0;

    for (const rawSplit of rawSplits) {
      const uId = userMap.get(rawSplit.name.trim().toLowerCase());
      if (uId && activeUserIds.includes(uId)) {
        activePctMap.set(uId, rawSplit.value);
        activePctSum += rawSplit.value;
      }
    }

    if (activePctSum === 0) {
      throw new Error('Total active percentages sum to zero.');
    }

    for (const userId of activeUserIds) {
      const rawPct = activePctMap.get(userId) || 0;
      const normalizedPct = (rawPct / activePctSum) * 100;
      const owedAmount = Math.floor((normalizedPct / 100) * amountCents);
      splits.push({ userId, owedAmount });
      allocatedSum += owedAmount;
    }
  } 
  
  else if (splitType === 'UNEQUAL') {
    for (const userId of activeUserIds) {
      const rawSplit = rawSplits.find(
        (s) => userMap.get(s.name.trim().toLowerCase()) === userId
      );
      const owedAmount = rawSplit ? Math.round(rawSplit.value * 100) : 0;
      splits.push({ userId, owedAmount });
      allocatedSum += owedAmount;
    }
  }

  // 5. Pennies Discrepancy Allocation (Vector 4)
  const remainder = amountCents - allocatedSum;
  if (remainder !== 0) {
    let payerSplit = splits.find((s) => s.userId === paidByUserId);
    if (!payerSplit && splits.length > 0) {
      payerSplit = splits[0];
    }
    if (payerSplit) {
      payerSplit.owedAmount += remainder;
    }
  }

  return splits;
}

module.exports = {
  isMemberActiveOnDate,
  calculateSplits
};
