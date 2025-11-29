import { PrismaClient, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  UserId,
  BusinessId,
  ServiceId,
  normalizeUserId,
  normalizeBusinessId,
  normalizeServiceId,
} from '@/modules/shared/ids';
import { assertBusinessOwnedByUser, assertUserExists } from '@/modules/shared/assertions';
import { ServiceOwnershipError } from '@/modules/shared/errors';

export type ServiceUnit = 'project' | 'day' | 'hour' | 'deliverable';

export interface CreateServiceInput {
  userId: UserId;
  businessId?: BusinessId | null;
  name: string;
  description?: string | null;
  unit: ServiceUnit;
  unitPrice: Prisma.Decimal | number;
  currency: string;
}

export interface UpdateServiceInput {
  businessId?: BusinessId | null;
  name?: string;
  description?: string | null;
  unit?: ServiceUnit;
  unitPrice?: Prisma.Decimal | number;
  currency?: string;
  isActive?: boolean;
}

export type ServiceSummary = Prisma.ServiceGetPayload<{
  select: typeof serviceSelect;
}>;

export class ServiceNotFoundError extends Error {
  constructor(message = 'Service not found') {
    super(message);
    this.name = 'ServiceNotFoundError';
  }
}

const allowedUnits: ServiceUnit[] = ['project', 'day', 'hour', 'deliverable'];

const serviceSelect = {
  id: true,
  user_id: true,
  business_id: true,
  name: true,
  description: true,
  unit: true,
  unit_price: true,
  currency: true,
  is_active: true,
  created_at: true,
  updated_at: true,
} satisfies Prisma.ServiceSelect;

function normalizeServiceName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').slice(0, 255);
}

function validateUnit(unit: ServiceUnit) {
  if (!allowedUnits.includes(unit)) {
    throw new Error('Invalid service unit');
  }
}

function validateCurrency(currency: string) {
  const trimmed = currency.trim();
  if (!trimmed || trimmed.length > 10) {
    throw new Error('Invalid currency');
  }
}

export class ServicesService {
  constructor(private readonly prismaClient: PrismaClient) {}

  async createService(input: CreateServiceInput): Promise<ServiceSummary> {
    const userId = normalizeUserId(input.userId);
    await assertUserExists(this.prismaClient, userId);

    let businessId: bigint | null = null;
    if (input.businessId !== undefined) {
      businessId = input.businessId === null ? null : normalizeBusinessId(input.businessId);
      if (businessId !== null) {
        await assertBusinessOwnedByUser(this.prismaClient, businessId, userId);
      }
    }

    const name = normalizeServiceName(input.name);
    validateUnit(input.unit);
    validateCurrency(input.currency);

    const created = await this.prismaClient.service.create({
      data: {
        user_id: userId,
        business_id: businessId,
        name,
        description: input.description ?? null,
        unit: input.unit,
        unit_price: new Prisma.Decimal(input.unitPrice),
        currency: input.currency,
        is_active: true,
      },
      select: serviceSelect,
    });

    return created;
  }

  async updateService(serviceIdInput: ServiceId, userIdInput: UserId, input: UpdateServiceInput): Promise<ServiceSummary> {
    const userId = normalizeUserId(userIdInput);
    const serviceId = normalizeServiceId(serviceIdInput);

    const existing = await this.prismaClient.service.findUnique({
      where: { id: serviceId },
      select: serviceSelect,
    });

    if (!existing) {
      throw new ServiceNotFoundError();
    }
    if (existing.user_id !== userId) {
      throw new ServiceOwnershipError();
    }

    const data: Prisma.ServiceUncheckedUpdateInput = {};
    if (input.name !== undefined) data.name = normalizeServiceName(input.name);
    if (input.description !== undefined) data.description = input.description;
    if (input.unit !== undefined) {
      validateUnit(input.unit);
      data.unit = input.unit;
    }
    if (input.unitPrice !== undefined) data.unit_price = new Prisma.Decimal(input.unitPrice);
    if (input.currency !== undefined) {
      validateCurrency(input.currency);
      data.currency = input.currency;
    }
    if (input.isActive !== undefined) data.is_active = input.isActive;
    if (input.businessId !== undefined) {
      const businessId = input.businessId === null ? null : normalizeBusinessId(input.businessId);
      if (businessId !== null) {
        await assertBusinessOwnedByUser(this.prismaClient, businessId, userId);
      }
      data.business_id = businessId;
    }

    const updated = await this.prismaClient.service.update({
      where: { id: serviceId },
      data,
      select: serviceSelect,
    });

    return updated;
  }

  async getServiceForUser(serviceIdInput: ServiceId, userIdInput: UserId): Promise<ServiceSummary> {
    const userId = normalizeUserId(userIdInput);
    const serviceId = normalizeServiceId(serviceIdInput);
    await assertUserExists(this.prismaClient, userId);

    const service = await this.prismaClient.service.findUnique({
      where: { id: serviceId },
      select: serviceSelect,
    });

    if (!service) {
      throw new ServiceNotFoundError();
    }
    if (service.user_id !== userId) {
      throw new ServiceOwnershipError();
    }

    return service;
  }

  async listServicesForUser(
    userIdInput: UserId,
    filters: { businessId?: BusinessId | null; isActive?: boolean } = {}
  ): Promise<ServiceSummary[]> {
    const userId = normalizeUserId(userIdInput);
    await assertUserExists(this.prismaClient, userId);

    const where: Prisma.ServiceWhereInput = {
      user_id: userId,
    };

    if (filters.businessId !== undefined) {
      where.business_id = filters.businessId === null ? null : normalizeBusinessId(filters.businessId);
    }
    if (filters.isActive !== undefined) {
      where.is_active = filters.isActive;
    }

    return this.prismaClient.service.findMany({
      where,
      select: serviceSelect,
      orderBy: { created_at: 'asc' },
    });
  }

  async archiveService(serviceIdInput: ServiceId, userIdInput: UserId): Promise<ServiceSummary> {
    return this.updateService(serviceIdInput, userIdInput, { isActive: false });
  }

  async deleteService(serviceIdInput: ServiceId, userIdInput: UserId): Promise<void> {
    const service = await this.getServiceForUser(serviceIdInput, userIdInput);
    await this.prismaClient.service.delete({ where: { id: service.id } });
  }
}

export const servicesService = new ServicesService(prisma);
