/**
 * Business domain API functions
 */

import { apiFetch } from './http';
import {
  BusinessSummary,
  BusinessProjectSummary,
  BusinessProjectsPerformance,
  BusinessTopClients,
  BusinessAccount,
  BusinessClient,
  ApiResponse,
  BusinessPipelineInsights,
  BusinessTopClientsInsights,
  BusinessTopServicesInsights,
} from './types';

/**
 * Fetch all businesses for the authenticated user
 */
export async function fetchBusinesses(): Promise<BusinessSummary[]> {
  const response = await apiFetch<ApiResponse<BusinessSummary[]>>(
    '/api/v1/businesses',
    { auth: true }
  );
  return response.data;
}

/**
 * Fetch projects for a specific business
 */
export async function fetchBusinessProjects(
  businessId: string
): Promise<BusinessProjectSummary[]> {
  const response = await apiFetch<ApiResponse<BusinessProjectSummary[]>>(
    `/api/v1/businesses/${businessId}/projects`,
    { auth: true }
  );
  return response.data;
}

/**
 * Fetch accounts for a business
 */
export async function fetchBusinessAccounts(
  businessId: string
): Promise<BusinessAccount[]> {
  const response = await apiFetch<ApiResponse<BusinessAccount[]>>(
    `/businesses/${businessId}/accounts`,
    { auth: true }
  );
  return response.data;
}

/**
 * Fetch project performance metrics for a business
 */
export async function fetchBusinessProjectsPerformance(
  businessId: string
): Promise<BusinessProjectsPerformance> {
  const response = await apiFetch<ApiResponse<BusinessProjectsPerformance>>(
    `/api/v1/businesses/${businessId}/insights/projects-performance`,
    { auth: true }
  );
  return response.data;
}

/**
 * Fetch top clients for a business
 */
export async function fetchBusinessTopClients(
  businessId: string
): Promise<BusinessTopClients> {
  const response = await apiFetch<ApiResponse<BusinessTopClients>>(
    `/api/v1/businesses/${businessId}/insights/top-clients`,
    { auth: true }
  );
  return response.data;
}

export async function fetchBusinessClients(
  businessId: string
): Promise<BusinessClient[]> {
  const response = await apiFetch<ApiResponse<BusinessClient[]>>(
    `/api/v1/businesses/${businessId}/clients`,
    { auth: true }
  );
  return response.data;
}

export async function createBusinessClient(
  businessId: string,
  payload: {
    name: string;
    type: "individual" | "company";
    email?: string;
    phone?: string;
    companyName?: string;
    vatNumber?: string;
    address?: string;
    notes?: string;
  }
  ): Promise<BusinessClient> {
  const response = await apiFetch<ApiResponse<BusinessClient>>(
    `/api/v1/businesses/${businessId}/clients`,
    { method: "POST", body: payload as any, auth: true }
  );
  return response.data;
}

export async function createBusinessProject(
  businessId: string,
  payload: {
    name: string;
    description?: string;
    currency: string;
    status: string;
    startDate?: string;
    dueDate?: string;
    priority?: string;
    budgetAmount?: number;
    clientId?: string;
    services?: {
      serviceId: string;
      quantity: number;
      customLabel?: string;
    }[];
  }
): Promise<BusinessProjectSummary> {
  const response = await apiFetch<ApiResponse<BusinessProjectSummary>>(
    `/api/v1/businesses/${businessId}/projects`,
    { method: "POST", body: payload as any, auth: true }
  );
  return response.data;
}

export async function getBusinessProjects(
  businessId: string
): Promise<BusinessProjectSummary[]> {
  return fetchBusinessProjects(businessId);
}

export async function getBusinessInvoices(
  businessId: string
): Promise<any[]> {
  const response = await apiFetch<ApiResponse<any[]>>(
    `/api/v1/businesses/${businessId}/invoices`,
    { auth: true }
  );
  return response.data;
}

export async function createBusinessInvoice(
  businessId: string,
  payload: {
    clientId: string;
    projectId?: string;
    currency: string;
    issuedAt: string;
    dueAt?: string;
    notes?: string;
    items: {
      serviceId?: string;
      description: string;
      quantity: number;
      unitPrice: number;
      vatRate: number;
    }[];
  }
): Promise<any> {
  const response = await apiFetch<ApiResponse<any>>(
    `/api/v1/businesses/${businessId}/invoices`,
    { method: 'POST', body: payload as any, auth: true }
  );
  return response.data;
}

export async function getBusinessServices(
  businessId: string
): Promise<any[]> {
  const response = await apiFetch<ApiResponse<any[]>>(
    `/api/v1/businesses/${businessId}/services`,
    { auth: true }
  );
  return response.data;
}

export async function getBusinessPipelineInsights(
  businessId: string
): Promise<BusinessPipelineInsights> {
  const response = await apiFetch<ApiResponse<BusinessPipelineInsights>>(
    `/api/v1/businesses/${businessId}/insights/pipeline`,
    { auth: true }
  );
  return response.data;
}

export async function getBusinessTopClients(
  businessId: string,
  params?: { from?: string; to?: string }
): Promise<BusinessTopClientsInsights> {
  const query =
    params && (params.from || params.to)
      ? `?${new URLSearchParams({
          ...(params.from ? { from: params.from } : {}),
          ...(params.to ? { to: params.to } : {}),
        }).toString()}`
      : '';

  const response = await apiFetch<ApiResponse<BusinessTopClientsInsights>>(
    `/api/v1/businesses/${businessId}/insights/top-clients${query}`,
    { auth: true }
  );
  return response.data;
}

export async function getBusinessTopServices(
  businessId: string,
  params?: { from?: string; to?: string }
): Promise<BusinessTopServicesInsights> {
  const query =
    params && (params.from || params.to)
      ? `?${new URLSearchParams({
          ...(params.from ? { from: params.from } : {}),
          ...(params.to ? { to: params.to } : {}),
        }).toString()}`
      : '';

  const response = await apiFetch<ApiResponse<BusinessTopServicesInsights>>(
    `/api/v1/businesses/${businessId}/insights/top-services${query}`,
    { auth: true }
  );
  return response.data;
}

export async function getBusinessQuotes(
  businessId: string
): Promise<any[]> {
  const response = await apiFetch<ApiResponse<any[]>>(
    `/api/v1/businesses/${businessId}/quotes`,
    { auth: true }
  );
  return response.data;
}

export async function createBusinessQuote(
  businessId: string,
  payload: {
    clientId: string;
    projectId?: string;
    title?: string;
    currency: string;
    validUntil: string;
    notes?: string;
    items: {
      serviceId?: string;
      description: string;
      quantity: number;
      unitPrice: number;
      vatRate: number;
    }[];
  }
): Promise<any> {
  const response = await apiFetch<ApiResponse<any>>(
    `/api/v1/businesses/${businessId}/quotes`,
    { method: 'POST', body: payload as any, auth: true }
  );
  return response.data;
}

export async function acceptBusinessQuote(quoteId: string): Promise<any> {
  const response = await apiFetch<ApiResponse<any>>(
    `/api/v1/quotes/${quoteId}/accept`,
    { method: 'POST', auth: true }
  );
  return response.data;
}

export async function createInvoiceFromQuote(
  quoteId: string
): Promise<{ invoiceId: string }> {
  const response = await apiFetch<ApiResponse<{ invoiceId: string }>>(
    `/api/v1/quotes/${quoteId}/invoices`,
    { method: 'POST', auth: true }
  );
  return response.data;
}

export async function updateBusinessQuote(
  quoteId: string,
  payload: Partial<{
    status: string;
    notes: string;
    issueDate: string;
    validUntil: string;
    items: {
      serviceId?: string;
      description: string;
      quantity: number;
      unitPrice: number;
      vatRate: number;
    }[];
  }>
): Promise<any> {
  const response = await apiFetch<ApiResponse<any>>(
    `/api/v1/quotes/${quoteId}`,
    { method: 'PATCH', body: payload as any, auth: true }
  );
  return response.data;
}

export async function deleteBusinessQuote(quoteId: string): Promise<void> {
  await apiFetch<void>(`/api/v1/quotes/${quoteId}`, {
    method: 'DELETE',
    auth: true,
  });
}

export async function updateBusinessInvoice(
  invoiceId: string,
  payload: Partial<{
    status: string;
    dueAt: string;
    notes: string;
  }>
): Promise<any> {
  const response = await apiFetch<ApiResponse<any>>(
    `/api/v1/invoices/${invoiceId}`,
    { method: 'PATCH', body: payload as any, auth: true }
  );
  return response.data;
}

export async function deleteBusinessInvoice(invoiceId: string): Promise<void> {
  await apiFetch<void>(`/api/v1/invoices/${invoiceId}`, {
    method: 'DELETE',
    auth: true,
  });
}

export async function addInvoicePayment(
  invoiceId: string,
  payload: {
    amount: number;
    accountId: string;
    paidAt: string;
    method?: string;
    notes?: string;
    label?: string;
  }
): Promise<any> {
  const response = await apiFetch<ApiResponse<any>>(
    `/api/v1/invoices/${invoiceId}/payments`,
    { method: 'POST', body: payload as any, auth: true }
  );
  return response.data;
}

export async function createBusinessTransaction(
  businessId: string,
  payload: {
    accountId: string;
    direction: 'in' | 'out';
    amount: number;
    currency: string;
    occurredAt: string;
    label: string;
    category?: string;
    notes?: string;
  }
): Promise<any> {
  const response = await apiFetch<ApiResponse<any>>(
    `/businesses/${businessId}/transactions`,
    { method: 'POST', body: payload as any, auth: true }
  );
  return response.data;
}

export type {
  BusinessSummary,
  BusinessProjectSummary,
  BusinessProjectsPerformance,
  BusinessTopClients,
  BusinessAccount,
  BusinessClient,
  BusinessPipelineInsights,
  BusinessTopClientsInsights,
  BusinessTopServicesInsights,
};
