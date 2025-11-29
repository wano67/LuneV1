/**
 * Personal domain API functions
 */

import { apiFetch } from "./http";
import type {
  PersonalOverview,
  PersonalAccount,
  PersonalTransaction,
  PersonalBudget,
  ApiResponse,
} from "./types";

// -----------------------------------------------------------------------------
// Overview (Swagger: GET /personal/insights/overview)
// -----------------------------------------------------------------------------

export async function fetchPersonalOverview(): Promise<PersonalOverview> {
  const response = await apiFetch<ApiResponse<PersonalOverview>>(
    "/api/v1/personal/insights/overview",
    { auth: true }
  );
  return response.data;
}

// -----------------------------------------------------------------------------
// Accounts (Swagger: /personal/accounts)
// -----------------------------------------------------------------------------

export async function fetchPersonalAccounts(): Promise<PersonalAccount[]> {
  const response = await apiFetch<ApiResponse<PersonalAccount[]>>(
    "/api/v1/personal/accounts",
    { auth: true }
  );
  return response.data;
}

export async function createPersonalAccount(body: {
  name: string;
  type?: string;
  currency?: string;
  initialBalance?: number;
  includeInBudget?: boolean;
  includeInNetWorth?: boolean;
}): Promise<PersonalAccount> {
  const response = await apiFetch<ApiResponse<PersonalAccount>>(
    "/api/v1/personal/accounts",
    { method: "POST", body: body as any, auth: true }
  );
  return response.data;
}


export async function updatePersonalAccount(
  accountId: string,
  body: {
    name?: string;
    type?: string;
    currency?: string;
    isArchived?: boolean;
    includeInBudget?: boolean;
    includeInNetWorth?: boolean;
  }
): Promise<PersonalAccount> {
  const response = await apiFetch<ApiResponse<PersonalAccount>>(
    `/api/v1/personal/accounts/${accountId}`,
    { method: "PATCH", body: body as any, auth: true }
  );
  return response.data;
}

// -----------------------------------------------------------------------------
// Delete Account (Swagger: DELETE /personal/accounts/:id)
// -----------------------------------------------------------------------------

export async function deletePersonalAccount(accountId: string): Promise<{ success: boolean }> {
  const response = await apiFetch<ApiResponse<{ success: boolean }>>(
    `/api/v1/personal/accounts/${accountId}`,
    { method: "DELETE", auth: true }
  );
  return response.data;
}

// -----------------------------------------------------------------------------
// Transactions (Swagger: /personal/transactions)
// -----------------------------------------------------------------------------

export async function fetchPersonalRecentTransactions(
  limit = 5
): Promise<PersonalTransaction[]> {
  const response = await apiFetch<ApiResponse<PersonalTransaction[]>>(
    "/api/v1/personal/transactions",
    { auth: true }
  );
  return response.data.slice(0, limit);
}

export async function fetchPersonalTransactionsAll(): Promise<PersonalTransaction[]> {
  const response = await apiFetch<ApiResponse<PersonalTransaction[]>>(
    "/api/v1/personal/transactions",
    { auth: true }
  );
  return response.data;
}

export async function createPersonalTransaction(body: {
  accountId: string;
  direction: "in" | "out" | "transfer";
  amount: number;
  currency: string;
  occurredAt: string; // 'YYYY-MM-DD'
  label: string;
  category?: string | null;
  notes?: string | null;
}): Promise<PersonalTransaction> {
  const response = await apiFetch<ApiResponse<PersonalTransaction>>(
    "/api/v1/personal/transactions",
    { method: "POST", body: body as any, auth: true }
  );
  return response.data;
}

// -----------------------------------------------------------------------------
// Budgets (Swagger: /personal/budgets)
// -----------------------------------------------------------------------------

export async function fetchPersonalBudgets(): Promise<PersonalBudget[]> {
  const response = await apiFetch<ApiResponse<PersonalBudget[]>>(
    "/api/v1/personal/budgets",
    { auth: true }
  );
  return response.data;
}

export async function createPersonalBudget(body: {
  name: string;
  currency?: string;
  amount: number;
  periodStart: string; // 'YYYY-MM-DD'
  periodEnd: string;   // 'YYYY-MM-DD'
}): Promise<PersonalBudget> {
  const response = await apiFetch<ApiResponse<PersonalBudget>>(
    "/api/v1/personal/budgets",
    { method: "POST", body: body as any, auth: true }
  );
  return response.data;
}
