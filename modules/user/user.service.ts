import { PrismaClient, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export type UserId = number | bigint;

export type RiskTolerance = 'low' | 'medium' | 'high';
export type NotificationLevel = 'none' | 'light' | 'normal' | 'coach';

export interface CreateUserInput {
  email: string;
  passwordHash: string;
  displayName?: string | null;

  mainCurrency?: string;
  firstDayOfMonth?: number;
  riskTolerance?: RiskTolerance | null;
  notificationLevel?: NotificationLevel | null;
  mainGoalType?: string | null;
}

export interface UpdateUserProfileInput {
  displayName?: string | null;
  email?: string;
}

export interface UpdateUserSettingsInput {
  mainCurrency?: string;
  firstDayOfMonth?: number;
  riskTolerance?: RiskTolerance | null;
  notificationLevel?: NotificationLevel | null;
  mainGoalType?: string | null;
}

export interface UserWithSettings {
  user: Prisma.usersGetPayload<{
    select: { id: true; email: true; display_name: true; created_at: true; updated_at: true };
  }>;
  settings: Prisma.user_settingsGetPayload<{
    select: {
      user_id: true;
      main_currency: true;
      first_day_of_month: true;
      risk_tolerance: true;
      notification_level: true;
      main_goal_type: true;
      created_at: true;
      updated_at: true;
    };
  }>;
}

export class UserNotFoundError extends Error {
  constructor(message = 'User not found') {
    super(message);
    this.name = 'UserNotFoundError';
  }
}

export class EmailAlreadyInUseError extends Error {
  constructor(message = 'Email is already in use') {
    super(message);
    this.name = 'EmailAlreadyInUseError';
  }
}

export class InvalidUserSettingsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidUserSettingsError';
  }
}

function normalizeId(id: UserId): bigint {
  return typeof id === 'bigint' ? id : BigInt(id);
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function validateSettingsInput(input: UpdateUserSettingsInput | CreateUserInput) {
  if (input.firstDayOfMonth != null) {
    if (!Number.isInteger(input.firstDayOfMonth) || input.firstDayOfMonth < 1 || input.firstDayOfMonth > 28) {
      throw new InvalidUserSettingsError('firstDayOfMonth must be an integer between 1 and 28');
    }
  }

  if (input.riskTolerance != null) {
    const allowed: RiskTolerance[] = ['low', 'medium', 'high'];
    if (!allowed.includes(input.riskTolerance)) {
      throw new InvalidUserSettingsError('Invalid riskTolerance');
    }
  }

  if (input.notificationLevel != null) {
    const allowed: NotificationLevel[] = ['none', 'light', 'normal', 'coach'];
    if (!allowed.includes(input.notificationLevel)) {
      throw new InvalidUserSettingsError('Invalid notificationLevel');
    }
  }
}

export class UserService {
  constructor(private readonly prismaClient: PrismaClient) {}

  async createUserWithDefaultSettings(input: CreateUserInput): Promise<UserWithSettings> {
    const email = normalizeEmail(input.email);
    validateSettingsInput(input);

    try {
      const result = await this.prismaClient.$transaction(async (tx) => {
        const user = await tx.users.create({
          data: {
            email,
            password_hash: input.passwordHash,
            display_name: input.displayName ?? null,
          },
          select: {
            id: true,
            email: true,
            password_hash: true,
            display_name: true,
            created_at: true,
            updated_at: true,
          },
        });

        const settings = await tx.user_settings.create({
          data: {
            user_id: user.id,
            main_currency: input.mainCurrency ?? 'EUR',
            first_day_of_month: input.firstDayOfMonth ?? 1,
            risk_tolerance: input.riskTolerance ?? null,
            notification_level: input.notificationLevel ?? 'normal',
            main_goal_type: input.mainGoalType ?? null,
          },
          select: {
            user_id: true,
            main_currency: true,
            first_day_of_month: true,
            risk_tolerance: true,
            notification_level: true,
            main_goal_type: true,
            created_at: true,
            updated_at: true,
          },
        });

        return { user, settings };
      });

      return {
        user: {
          id: result.user.id,
          email: result.user.email,
          display_name: result.user.display_name,
          created_at: result.user.created_at,
          updated_at: result.user.updated_at,
        },
        settings: result.settings,
      };
    } catch (err: any) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new EmailAlreadyInUseError();
      }
      throw err;
    }
  }

  async getUserWithSettingsById(id: UserId): Promise<UserWithSettings> {
    const userId = normalizeId(id);

    const user = await this.prismaClient.users.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        display_name: true,
        created_at: true,
        updated_at: true,
      },
    });

    if (!user) {
      throw new UserNotFoundError();
    }

    const settings = await this.prismaClient.user_settings.findUnique({
      where: { user_id: userId },
      select: {
        user_id: true,
        main_currency: true,
        first_day_of_month: true,
        risk_tolerance: true,
        notification_level: true,
        main_goal_type: true,
        created_at: true,
        updated_at: true,
      },
    });

    if (!settings) {
      throw new UserNotFoundError('User settings not found for this user');
    }

    return { user, settings };
  }

  async getUserByEmail(email: string) {
    const normalized = normalizeEmail(email);

    const user = await this.prismaClient.users.findFirst({
      where: { email: normalized },
      select: {
        id: true,
        email: true,
        display_name: true,
        password_hash: true,
        created_at: true,
        updated_at: true,
      },
    });

    if (!user) {
      throw new UserNotFoundError();
    }

    return user;
  }

  async ensureUserSettings(userIdInput: UserId): Promise<UserWithSettings> {
    const userId = normalizeId(userIdInput);

    const user = await this.prismaClient.users.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        display_name: true,
        created_at: true,
        updated_at: true,
      },
    });

    if (!user) {
      throw new UserNotFoundError();
    }

    let settings = await this.prismaClient.user_settings.findUnique({
      where: { user_id: userId },
      select: {
        user_id: true,
        main_currency: true,
        first_day_of_month: true,
        risk_tolerance: true,
        notification_level: true,
        main_goal_type: true,
        created_at: true,
        updated_at: true,
      },
    });

    if (!settings) {
      settings = await this.prismaClient.user_settings.create({
        data: {
          user_id: userId,
          main_currency: 'EUR',
          first_day_of_month: 1,
          risk_tolerance: null,
          notification_level: 'normal',
          main_goal_type: null,
        },
        select: {
          user_id: true,
          main_currency: true,
          first_day_of_month: true,
          risk_tolerance: true,
          notification_level: true,
          main_goal_type: true,
          created_at: true,
          updated_at: true,
        },
      });
    }

    return { user, settings };
  }

  async updateUserProfile(userIdInput: UserId, input: UpdateUserProfileInput) {
    const userId = normalizeId(userIdInput);

    const data: Prisma.usersUpdateInput = {};
    if (input.displayName !== undefined) {
      data.display_name = input.displayName;
    }
    if (input.email !== undefined) {
      data.email = normalizeEmail(input.email);
    }

    if (Object.keys(data).length === 0) {
      return this.getUserWithSettingsById(userId);
    }

    try {
      const user = await this.prismaClient.users.update({
        where: { id: userId },
        data,
        select: {
          id: true,
          email: true,
          display_name: true,
          created_at: true,
          updated_at: true,
        },
      });

      const settings = await this.prismaClient.user_settings.findUnique({
        where: { user_id: userId },
        select: {
          user_id: true,
          main_currency: true,
          first_day_of_month: true,
          risk_tolerance: true,
          notification_level: true,
          main_goal_type: true,
          created_at: true,
          updated_at: true,
        },
      });

      if (!settings) {
        throw new UserNotFoundError('User settings not found after profile update');
      }

      return { user, settings };
    } catch (err: any) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new EmailAlreadyInUseError();
      }
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        throw new UserNotFoundError();
      }
      throw err;
    }
  }

  async updateUserSettings(userIdInput: UserId, input: UpdateUserSettingsInput): Promise<UserWithSettings> {
    const userId = normalizeId(userIdInput);

    validateSettingsInput(input);

    const user = await this.prismaClient.users.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        display_name: true,
        created_at: true,
        updated_at: true,
      },
    });

    if (!user) {
      throw new UserNotFoundError();
    }

    const existingSettings = await this.prismaClient.user_settings.findUnique({
      where: { user_id: userId },
    });

    if (!existingSettings) {
      const created = await this.prismaClient.user_settings.create({
        data: {
          user_id: userId,
          main_currency: input.mainCurrency ?? 'EUR',
          first_day_of_month: input.firstDayOfMonth ?? 1,
          risk_tolerance: input.riskTolerance ?? null,
          notification_level: input.notificationLevel ?? 'normal',
          main_goal_type: input.mainGoalType ?? null,
        },
        select: {
          user_id: true,
          main_currency: true,
          first_day_of_month: true,
          risk_tolerance: true,
          notification_level: true,
          main_goal_type: true,
          created_at: true,
          updated_at: true,
        },
      });

      return { user, settings: created };
    }

    const data: Prisma.user_settingsUpdateInput = {};
    if (input.mainCurrency !== undefined) data.main_currency = input.mainCurrency;
    if (input.firstDayOfMonth !== undefined) data.first_day_of_month = input.firstDayOfMonth;
    if (input.riskTolerance !== undefined) data.risk_tolerance = input.riskTolerance;
    if (input.notificationLevel !== undefined) data.notification_level = input.notificationLevel;
    if (input.mainGoalType !== undefined) data.main_goal_type = input.mainGoalType;

    const settings = await this.prismaClient.user_settings.update({
      where: { user_id: userId },
      data,
      select: {
        user_id: true,
        main_currency: true,
        first_day_of_month: true,
        risk_tolerance: true,
        notification_level: true,
        main_goal_type: true,
        created_at: true,
        updated_at: true,
      },
    });

    return { user, settings };
  }

  async deleteUser(userIdInput: UserId): Promise<void> {
    const userId = normalizeId(userIdInput);

    try {
      await this.prismaClient.users.delete({
        where: { id: userId },
      });
    } catch (err: any) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        throw new UserNotFoundError();
      }
      throw err;
    }
  }
}

export const userService = new UserService(prisma);
