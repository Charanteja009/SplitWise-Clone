/**
 * Greedy Min-Cash-Flow Network Algorithm for debt simplification (multilateral minimization).
 * @param {Object} netBalances Map of userId -> balance in cents.
 * @param {Object} userNames Map of userId -> user display name.
 * @returns {Array} Minimal list of settlements (who pays whom and how much).
 */
function simplifyDebts(netBalances, userNames) {
  // Filter out users with zero balance
  const participants = Object.keys(netBalances).map((userId) => ({
    userId,
    name: userNames[userId] || 'Unknown User',
    balance: netBalances[userId]
  })).filter(p => p.balance !== 0);

  const debtors = participants.filter(p => p.balance < 0).sort((a, b) => a.balance - b.balance); // Most negative first
  const creditors = participants.filter(p => p.balance > 0).sort((a, b) => b.balance - a.balance); // Most positive first

  const settlements = [];

  let i = 0; // debtor index
  let j = 0; // creditor index

  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];

    const oweAmount = Math.abs(debtor.balance);
    const creditAmount = creditor.balance;

    const settledAmount = Math.min(oweAmount, creditAmount);

    settlements.push({
      fromUserId: debtor.userId,
      fromUserName: debtor.name,
      toUserId: creditor.userId,
      toUserName: creditor.name,
      amountCents: settledAmount
    });

    debtor.balance += settledAmount;
    creditor.balance -= settledAmount;

    if (Math.abs(debtor.balance) < 1) {
      i++;
    }
    if (Math.abs(creditor.balance) < 1) {
      j++;
    }
  }

  return settlements;
}

module.exports = { simplifyDebts };
