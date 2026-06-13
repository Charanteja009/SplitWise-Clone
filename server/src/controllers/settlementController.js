const express = require('express');
const router = express.Router();
const prisma = require('../lib/db');
const { authenticateToken } = require('../middleware/auth');

// POST /api/groups/:id/settlements - Record a settlement transaction (fromUserId to toUserId)
router.post('/groups/:id/settlements', authenticateToken, async (req, res) => {
  const groupId = req.params.id;
  const { fromUserId, toUserId, amount } = req.body;

  if (!fromUserId || !toUserId || !amount) {
    return res.status(400).json({ error: 'Please provide all required fields.' });
  }

  const amt = parseFloat(amount);
  if (isNaN(amt) || amt <= 0) {
    return res.status(400).json({ error: 'Settlement amount must be a positive number.' });
  }

  try {
    // Verify membership
    const membership = await prisma.groupMembership.findUnique({
      where: { groupId_userId: { groupId, userId: req.user.id } }
    });

    if (!membership) {
      return res.status(403).json({ error: 'Access denied. You are not a member of this group.' });
    }

    const groupMemberships = await prisma.groupMembership.findMany({ where: { groupId } });
    const groupUserIds = groupMemberships.map((m) => m.userId);

    // Verify both participants are members
    if (!groupUserIds.includes(fromUserId) || !groupUserIds.includes(toUserId)) {
      return res.status(400).json({ error: 'Both participants in the settlement must be members of this group.' });
    }

    if (fromUserId === toUserId) {
      return res.status(400).json({ error: 'Cannot settle balances with yourself.' });
    }

    // Convert decimal to integer cents
    const amountCents = Math.round(amt * 100);

    // Create the Settlement record
    const settlement = await prisma.settlement.create({
      data: {
        groupId,
        fromUserId,
        toUserId,
        amount: amountCents
      },
      include: {
        fromUser: { select: { id: true, name: true, email: true } },
        toUser: { select: { id: true, name: true, email: true } }
      }
    });

    return res.status(201).json({
      id: settlement.id,
      amount: settlement.amount / 100,
      settledAt: settlement.settledAt,
      fromUser: settlement.fromUser,
      toUser: settlement.toUser
    });
  } catch (err) {
    console.error('Create settlement error:', err);
    return res.status(500).json({ error: 'Internal server error while recording settlement.' });
  }
});

module.exports = router;
