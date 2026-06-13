const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  // Clear all database tables in cascade order
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE "User", "Group", "GroupMembership", "Expense", "ExpenseSplit", "Settlement", "QuarantinedExpense" CASCADE;`);

  const passwordHash = await bcrypt.hash('password123', 10);

  const aisha = await prisma.user.create({ data: { name: 'Aisha', email: 'aisha@example.com', passwordHash } });
  const rohan = await prisma.user.create({ data: { name: 'Rohan', email: 'rohan@example.com', passwordHash } });
  const priya = await prisma.user.create({ data: { name: 'Priya', email: 'priya@example.com', passwordHash } });
  const meera = await prisma.user.create({ data: { name: 'Meera', email: 'meera@example.com', passwordHash } });
  const sam = await prisma.user.create({ data: { name: 'Sam', email: 'sam@example.com', passwordHash } });
  const dev = await prisma.user.create({ data: { name: 'Dev', email: 'dev@example.com', passwordHash } });

  const flat = await prisma.group.create({
    data: { name: 'Flatmates', description: 'Shared Household & Trip Expenses Ledger' }
  });

  await prisma.groupMembership.createMany({
    data: [
      { groupId: flat.id, userId: aisha.id, joinedAt: new Date('2026-02-01') },
      { groupId: flat.id, userId: rohan.id, joinedAt: new Date('2026-02-01') },
      { groupId: flat.id, userId: priya.id, joinedAt: new Date('2026-02-01') },
      { groupId: flat.id, userId: meera.id, joinedAt: new Date('2026-02-01'), leftAt: new Date('2026-03-31') },
      { groupId: flat.id, userId: dev.id, joinedAt: new Date('2026-05-01'), leftAt: new Date('2026-05-10') },
      { groupId: flat.id, userId: sam.id, joinedAt: new Date('2026-04-15') },
    ]
  });

  console.log('Database seeding completed successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
