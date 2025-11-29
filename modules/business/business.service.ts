import { PrismaClient, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { BusinessId, UserId, normalizeBusinessId, normalizeUserId } from '@/modules/shared/ids';
import { BusinessNotFoundError, BusinessOwnershipError, UserNotFoundError } from '@/modules/shared/errors';

export interface CreateBusinessInput {
  userId: UserId;
  name: string;
  legalForm?: string | null;
  registrationNumber?: string | null;
  taxId?: string | null;
  currency?: string | null;

  invoicePrefix?: string | null;
  quotePrefix?: string | null;
  defaultVatRate?: number | null;
  defaultPaymentTermsDays?: number | null;
}

export interface UpdateBusinessProfileInput {
  name?: string;
  legalForm?: string | null;
  registrationNumber?: string | null;
  taxId?: string | null;
  currency?: string | null;
  isActive?: boolean;
}

export interface UpdateBusinessSettingsInput {
  invoicePrefix?: string | null;
  invoiceNextNumber?: number | null;
  quotePrefix?: string | null;
  quoteNextNumber?: number | null;
  defaultVatRate?: number | null;
  defaultPaymentTermsDays?: number | null;
}

export interface BusinessWithSettings {
  business: Prisma.businessesGetPayload<{
    select: {
      id: true;
      user_id: true;
      name: true;
      legal_form: true;
      registration_number: true;
      tax_id: true;
      currency: true;
      is_active: true;
      created_at: true;
      updated_at: true;
    };
  }>;
  settings: Prisma.business_settingsGetPayload<{
    select: {
      business_id: true;
      invoice_prefix: true;
      invoice_next_number: true;
      quote_prefix: true;
      quote_next_number: true;
      default_vat_rate: true;
      default_payment_terms_days: true;
      created_at: true;
      updated_at: true;
    };
  }>;
}

export class BusinessNameAlreadyExistsError extends Error {
  constructor(message = 'Business name already exists for this user') {
    super(message);
    this.name = 'BusinessNameAlreadyExistsError';
  }
}

export class InvalidBusinessSettingsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidBusinessSettingsError';
  }
}

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

function validateSettingsInput(input: {
  invoiceNextNumber?: number | null;
  quoteNextNumber?: number | null;
  defaultVatRate?: number | null;
  defaultPaymentTermsDays?: number | null;
}) {
  if (input.invoiceNextNumber !== undefined) {
    if (
      input.invoiceNextNumber === null ||
      !Number.isInteger(input.invoiceNextNumber) ||
      input.invoiceNextNumber < 1
    ) {
      throw new InvalidBusinessSettingsError('invoiceNextNumber must be an integer >= 1');
    }
  }

  if (input.quoteNextNumber !== undefined) {
    if (
      input.quoteNextNumber === null ||
      !Number.isInteger(input.quoteNextNumber) ||
      input.quoteNextNumber < 1
    ) {
      throw new InvalidBusinessSettingsError('quoteNextNumber must be an integer >= 1');
    }
  }

  if (input.defaultVatRate !== undefined) {
    if (
      input.defaultVatRate !== null &&
      (!Number.isFinite(input.defaultVatRate) || input.defaultVatRate < 0 || input.defaultVatRate > 100)
    ) {
      throw new InvalidBusinessSettingsError('defaultVatRate must be between 0 and 100');
    }
  }

  if (input.defaultPaymentTermsDays !== undefined) {
    if (
      input.defaultPaymentTermsDays === null ||
      !Number.isInteger(input.defaultPaymentTermsDays) ||
      input.defaultPaymentTermsDays < 0
    ) {
      throw new InvalidBusinessSettingsError('defaultPaymentTermsDays must be an integer >= 0');
    }
  }
}

export class BusinessService {
  constructor(private readonly prismaClient: PrismaClient) {}

  async createBusinessWithDefaultSettings(input: CreateBusinessInput): Promise<BusinessWithSettings> {
    const userId = normalizeUserId(input.userId);
    const name = normalizeName(input.name);
    validateSettingsInput({
      defaultVatRate: input.defaultVatRate,
      defaultPaymentTermsDays: input.defaultPaymentTermsDays,
    });

    try {
      const result = await this.prismaClient.$transaction(async (tx) => {
        const user = await tx.users.findUnique({
          where: { id: userId },
          select: { id: true },
        });

        if (!user) {
          throw new UserNotFoundError();
        }

        const userSettings = await tx.user_settings.findUnique({
          where: { user_id: userId },
          select: { main_currency: true },
        });

        const business = await tx.businesses.create({
          data: {
            user_id: userId,
            name,
            legal_form: input.legalForm ?? null,
            registration_number: input.registrationNumber ?? null,
            tax_id: input.taxId ?? null,
            currency: input.currency ?? userSettings?.main_currency ?? 'EUR',
            is_active: true,
          },
          select: {
            id: true,
            user_id: true,
            name: true,
            legal_form: true,
            registration_number: true,
            tax_id: true,
            currency: true,
            is_active: true,
            created_at: true,
            updated_at: true,
          },
        });

        const settings = await tx.business_settings.create({
          data: {
            business_id: business.id,
            invoice_prefix: input.invoicePrefix ?? 'INV-',
            invoice_next_number: 1,
            quote_prefix: input.quotePrefix ?? 'Q-',
            quote_next_number: 1,
            default_vat_rate: input.defaultVatRate ?? null,
            default_payment_terms_days: input.defaultPaymentTermsDays ?? 30,
          },
          select: {
            business_id: true,
            invoice_prefix: true,
            invoice_next_number: true,
            quote_prefix: true,
            quote_next_number: true,
            default_vat_rate: true,
            default_payment_terms_days: true,
            created_at: true,
            updated_at: true,
          },
        });

        return { business, settings };
      });

      return result;
    } catch (err: any) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new BusinessNameAlreadyExistsError();
      }
      throw err;
    }
  }

  async getBusinessWithSettingsForUser(
    businessIdInput: BusinessId,
    userIdInput: UserId
  ): Promise<BusinessWithSettings> {
    const businessId = normalizeBusinessId(businessIdInput);
    const userId = normalizeUserId(userIdInput);

    const business = await this.prismaClient.businesses.findUnique({
      where: { id: businessId },
      select: {
        id: true,
        user_id: true,
        name: true,
        legal_form: true,
        registration_number: true,
        tax_id: true,
        currency: true,
        is_active: true,
        created_at: true,
        updated_at: true,
      },
    });

    if (!business) {
      throw new BusinessNotFoundError();
    }

    if (business.user_id !== userId) {
      throw new BusinessOwnershipError();
    }

    const settings = await this.ensureBusinessSettings(businessId);

    return { business, settings };
  }

  async listBusinessesForUser(
    userIdInput: UserId,
    options?: { includeInactive?: boolean }
  ): Promise<BusinessWithSettings[]> {
    const userId = normalizeUserId(userIdInput);

    const businesses = await this.prismaClient.businesses.findMany({
      where: {
        user_id: userId,
        ...(options?.includeInactive ? {} : { is_active: true }),
      },
      select: {
        id: true,
        user_id: true,
        name: true,
        legal_form: true,
        registration_number: true,
        tax_id: true,
        currency: true,
        is_active: true,
        created_at: true,
        updated_at: true,
      },
      orderBy: { created_at: 'asc' },
    });

    if (businesses.length === 0) {
      return [];
    }

    const businessIds = businesses.map((b) => b.id);
    const settingsList = await this.prismaClient.business_settings.findMany({
      where: { business_id: { in: businessIds } },
      select: {
        business_id: true,
        invoice_prefix: true,
        invoice_next_number: true,
        quote_prefix: true,
        quote_next_number: true,
        default_vat_rate: true,
        default_payment_terms_days: true,
        created_at: true,
        updated_at: true,
      },
    });

    const settingsMap = new Map<bigint, BusinessWithSettings['settings']>();
    settingsList.forEach((s) => settingsMap.set(s.business_id, s));

    const withSettings = await Promise.all(
      businesses.map(async (business) => {
        const foundSettings = settingsMap.get(business.id) ?? (await this.ensureBusinessSettings(business.id));
        return { business, settings: foundSettings };
      })
    );

    return withSettings;
  }

  async updateBusinessProfile(
    businessIdInput: BusinessId,
    userIdInput: UserId,
    input: UpdateBusinessProfileInput
  ): Promise<BusinessWithSettings> {
    const businessId = normalizeBusinessId(businessIdInput);
    const userId = normalizeUserId(userIdInput);

    const existing = await this.prismaClient.businesses.findUnique({
      where: { id: businessId },
      select: { user_id: true },
    });

    if (!existing) {
      throw new BusinessNotFoundError();
    }

    if (existing.user_id !== userId) {
      throw new BusinessOwnershipError();
    }

    const data: Prisma.businessesUpdateInput = {};
    if (input.name !== undefined) data.name = normalizeName(input.name);
    if (input.legalForm !== undefined) data.legal_form = input.legalForm;
    if (input.registrationNumber !== undefined) data.registration_number = input.registrationNumber;
    if (input.taxId !== undefined) data.tax_id = input.taxId;
    if (input.currency !== undefined) data.currency = input.currency;
    if (input.isActive !== undefined) data.is_active = input.isActive;

    if (Object.keys(data).length === 0) {
      return this.getBusinessWithSettingsForUser(businessId, userId);
    }

    try {
      const business = await this.prismaClient.businesses.update({
        where: { id: businessId },
        data,
        select: {
          id: true,
          user_id: true,
          name: true,
          legal_form: true,
          registration_number: true,
          tax_id: true,
          currency: true,
          is_active: true,
          created_at: true,
          updated_at: true,
        },
      });

      const settings = await this.ensureBusinessSettings(businessId);

      return { business, settings };
    } catch (err: any) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new BusinessNameAlreadyExistsError();
      }
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        throw new BusinessNotFoundError();
      }
      throw err;
    }
  }

  async updateBusinessSettings(
    businessIdInput: BusinessId,
    userIdInput: UserId,
    input: UpdateBusinessSettingsInput
  ): Promise<BusinessWithSettings> {
    const businessId = normalizeBusinessId(businessIdInput);
    const userId = normalizeUserId(userIdInput);

    validateSettingsInput({
      invoiceNextNumber: input.invoiceNextNumber,
      quoteNextNumber: input.quoteNextNumber,
      defaultVatRate: input.defaultVatRate,
      defaultPaymentTermsDays: input.defaultPaymentTermsDays,
    });

    const business = await this.prismaClient.businesses.findUnique({
      where: { id: businessId },
      select: {
        id: true,
        user_id: true,
        name: true,
        legal_form: true,
        registration_number: true,
        tax_id: true,
        currency: true,
        is_active: true,
        created_at: true,
        updated_at: true,
      },
    });

    if (!business) {
      throw new BusinessNotFoundError();
    }

    if (business.user_id !== userId) {
      throw new BusinessOwnershipError();
    }

    const existingSettings = await this.prismaClient.business_settings.findUnique({
      where: { business_id: businessId },
      select: {
        business_id: true,
        invoice_prefix: true,
        invoice_next_number: true,
        quote_prefix: true,
        quote_next_number: true,
        default_vat_rate: true,
        default_payment_terms_days: true,
        created_at: true,
        updated_at: true,
      },
    });

    if (!existingSettings) {
      const created = await this.prismaClient.business_settings.create({
        data: {
          business_id: businessId,
          invoice_prefix: input.invoicePrefix ?? 'INV-',
          invoice_next_number: input.invoiceNextNumber ?? 1,
          quote_prefix: input.quotePrefix ?? 'Q-',
          quote_next_number: input.quoteNextNumber ?? 1,
          default_vat_rate: input.defaultVatRate ?? null,
          default_payment_terms_days: input.defaultPaymentTermsDays ?? 30,
        },
        select: {
          business_id: true,
          invoice_prefix: true,
          invoice_next_number: true,
          quote_prefix: true,
          quote_next_number: true,
          default_vat_rate: true,
          default_payment_terms_days: true,
          created_at: true,
          updated_at: true,
        },
      });

      return { business, settings: created };
    }

    const data: Prisma.business_settingsUpdateInput = {};

    if (input.invoicePrefix !== undefined) {
      data.invoice_prefix = input.invoicePrefix;
    }

    if (input.invoiceNextNumber !== undefined && input.invoiceNextNumber !== null) {
      data.invoice_next_number = input.invoiceNextNumber;
    }

    if (input.quotePrefix !== undefined) {
      data.quote_prefix = input.quotePrefix;
    }

    if (input.quoteNextNumber !== undefined && input.quoteNextNumber !== null) {
      data.quote_next_number = input.quoteNextNumber;
    }

    if (input.defaultVatRate !== undefined) {
      data.default_vat_rate = input.defaultVatRate;
    }

    if (input.defaultPaymentTermsDays !== undefined && input.defaultPaymentTermsDays !== null) {
      data.default_payment_terms_days = input.defaultPaymentTermsDays;
    }

    const settings = await this.prismaClient.business_settings.update({
      where: { business_id: businessId },
      data,
      select: {
        business_id: true,
        invoice_prefix: true,
        invoice_next_number: true,
        quote_prefix: true,
        quote_next_number: true,
        default_vat_rate: true,
        default_payment_terms_days: true,
        created_at: true,
        updated_at: true,
      },
    });

    return { business, settings };
  }

  async archiveBusiness(businessIdInput: BusinessId, userIdInput: UserId): Promise<BusinessWithSettings> {
    const businessId = normalizeBusinessId(businessIdInput);
    const userId = normalizeUserId(userIdInput);

    const existing = await this.prismaClient.businesses.findUnique({
      where: { id: businessId },
      select: {
        id: true,
        user_id: true,
        name: true,
        legal_form: true,
        registration_number: true,
        tax_id: true,
        currency: true,
        is_active: true,
        created_at: true,
        updated_at: true,
      },
    });

    if (!existing) {
      throw new BusinessNotFoundError();
    }

    if (existing.user_id !== userId) {
      throw new BusinessOwnershipError();
    }

    try {
      const business = await this.prismaClient.businesses.update({
        where: { id: businessId },
        data: { is_active: false },
        select: {
          id: true,
          user_id: true,
          name: true,
          legal_form: true,
          registration_number: true,
          tax_id: true,
          currency: true,
          is_active: true,
          created_at: true,
          updated_at: true,
        },
      });

      const settings = await this.ensureBusinessSettings(businessId);
      return { business, settings };
    } catch (err: any) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        throw new BusinessNotFoundError();
      }
      if (err instanceof BusinessOwnershipError) {
        throw err;
      }
      throw err;
    }
  }

  async reactivateBusiness(businessIdInput: BusinessId, userIdInput: UserId): Promise<BusinessWithSettings> {
    const businessId = normalizeBusinessId(businessIdInput);
    const userId = normalizeUserId(userIdInput);

    const existing = await this.prismaClient.businesses.findUnique({
      where: { id: businessId },
      select: {
        id: true,
        user_id: true,
        name: true,
        legal_form: true,
        registration_number: true,
        tax_id: true,
        currency: true,
        is_active: true,
        created_at: true,
        updated_at: true,
      },
    });

    if (!existing) {
      throw new BusinessNotFoundError();
    }

    if (existing.user_id !== userId) {
      throw new BusinessOwnershipError();
    }

    try {
      const business = await this.prismaClient.businesses.update({
        where: { id: businessId },
        data: { is_active: true },
        select: {
          id: true,
          user_id: true,
          name: true,
          legal_form: true,
          registration_number: true,
          tax_id: true,
          currency: true,
          is_active: true,
          created_at: true,
          updated_at: true,
        },
      });

      const settings = await this.ensureBusinessSettings(businessId);
      return { business, settings };
    } catch (err: any) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        throw new BusinessNotFoundError();
      }
      if (err instanceof BusinessOwnershipError) {
        throw err;
      }
      throw err;
    }
  }

  private async ensureBusinessSettings(businessId: bigint): Promise<BusinessWithSettings['settings']> {
    const existing = await this.prismaClient.business_settings.findUnique({
      where: { business_id: businessId },
      select: {
        business_id: true,
        invoice_prefix: true,
        invoice_next_number: true,
        quote_prefix: true,
        quote_next_number: true,
        default_vat_rate: true,
        default_payment_terms_days: true,
        created_at: true,
        updated_at: true,
      },
    });

    if (existing) {
      return existing;
    }

    const created = await this.prismaClient.business_settings.create({
      data: {
        business_id: businessId,
        invoice_prefix: 'INV-',
        invoice_next_number: 1,
        quote_prefix: 'Q-',
        quote_next_number: 1,
        default_vat_rate: null,
        default_payment_terms_days: 30,
      },
      select: {
        business_id: true,
        invoice_prefix: true,
        invoice_next_number: true,
        quote_prefix: true,
        quote_next_number: true,
        default_vat_rate: true,
        default_payment_terms_days: true,
        created_at: true,
        updated_at: true,
      },
    });

    return created;
  }
}

export const businessService = new BusinessService(prisma);