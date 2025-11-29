import { userService } from '@/modules/user/user.service';
import { businessService } from '@/modules/business/business.service';
import { prisma } from '@/lib/prisma';
import { servicesService } from '@/modules/service/service.service';
import { projectsService } from '@/modules/project/project.service';
import { invoiceService } from '@/modules/invoice/invoice.service';

async function main() {
  console.log('🔹 Invoices smoke test starting...');
  const ts = Date.now();
  const email = `invoice.user+${ts}@example.com`;

  const { user } = await userService.createUserWithDefaultSettings({
    email,
    passwordHash: 'dummy',
    displayName: 'Invoice User',
  });

  const business = await businessService.createBusinessWithDefaultSettings({
    userId: user.id,
    name: `Studio ${ts}`,
    legalForm: 'SASU',
    currency: 'EUR',
  });
  const businessId = business.business.id;

  const client = await prisma.clients.create({
    data: {
      business_id: businessId,
      name: `Client ${ts}`,
      contact_name: null,
      email: `client+${ts}@example.com`,
      phone: null,
      billing_address: null,
      shipping_address: null,
      vat_number: null,
      status: 'active',
      notes: null,
    },
  });

  const service = await servicesService.createService({
    userId: user.id,
    businessId,
    name: 'Branding Pack',
    description: 'Logo + guidelines',
    unit: 'project',
    unitPrice: 1200,
    currency: 'EUR',
  });


  const invoiceServiceRecord = await prisma.services.create({
    data: {
      business_id: businessId,
      name: 'Branding Pack (invoice)',
      billing_mode: 'fixed',
      description: 'Invoice service',
      unit_label: 'project',
      default_price: 1200,
      default_vat_rate: 20,
      is_active: true,
    },
  });

  const project = await projectsService.createProject({
    userId: user.id,
    businessId,
    name: `Project ${ts}`,
    currency: 'EUR',
    services: [
      {
        serviceId: service.id,
        quantity: 1,
        customLabel: 'Branding Pack',
      },
    ],
  });

  const created = await invoiceService.createInvoice({
    userId: user.id,
    businessId,
    clientId: client.id,
    projectId: project.project.id,
    currency: 'EUR',
    items: [
      {
        serviceId: invoiceServiceRecord.id,
        description: 'Branding Pack',
        quantity: 1,
        vatRate: 20,
      },
    ],
    notes: 'Thank you for your business',
  });

  const invoiceWithItems = await invoiceService.getInvoiceWithItemsForUser({
    userId: user.id,
    invoiceId: created.invoice.id,
  });

  const invoices = await invoiceService.listInvoicesForBusiness({ userId: user.id, businessId });

  if (Number(invoiceWithItems.invoice.total_ttc) <= 0) {
    throw new Error('Invoice total_ttc should be > 0');
  }
  if (invoices.length === 0) {
    throw new Error('Expected at least one invoice for business');
  }

  console.log('✅ Invoice created:', {
    id: invoiceWithItems.invoice.id,
    total: invoiceWithItems.invoice.total_ttc.toString(),
    status: invoiceWithItems.invoice.status,
  });
  console.log('✅ Invoices for business:', invoices.length);
}

main().catch((err) => {
  console.error('❌ Invoices smoke test failed:', err);
  process.exit(1);
});
