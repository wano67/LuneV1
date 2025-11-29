import { PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { Insight } from '@/modules/insights/insights.service';
import { normalizeUserId } from '@/modules/shared/ids';
import { assertUserExists } from '@/modules/shared/assertions';

export async function personalSubscriptionReviewRule(options: {
  userId: bigint;
  prismaClient?: PrismaClient;
}): Promise<Insight | null> {
  const client = options.prismaClient ?? prisma;
  const userId = normalizeUserId(options.userId);
  await assertUserExists(client, userId);

  const cutoff = new Date();
  cutoff.setUTCMonth(cutoff.getUTCMonth() - 4);

  const txs = await client.transactions.findMany({
    where: {
      user_id: userId,
      business_id: null,
      direction: 'out',
      date: { gte: cutoff },
    },
    select: { label: true, amount: true },
  });

  if (txs.length === 0) return null;

  const grouped = new Map<string, number[]>();
  for (const tx of txs) {
    const key = tx.label.toLowerCase().slice(0, 40);
    grouped.set(key, [...(grouped.get(key) ?? []), Number(tx.amount)]);
  }

  const candidates = Array.from(grouped.entries())
    .map(([label, amounts]) => {
      const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length;
      return { label, avg, count: amounts.length };
    })
    .filter((c) => c.count >= 3 && c.avg > 1 && c.avg < 50);

  if (candidates.length === 0) return null;

  return {
    id: 'personal-subscription-review',
    userId,
    businessId: null,
    category: 'spending',
    severity: 'info',
    title: 'Abonnements potentiellement inutilisés',
    message: 'Certains abonnements récurrents méritent d’être revus.',
    data: {
      subscriptions: candidates.map((c) => ({
        label: c.label,
        averageAmount: c.avg,
        frequency: 'monthly',
      })),
    },
  };
}
