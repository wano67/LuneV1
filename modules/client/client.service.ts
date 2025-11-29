import { PrismaClient, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  UserId,
  BusinessId,
  ClientId,
  normalizeUserId,
  normalizeBusinessId,
  normalizeClientId,
} from '@/modules/shared/ids';
import { assertBusinessOwnedByUser, assertUserExists } from '@/modules/shared/assertions';
import { ClientOwnershipError } from '@/modules/shared/errors';

export type ClientType = 'individual' | 'company';

export interface CreateClientInput {
  userId: UserId;
  businessId?: BusinessId | null;
  name: string;
  type: ClientType;
  email?: string | null;
  phone?: string | null;
  companyName?: string | null;
  vatNumber?: string | null;
  address?: string | null;
  notes?: string | null;
}

export interface UpdateClientInput {
  businessId?: BusinessId | null;
  name?: string;
  type?: ClientType;
  email?: string | null;
  phone?: string | null;
  companyName?: string | null;
  vatNumber?: string | null;
  address?: string | null;
  notes?: string | null;
}

export type ClientSummary = Prisma.ClientGetPayload<{
  select: typeof clientSelect;
}>;

export class ClientNotFoundError extends Error {
  constructor(message = 'Client not found') {
    super(message);
    this.name = 'ClientNotFoundError';
  }
}

const clientSelect = {
  id: true,
  user_id: true,
  business_id: true,
  name: true,
  type: true,
  email: true,
  phone: true,
  company_name: true,
  vat_number: true,
  address: true,
  notes: true,
  created_at: true,
  updated_at: true,
} satisfies Prisma.ClientSelect;

function normalizeClientName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').slice(0, 255);
}

function validateClientType(type: ClientType) {
  if (type !== 'individual' && type !== 'company') {
    throw new Error('Invalid client type');
  }
}

export class ClientService {
  constructor(private readonly prismaClient: PrismaClient) {}

  async createClient(input: CreateClientInput): Promise<ClientSummary> {
    const userId = normalizeUserId(input.userId);
    await assertUserExists(this.prismaClient, userId);
    let businessId: bigint | null = null;
    if (input.businessId !== undefined) {
      businessId = input.businessId === null ? null : normalizeBusinessId(input.businessId);
      if (businessId !== null) {
        await assertBusinessOwnedByUser(this.prismaClient, businessId, userId);
      }
    }

    const name = normalizeClientName(input.name);
    if (!name) {
      throw new Error('Client name is required');
    }
    validateClientType(input.type);

    const created = await this.prismaClient.client.create({
      data: {
        user_id: userId,
        business_id: businessId,
        name,
        type: input.type,
        email: input.email ?? null,
        phone: input.phone ?? null,
        company_name: input.companyName ?? null,
        vat_number: input.vatNumber ?? null,
        address: input.address ?? null,
        notes: input.notes ?? null,
      },
      select: clientSelect,
    });

    return created;
  }

  async updateClient(clientIdInput: ClientId, userIdInput: UserId, input: UpdateClientInput): Promise<ClientSummary> {
    const userId = normalizeUserId(userIdInput);
    const clientId = normalizeClientId(clientIdInput);

    const existing = await this.prismaClient.client.findUnique({
      where: { id: clientId },
      select: clientSelect,
    });

    if (!existing) {
      throw new ClientNotFoundError();
    }
    if (existing.user_id !== userId) {
      throw new ClientOwnershipError();
    }

    const data: Prisma.ClientUncheckedUpdateInput = {};
    if (input.name !== undefined) {
      const name = normalizeClientName(input.name);
      if (!name) {
        throw new Error('Client name is required');
      }
      data.name = name;
    }
    if (input.type !== undefined) {
      validateClientType(input.type);
      data.type = input.type;
    }
    if (input.email !== undefined) data.email = input.email;
    if (input.phone !== undefined) data.phone = input.phone;
    if (input.companyName !== undefined) data.company_name = input.companyName;
    if (input.vatNumber !== undefined) data.vat_number = input.vatNumber;
    if (input.address !== undefined) data.address = input.address;
    if (input.notes !== undefined) data.notes = input.notes;
    if (input.businessId !== undefined) {
      const businessId = input.businessId === null ? null : normalizeBusinessId(input.businessId);
      if (businessId !== null) {
        await assertBusinessOwnedByUser(this.prismaClient, businessId, userId);
      }
      data.business_id = businessId;
    }

    const updated = await this.prismaClient.client.update({
      where: { id: clientId },
      data,
      select: clientSelect,
    });

    return updated;
  }

  async listClientsForUser(
    userIdInput: UserId,
    filters: { businessId?: BusinessId | null } = {}
  ): Promise<ClientSummary[]> {
    const userId = normalizeUserId(userIdInput);
    await assertUserExists(this.prismaClient, userId);

    const where: Prisma.ClientWhereInput = {
      user_id: userId,
    };

    if (filters.businessId !== undefined) {
      where.business_id = filters.businessId === null ? null : normalizeBusinessId(filters.businessId);
    }

    const clients = await this.prismaClient.client.findMany({
      where,
      select: clientSelect,
      orderBy: { created_at: 'asc' },
    });

    return clients;
  }

  async getClientForUser(clientIdInput: ClientId, userIdInput: UserId): Promise<ClientSummary> {
    const userId = normalizeUserId(userIdInput);
    const clientId = normalizeClientId(clientIdInput);

    const client = await this.prismaClient.client.findUnique({
      where: { id: clientId },
      select: clientSelect,
    });

    if (!client) {
      throw new ClientNotFoundError();
    }
    if (client.user_id !== userId) {
      throw new ClientOwnershipError();
    }

    return client;
  }

  async deleteClient(clientIdInput: ClientId, userIdInput: UserId): Promise<void> {
    const userId = normalizeUserId(userIdInput);
    const clientId = normalizeClientId(clientIdInput);

    const existing = await this.prismaClient.client.findUnique({
      where: { id: clientId },
      select: { id: true, user_id: true },
    });

    if (!existing) {
      throw new ClientNotFoundError();
    }
    if (existing.user_id !== userId) {
      throw new ClientOwnershipError();
    }

    await this.prismaClient.client.delete({ where: { id: clientId } });
  }
}

export const clientService = new ClientService(prisma);
