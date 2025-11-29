import { PrismaClient, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { normalizeBusinessId, normalizeUserId } from '@/modules/shared/ids';
import { assertBusinessOwnedByUser, assertUserExists } from '@/modules/shared/assertions';

export class ProjectClientService {
  constructor(private readonly prismaClient: PrismaClient) {}

  async createProjectClient(options: {
    userId: bigint;
    businessId?: bigint | null;
    name: string;
    type?: string;
    email?: string | null;
    phone?: string | null;
    companyName?: string | null;
    vatNumber?: string | null;
    address?: string | null;
    notes?: string | null;
  }) {
    const userId = normalizeUserId(options.userId);
    await assertUserExists(this.prismaClient, userId);

    let businessId: bigint | null = null;
    if (options.businessId !== undefined) {
      businessId = options.businessId === null ? null : normalizeBusinessId(options.businessId);
      if (businessId !== null) {
        await assertBusinessOwnedByUser(this.prismaClient, businessId, userId);
      }
    }

    let linkedClientId: bigint | null = null;
    if (businessId !== null) {
      const existingClient = await this.prismaClient.clients.findFirst({
        where: {
          business_id: businessId,
          OR: [{ name: options.name }, ...(options.email ? [{ email: options.email }] : [])],
        },
        select: { id: true },
      });

      if (existingClient) {
        linkedClientId = existingClient.id;
      } else {
        const created = await this.prismaClient.clients.create({
          data: {
            business_id: businessId,
            name: options.name,
            contact_name: options.companyName ?? null,
            email: options.email ?? null,
            phone: options.phone ?? null,
            billing_address: options.address ?? null,
            shipping_address: null,
            vat_number: options.vatNumber ?? null,
            status: 'active',
            notes: options.notes ?? null,
          },
        });
        linkedClientId = created.id;
      }
    }

    const projectClient = await this.prismaClient.client.create({
      data: {
        user_id: userId,
        business_id: businessId,
        client_id: linkedClientId,
        name: options.name,
        type: options.type ?? 'company',
        email: options.email ?? null,
        phone: options.phone ?? null,
        company_name: options.companyName ?? null,
        vat_number: options.vatNumber ?? null,
        address: options.address ?? null,
        notes: options.notes ?? null,
      },
    });

    return projectClient;
  }
}

export const projectClientService = new ProjectClientService(prisma);
