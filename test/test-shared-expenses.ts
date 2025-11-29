import { userService } from '@/modules/user/user.service';
import { sharedExpenseService } from '@/modules/shared-expense/shared-expense.service';

async function main() {
  console.log('🔹 Shared expenses smoke test starting...');

  const timestamp = Date.now();
  const email = `shared.user+${timestamp}@example.com`;

  const { user } = await userService.createUserWithDefaultSettings({
    email,
    passwordHash: 'dummy',
    displayName: 'Shared User',
  });

  const userId = user.id;
  console.log('✅ User created for shared expenses:', { userId, email });

  const expense = await sharedExpenseService.createSharedExpense({
    userId,
    label: 'Weekend trip',
    totalAmount: 100,
    currency: 'EUR',
    date: new Date(),
    notes: 'Test shared expense',
    participants: [
      { name: 'Owner', email: 'owner@example.com', shareAmount: 40, isOwner: true },
      { name: 'Alice', shareAmount: 30 },
      { name: 'Bob', shareAmount: 30 },
    ],
  });

  console.log('✅ Shared expense created:', { id: expense.id, label: expense.label });

  const { balances: balancesBefore } = await sharedExpenseService.listSharedExpensesWithBalances(userId);
  const balanceMapBefore = new Map(balancesBefore.map((b) => [b.name, b.balance]));

  const ownerBalanceBefore = balanceMapBefore.get('Owner') ?? 0;
  const aliceBalanceBefore = balanceMapBefore.get('Alice') ?? 0;
  const bobBalanceBefore = balanceMapBefore.get('Bob') ?? 0;

  console.log('Balances before settlement:', { ownerBalanceBefore, aliceBalanceBefore, bobBalanceBefore });

  if (Math.abs(ownerBalanceBefore - 60) > 0.0001 || Math.abs(aliceBalanceBefore + 30) > 0.0001) {
    throw new Error('Unexpected balances before settlement');
  }

  await sharedExpenseService.settleDebt({
    userId,
    sharedExpenseId: expense.id,
    fromName: 'Alice',
    toName: 'Owner',
    amount: 10,
    date: new Date(),
    notes: 'Partial settlement',
  });

  const { balances: balancesAfter } = await sharedExpenseService.listSharedExpensesWithBalances(userId);
  const balanceMapAfter = new Map(balancesAfter.map((b) => [b.name, b.balance]));

  const ownerBalanceAfter = balanceMapAfter.get('Owner') ?? 0;
  const aliceBalanceAfter = balanceMapAfter.get('Alice') ?? 0;

  console.log('Balances after settlement:', { ownerBalanceAfter, aliceBalanceAfter });

  if (Math.abs(ownerBalanceAfter - 50) > 0.0001 || Math.abs(aliceBalanceAfter + 20) > 0.0001) {
    throw new Error('Unexpected balances after settlement');
  }

  console.log('✅ Shared expenses smoke test completed successfully.');
}

main().catch((err) => {
  console.error('❌ Shared expenses smoke test failed:', err);
  process.exit(1);
});
