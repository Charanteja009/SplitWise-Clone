const express = require('express');
const router = express.Router();
const prisma = require('../lib/db');
const { authenticateToken } = require('../middleware/auth');
const { calculateSplits } = require('../lib/splitEngine');

// POST /api/groups/:id/expenses - Create an expense manually inside a group (with validation and cents conversion)
router.post('/groups/:id/expenses', authenticateToken, async (req, res) => {
  const groupId = req.params.id;
  const { description, totalAmount, paidById, splitType, splits } = req.body;

  if (!description || !totalAmount || !paidById || !splitType) {
    return res.status(400).json({ error: 'Please provide all required fields.' });
  }

  try {
    const membership = await prisma.groupMembership.findUnique({
      where: { groupId_userId: { groupId, userId: req.user.id } }
    });

    if (!membership) {
      return res.status(403).json({ error: 'Access denied. You are not a member of this group.' });
    }

    const groupMemberships = await prisma.groupMembership.findMany({ where: { groupId } });
    const groupUserIds = groupMemberships.map((m) => m.userId);

    if (!groupUserIds.includes(paidById)) {
      return res.status(400).json({ error: 'The paying user is not a member of this group.' });
    }

    // Convert decimal to integer cents
    const amountCents = Math.round(parseFloat(totalAmount) * 100);

    // Prepare participants maps
    const allUsers = await prisma.user.findMany({ select: { id: true, name: true } });
    const userMap = new Map();
    for (const u of allUsers) {
      userMap.set(u.name.toLowerCase().trim(), u.id);
      userMap.set(u.id, u.id); // support ID lookup too
    }

    // Adapt split inputs for the split math engine
    let calculatedSplitsArr;

    if (splitType === 'EQUAL') {
      // Splits equally across all members (user names array mapping)
      const userNames = allUsers.filter(u => groupUserIds.includes(u.id)).map(u => u.name);
      calculatedSplitsArr = calculateSplits({
        amountCents,
        splitType: 'EQUAL',
        paidByUserId: paidById,
        transactionDate: new Date(),
        groupMemberships,
        userMap,
        rawParticipants: userNames
      });
    } else {
      if (!splits || !Array.isArray(splits) || splits.length === 0) {
        return res.status(400).json({ error: 'Splits details are required for unequal/percentage/share splits.' });
      }

      // Format splits values
      const rawSplitsMapped = splits.map((s) => {
        const userObj = allUsers.find(u => u.id === s.userId);
        return {
          name: userObj ? userObj.name : '',
          value: splitType === 'UNEQUAL' ? parseFloat(s.amount) : parseFloat(s.value)
        };
      });

      calculatedSplitsArr = calculateSplits({
        amountCents,
        splitType,
        paidByUserId: paidById,
        transactionDate: new Date(),
        groupMemberships,
        userMap,
        rawSplits: rawSplitsMapped
      });
    }

    // Write expense to database inside a transaction
    const newExpense = await prisma.$transaction(async (tx) => {
      const expenseId = `TX_MANUAL_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      
      const exp = await tx.expense.create({
        data: {
          id: expenseId,
          groupId,
          paidById,
          description: description.trim(),
          amount: amountCents,
          splitType,
          date: new Date(),
          status: 'ACTIVE'
        }
      });

      await tx.expenseSplit.createMany({
        data: calculatedSplitsArr.map((s) => ({
          expenseId: exp.id,
          userId: s.userId,
          owedAmount: s.owedAmount
        }))
      });

      return tx.expense.findUnique({
        where: { id: exp.id },
        include: {
          splits: {
            include: { user: { select: { name: true } } }
          }
        }
      });
    });

    return res.status(201).json(newExpense);
  } catch (err) {
    console.error('Create manual expense error:', err);
    return res.status(400).json({ error: err.message || 'Error occurred while creating expense.' });
  }
});

// PUT /api/expenses/:expenseId/approve - Approve a quarantined future/duplicate expense
router.put('/expenses/:expenseId/approve', authenticateToken, async (req, res) => {
  const { expenseId } = req.params;

  try {
    const expense = await prisma.expense.findUnique({ where: { id: expenseId } });
    if (!expense) {
      return res.status(404).json({ error: 'Expense not found.' });
    }

    // Verify membership
    const membership = await prisma.groupMembership.findUnique({
      where: { groupId_userId: { groupId: expense.groupId, userId: req.user.id } }
    });

    if (!membership) {
      return res.status(403).json({ error: 'Access denied. You are not a member of this group.' });
    }

    const updated = await prisma.expense.update({
      where: { id: expenseId },
      data: { status: 'ACTIVE' }
    });

    return res.status(200).json({ message: 'Expense approved and activated successfully.', expense: updated });
  } catch (err) {
    console.error('Approve expense error:', err);
    return res.status(500).json({ error: 'Internal server error while approving expense.' });
  }
});

// DELETE /api/expenses/:expenseId - Delete an expense
router.delete('/expenses/:expenseId', authenticateToken, async (req, res) => {
  const { expenseId } = req.params;

  try {
    const expense = await prisma.expense.findUnique({ where: { id: expenseId } });
    if (!expense) {
      return res.status(404).json({ error: 'Expense not found.' });
    }

    // Verify membership
    const membership = await prisma.groupMembership.findUnique({
      where: { groupId_userId: { groupId: expense.groupId, userId: req.user.id } }
    });

    if (!membership) {
      return res.status(403).json({ error: 'Access denied. You are not a member of this group.' });
    }

    await prisma.expense.delete({ where: { id: expenseId } });

    return res.status(200).json({ message: 'Expense deleted successfully.' });
  } catch (err) {
    console.error('Delete expense error:', err);
    return res.status(500).json({ error: 'Internal server error while deleting expense.' });
  }
});

module.exports = router;
