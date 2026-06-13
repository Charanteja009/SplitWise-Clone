const express = require('express');
const router = express.Router();
const multer = require('multer');
const prisma = require('../lib/db');
const { authenticateToken } = require('../middleware/auth');
const { parseCsv } = require('../lib/csvParser');
const { evaluateAnomaly } = require('../lib/anomalyEngine');
const { calculateSplits } = require('../lib/splitEngine');
const { simplifyDebts } = require('../lib/minCashFlow');

// Configure multer memory storage for file uploads
const upload = multer({ storage: multer.memoryStorage() });

// GET /api/groups - List all groups the authenticated user is a member of (with dynamic net balance)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const memberships = await prisma.groupMembership.findMany({
      where: { userId: req.user.id },
      include: {
        group: {
          include: {
            expenses: {
              where: { status: 'ACTIVE' },
              include: { splits: true }
            },
            settlements: true
          }
        }
      }
    });

    const groupsWithBalance = memberships.map((m) => {
      const group = m.group;
      let netBalanceCents = 0;

      group.expenses.forEach((e) => {
        e.splits.forEach((s) => {
          // If current user paid and split participant is not current user, user is owed
          if (e.paidById === req.user.id && s.userId !== req.user.id) {
            netBalanceCents += s.owedAmount;
          }
          // If another user paid and split participant is current user, user owes
          if (s.userId === req.user.id && e.paidById !== req.user.id) {
            netBalanceCents -= s.owedAmount;
          }
        });
      });

      group.settlements.forEach((settlement) => {
        if (settlement.toUserId === req.user.id) {
          netBalanceCents += settlement.amount;
        }
        if (settlement.fromUserId === req.user.id) {
          netBalanceCents -= settlement.amount;
        }
      });

      return {
        id: group.id,
        name: group.name,
        description: group.description,
        createdAt: group.createdAt,
        netBalance: netBalanceCents / 100 // display in decimal dollars/rupees
      };
    });

    return res.status(200).json(groupsWithBalance);
  } catch (err) {
    console.error('List groups error:', err);
    return res.status(500).json({ error: 'Internal server error while fetching groups.' });
  }
});

// POST /api/groups - Create a new shared expense group
router.post('/', authenticateToken, async (req, res) => {
  const { name, description } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Group name is required.' });
  }

  try {
    // Create group and insert creator's membership in a transaction
    const newGroup = await prisma.$transaction(async (tx) => {
      const group = await tx.group.create({
        data: {
          name: name.trim(),
          description: description ? description.trim() : null
        }
      });

      await tx.groupMembership.create({
        data: {
          groupId: group.id,
          userId: req.user.id,
          joinedAt: new Date()
        }
      });

      return group;
    });

    return res.status(201).json(newGroup);
  } catch (err) {
    console.error('Create group error:', err);
    return res.status(500).json({ error: 'Internal server error while creating group.' });
  }
});

// GET /api/groups/:id - Fetch group details (ledger, members, active balances, simplified debts)
router.get('/:id', authenticateToken, async (req, res) => {
  const groupId = req.params.id;

  try {
    // Verify membership
    const membership = await prisma.groupMembership.findUnique({
      where: { groupId_userId: { groupId, userId: req.user.id } }
    });

    if (!membership) {
      return res.status(403).json({ error: 'Access denied. You are not a member of this group.' });
    }

    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        memberships: {
          include: {
            user: { select: { id: true, name: true, email: true } }
          }
        },
        expenses: {
          orderBy: { date: 'desc' },
          include: {
            paidBy: { select: { id: true, name: true, email: true } },
            splits: {
              include: {
                user: { select: { id: true, name: true } }
              }
            }
          }
        },
        settlements: {
          orderBy: { settledAt: 'desc' },
          include: {
            fromUser: { select: { id: true, name: true } },
            toUser: { select: { id: true, name: true } }
          }
        }
      }
    });

    if (!group) {
      return res.status(404).json({ error: 'Group not found.' });
    }

    const members = group.memberships.map((m) => ({
      id: m.user.id,
      name: m.user.name,
      email: m.user.email,
      joinedAt: m.joinedAt,
      leftAt: m.leftAt
    }));

    // Dynamic dynamic SQL-equivalent aggregates for net balances
    const netBalancesCents = {};
    const userNames = {};
    members.forEach((m) => {
      netBalancesCents[m.id] = 0;
      userNames[m.id] = m.name;
    });

    group.expenses.forEach((e) => {
      if (e.status !== 'ACTIVE') return;
      e.splits.forEach((s) => {
        if (e.paidById !== s.userId) {
          netBalancesCents[e.paidById] += s.owedAmount;
          netBalancesCents[s.userId] -= s.owedAmount;
        }
      });
    });

    group.settlements.forEach((s) => {
      netBalancesCents[s.fromUserId] -= s.amount;
      netBalancesCents[s.toUserId] += s.amount;
    });

    // Run Multilateral Greedy Debt Simplifier (simplifyDebts)
    const simplifiedCentsSettlements = simplifyDebts(netBalancesCents, userNames);

    // Format nets and payouts for JSON output
    const netBalances = {};
    Object.keys(netBalancesCents).forEach((uid) => {
      netBalances[uid] = netBalancesCents[uid] / 100;
    });

    const peerDebts = simplifiedCentsSettlements.map((s) => ({
      fromUser: { id: s.fromUserId, name: s.fromUserName },
      toUser: { id: s.toUserId, name: s.toUserName },
      amount: s.amountCents / 100
    }));

    return res.status(200).json({
      group: {
        id: group.id,
        name: group.name,
        description: group.description,
        createdAt: group.createdAt
      },
      members,
      expenses: group.expenses.map(e => ({
        id: e.id,
        description: e.description,
        amount: e.amount / 100,
        originalAmount: e.originalAmount ? e.originalAmount / 100 : null,
        originalCurrency: e.originalCurrency,
        isRefund: e.isRefund,
        date: e.date,
        status: e.status,
        createdAt: e.createdAt,
        paidBy: e.paidBy,
        splits: e.splits.map(sp => ({
          userId: sp.userId,
          owedAmount: sp.owedAmount / 100,
          userName: sp.user.name
        }))
      })),
      settlements: group.settlements.map(s => ({
        id: s.id,
        amount: s.amount / 100,
        settledAt: s.settledAt,
        fromUser: s.fromUser,
        toUser: s.toUser
      })),
      netBalances,
      peerDebts
    });
  } catch (err) {
    console.error('Get group details error:', err);
    return res.status(500).json({ error: 'Internal server error while fetching group details.' });
  }
});

// POST /api/groups/:id/upload-csv - Ingestion Pipeline with 12-vector anomaly check
router.post('/:id/upload-csv', authenticateToken, upload.single('file'), async (req, res) => {
  const groupId = req.params.id;
  const file = req.file;

  if (!file) {
    return res.status(400).json({ error: 'No CSV file was uploaded.' });
  }

  try {
    // Verify Group existence
    const group = await prisma.group.findUnique({ where: { id: groupId } });
    if (!group) {
      return res.status(404).json({ error: 'Target group does not exist.' });
    }

    const csvContent = file.buffer.toString('utf-8');
    const rows = parseCsv(csvContent);

    if (rows.length === 0) {
      return res.status(200).json({
        totalEvaluated: 0,
        successCount: 0,
        quarantineCount: 0,
        logs: [],
        message: 'The uploaded CSV file is empty.'
      });
    }

    // Pre-fetch lookups to optimize database calls
    const allUsers = await prisma.user.findMany({ select: { id: true, name: true } });
    const userMap = new Map();
    const registeredUserNames = new Set();
    for (const u of allUsers) {
      const nameKey = u.name.toLowerCase().trim();
      userMap.set(nameKey, u.id);
      registeredUserNames.add(nameKey);
    }

    const groupMemberships = await prisma.groupMembership.findMany({ where: { groupId } });
    const existingExpenses = await prisma.expense.findMany({ select: { id: true } });
    const existingExpenseIds = new Set(existingExpenses.map((e) => e.id));
    const batchSeenIds = new Set();

    const logs = [];
    let successCount = 0;
    let quarantineCount = 0;
    let rejectCount = 0;

    const operations = [];

    for (let i = 0; i < rows.length; i++) {
      const rawRow = rows[i];
      const rowIndex = i + 1;

      if (!rawRow.date || !rawRow.amount || !rawRow.paid_by || !rawRow.description) {
        rejectCount++;
        logs.push({
          rowIndex,
          id: rawRow.id || '',
          description: rawRow.description || 'N/A',
          amount: parseFloat(rawRow.amount) || 0,
          paidBy: rawRow.paid_by || 'N/A',
          status: 'REJECTED',
          action: 'Row blocked due to missing core structural headers.',
          anomalies: ['MISSING_HEADERS'],
          reasons: ['Row failed structural schema check.']
        });
        continue;
      }

      const evaluation = evaluateAnomaly(rawRow, registeredUserNames, existingExpenseIds, batchSeenIds);
      const data = evaluation.sanitizedData;

      if (!evaluation.shouldInsert) {
        // Quarantine registration or split issues
        if (data.anomalies.includes('UNKNOWN_USER') || data.anomalies.includes('PERCENTAGE_MISMATCH') || data.anomalies.includes('UNEQUAL_MISMATCH')) {
          quarantineCount++;
          const rawRowDataJson = JSON.parse(JSON.stringify(rawRow));
          operations.push((tx) =>
            tx.quarantinedExpense.create({
              data: {
                groupId,
                rawRowData: rawRowDataJson,
                anomalies: data.anomalies
              }
            })
          );

          logs.push({
            rowIndex,
            id: data.id,
            description: data.description,
            amount: data.amountCents / 100,
            paidBy: data.paidByName,
            status: 'QUARANTINED',
            action: 'Staged into QuarantinedExpense board.',
            anomalies: data.anomalies,
            reasons: evaluation.quarantineReason
          });
        } else {
          // Hard fail structural blocks (Zero amount, completely invalid date formats)
          rejectCount++;
          logs.push({
            rowIndex,
            id: data.id,
            description: data.description,
            amount: data.amountCents / 100,
            paidBy: data.paidByName,
            status: 'REJECTED',
            action: 'Dropped completely from ingestion pipeline.',
            anomalies: data.anomalies,
            reasons: evaluation.quarantineReason
          });
        }
        continue;
      }

      batchSeenIds.add(data.id);
      const paidById = userMap.get(data.paidByName.toLowerCase().trim());

      let calculatedSplitsArr;
      try {
        calculatedSplitsArr = calculateSplits({
          amountCents: data.amountCents,
          splitType: data.splitType,
          paidByUserId: paidById,
          transactionDate: data.date,
          groupMemberships,
          userMap,
          rawSplits: data.rawSplits,
          rawParticipants: data.rawParticipants
        });
      } catch (err) {
        quarantineCount++;
        const rawRowDataJson = JSON.parse(JSON.stringify(rawRow));
        operations.push((tx) =>
          tx.quarantinedExpense.create({
            data: {
              groupId,
              rawRowData: rawRowDataJson,
              anomalies: [...data.anomalies, 'TEMPORAL_EXCLUSION_ERROR']
            }
          })
        );

        logs.push({
          rowIndex,
          id: data.id,
          description: data.description,
          amount: data.amountCents / 100,
          paidBy: data.paidByName,
          status: 'QUARANTINED',
          action: 'Staged to QuarantinedExpense board due to membership date exclusion.',
          anomalies: [...data.anomalies, 'TEMPORAL_EXCLUSION_ERROR'],
          reasons: [err.message]
        });
        continue;
      }

      let expenseStatus = 'ACTIVE';
      let actionMsg = 'Imported successfully.';
      
      if (evaluation.status === 'PENDING_APPROVAL') {
        expenseStatus = 'PENDING_APPROVAL';
        quarantineCount++;
        actionMsg = 'Quarantined in PENDING_APPROVAL state (Future transaction date).';
      } else if (evaluation.status === 'DUPLICATE') {
        expenseStatus = 'DUPLICATE';
        quarantineCount++;
        actionMsg = 'Quarantined in DUPLICATE status for manual duplicate verification.';
      } else {
        successCount++;
      }

      const currentStatus = expenseStatus;
      const currentSplits = calculatedSplitsArr;

      operations.push(async (tx) => {
        let finalId = data.id;
        const exists = await tx.expense.findUnique({ where: { id: finalId } });
        if (exists) {
          finalId = `${data.id}_dup_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        }

        return tx.expense.create({
          data: {
            id: finalId,
            groupId,
            paidById,
            description: data.description,
            amount: data.amountCents,
            originalAmount: data.originalAmountCents,
            originalCurrency: data.originalCurrency,
            isRefund: data.isRefund,
            date: data.date,
            status: currentStatus,
            splits: {
              createMany: {
                data: currentSplits.map((s) => ({
                  userId: s.userId,
                  owedAmount: s.owedAmount
                }))
              }
            }
          }
        });
      });

      logs.push({
        rowIndex,
        id: data.id,
        description: data.description,
        amount: data.amountCents / 100,
        paidBy: data.paidByName,
        status: currentStatus === 'ACTIVE' ? 'SUCCESS' : 'QUARANTINED',
        action: actionMsg,
        anomalies: data.anomalies,
        reasons: evaluation.quarantineReason
      });
    }

    // Run interactive transactions with 45s timeout budget
    await prisma.$transaction(
      async (tx) => {
        for (const op of operations) {
          await op(tx);
        }
      },
      {
        timeout: 45000
      }
    );

    return res.status(200).json({
      totalEvaluated: rows.length,
      successCount,
      quarantineCount,
      rejectCount,
      logs,
      message: `CSV processing finished: ${successCount} successful, ${quarantineCount} quarantined, ${rejectCount} rejected.`
    });
  } catch (error) {
    console.error('CSV Ingestion Pipeline Error:', error);
    return res.status(500).json({ error: error.message || 'An unexpected error occurred during CSV parsing.' });
  }
});

// POST /api/groups/:id/members - Add a user to a group by exact email
router.post('/:id/members', authenticateToken, async (req, res) => {
  const groupId = req.params.id;
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email address is required.' });
  }

  try {
    const membership = await prisma.groupMembership.findUnique({
      where: { groupId_userId: { groupId, userId: req.user.id } }
    });

    if (!membership) {
      return res.status(403).json({ error: 'Access denied. You are not a member of this group.' });
    }

    const userToAdd = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() }
    });

    if (!userToAdd) {
      return res.status(400).json({ error: 'No user registered with this email address.' });
    }

    const existingMember = await prisma.groupMembership.findUnique({
      where: { groupId_userId: { groupId, userId: userToAdd.id } }
    });

    if (existingMember) {
      return res.status(400).json({ error: 'User is already a member of this group.' });
    }

    const newMembership = await prisma.groupMembership.create({
      data: {
        groupId,
        userId: userToAdd.id,
        joinedAt: new Date()
      }
    });

    return res.status(200).json({
      message: 'Member added successfully.',
      user: {
        id: userToAdd.id,
        name: userToAdd.name,
        email: userToAdd.email
      }
    });
  } catch (err) {
    console.error('Add member error:', err);
    return res.status(500).json({ error: 'Internal server error while adding group member.' });
  }
});

// GET /api/groups/:id/quarantined - Fetch all staged quarantined expenses for Meera's Board
router.get('/:id/quarantined', authenticateToken, async (req, res) => {
  const groupId = req.params.id;

  try {
    const membership = await prisma.groupMembership.findUnique({
      where: { groupId_userId: { groupId, userId: req.user.id } }
    });

    if (!membership) {
      return res.status(403).json({ error: 'Access denied. You are not a member of this group.' });
    }

    const quarantined = await prisma.quarantinedExpense.findMany({
      where: { groupId },
      orderBy: { createdAt: 'desc' }
    });

    return res.status(200).json(quarantined);
  } catch (err) {
    console.error('Get quarantined error:', err);
    return res.status(500).json({ error: 'Internal server error while fetching quarantined board.' });
  }
});

// POST /api/groups/:id/quarantined/:qid/resolve - Resolve a quarantined row from Meera's Board
router.post('/:id/quarantined/:qid/resolve', authenticateToken, async (req, res) => {
  const { id: groupId, qid } = req.params;
  const { date, amount, paid_by, description, split_type, split_with, split_detail } = req.body;

  try {
    // 1. Verify membership
    const membership = await prisma.groupMembership.findUnique({
      where: { groupId_userId: { groupId, userId: req.user.id } }
    });
    if (!membership) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    // 2. Fetch quarantined expense
    const qExpense = await prisma.quarantinedExpense.findFirst({
      where: { id: qid, groupId }
    });
    if (!qExpense) {
      return res.status(404).json({ error: 'Quarantined expense not found.' });
    }

    // 3. Setup check parameters
    const allUsers = await prisma.user.findMany({ select: { id: true, name: true } });
    const userMap = new Map();
    const registeredUserNames = new Set();
    for (const u of allUsers) {
      const nameKey = u.name.toLowerCase().trim();
      userMap.set(nameKey, u.id);
      registeredUserNames.add(nameKey);
    }
    const groupMemberships = await prisma.groupMembership.findMany({ where: { groupId } });

    // Validate inputs
    const cleanRow = {
      id: req.body.id || `TX_RESOLVED_${Date.now()}`,
      date,
      amount,
      paid_by,
      description,
      split_type,
      split_with,
      split_detail
    };

    const evaluation = evaluateAnomaly(cleanRow, registeredUserNames, new Set(), new Set());
    const data = evaluation.sanitizedData;

    if (!evaluation.shouldInsert) {
      return res.status(400).json({
        error: 'The edited values still contain unresolved errors.',
        reasons: evaluation.quarantineReason
      });
    }

    const paidById = userMap.get(data.paidByName.toLowerCase().trim());
    const calculatedSplitsArr = calculateSplits({
      amountCents: data.amountCents,
      splitType: data.splitType,
      paidByUserId: paidById,
      transactionDate: data.date,
      groupMemberships,
      userMap,
      rawSplits: data.rawSplits,
      rawParticipants: data.rawParticipants
    });

    // Write expense and delete quarantine staged item in a transaction
    const resolvedExpense = await prisma.$transaction(async (tx) => {
      const exp = await tx.expense.create({
        data: {
          id: data.id,
          groupId,
          paidById,
          description: data.description,
          amount: data.amountCents,
          originalAmount: data.originalAmountCents,
          originalCurrency: data.originalCurrency,
          isRefund: data.isRefund,
          date: data.date,
          status: 'ACTIVE',
          splits: {
            createMany: {
              data: calculatedSplitsArr.map((s) => ({
                userId: s.userId,
                owedAmount: s.owedAmount
              }))
            }
          }
        }
      });

      await tx.quarantinedExpense.delete({ where: { id: qid } });
      return exp;
    });

    return res.status(200).json({ message: 'Expense resolved successfully.', expense: resolvedExpense });
  } catch (err) {
    console.error('Resolve quarantined error:', err);
    return res.status(400).json({ error: err.message || 'Error occurred while resolving expense.' });
  }
});

module.exports = router;
