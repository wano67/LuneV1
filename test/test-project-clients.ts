import { userService } from '@/modules/user/user.service';
import { businessService } from '@/modules/business/business.service';
import { projectClientService } from '@/modules/project/project-client.service';
import { prisma } from '@/lib/prisma';

async function main() {
  console.log('🔹 Project clients smoke test starting...');

  const ts = Date.now();
  const email = `projclient.user+${ts}@example.com`;

  const { user } = await userService.createUserWithDefaultSettings({
    email,
    passwordHash: 'dummy',
    displayName: 'Project Client User',
  });

  const business = await businessService.createBusinessWithDefaultSettings({
    userId: user.id,
    name: `Biz PC ${ts}`,
    legalForm: 'SASU',
    currency: 'EUR',
  });

  const pc1 = await projectClientService.createProjectClient({
    userId: user.id,
    businessId: business.business.id,
    name: `Client Projects ${ts}`,
    email: `client${ts}@example.com`,
  });

  const pc2 = await projectClientService.createProjectClient({
    userId: user.id,
    businessId: business.business.id,
    name: `Client Projects ${ts}`, // same name should reuse
    email: `client${ts}@example.com`,
  });

  const allClients = await prisma.clients.findMany({
    where: { business_id: business.business.id, name: `Client Projects ${ts}` },
  });

  console.log('✅ Project client linked to business client:', {
    projectClientId: pc1.id,
    clientId: pc1.client_id,
    clientCount: allClients.length,
  });

  if (!pc1.client_id || !pc2.client_id || pc1.client_id !== pc2.client_id) {
    throw new Error('Project clients should link to the same business client');
  }
  if (allClients.length !== 1) {
    throw new Error('Should have only one business client record');
  }

  console.log('✅ Project clients smoke test completed successfully.');
}

main().catch((err) => {
  console.error('❌ Project clients smoke test failed:', err);
  process.exit(1);
});
