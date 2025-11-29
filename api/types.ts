/**
 * TypeScript types for Lune API responses
 * Derived from the backend schemas
 */

// ============================================
// PERSONAL DOMAIN
// ============================================

export interface PersonalInsightsMonthlyPoint {
  month: string; // "2025-12"
  income: number;
  spending: number;
  net: number;
}

export interface PersonalInsightsBudgetSnapshot {
  id: string;
  name: string;
  currency: string;
  amount: number;
  spent: number;
  remaining: number;
  consumptionRate: number;
  periodStart: string;
  periodEnd: string;
}

export interface PersonalInsightsOverview {
  totalBalance: number;
  totalAccounts: number;
  baseCurrency: string;
  month: string; // "2025-12"
  monthIncome: number;
  monthSpending: number;
  monthNet: number;
  last3Months: PersonalInsightsMonthlyPoint[];
  budgets: PersonalInsightsBudgetSnapshot[];
  generatedAt: string;
}

export interface PersonalAccount {
  id: string;
  userId: string;
  name: string;
  type: string | null;
  currency: string;
  isArchived: boolean;
  includeInBudget?: boolean;
  includeInNetWorth?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PersonalTransaction {
  id: string;
  userId: string;
  accountId: string;
  direction: 'in' | 'out' | 'transfer';
  amount: number;
  currency: string;
  occurredAt: string;
  label: string;
  category: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PersonalBudget {
  id: string;
  userId: string;
  name: string;
  currency: string;
  amount: number;
  periodStart: string;
  periodEnd: string;
  createdAt: string;
  updatedAt: string;
}

export interface PersonalOverviewBudget {
  id: string;
  name: string;
  currency: string;
  amount: number;
  spent: number;
  remaining: number;
  consumptionRate: number;
  periodStart: string;
  periodEnd: string;
}

export interface PersonalOverviewMonth {
  month: string;
  income: number;
  spending: number;
  net: number;
}

export interface PersonalOverview {
  totalBalance: number;
  totalAccounts: number;
  baseCurrency: string;
  month: string;
  monthIncome: number;
  monthSpending: number;
  monthNet: number;
  last3Months: PersonalOverviewMonth[];
  budgets: PersonalOverviewBudget[];
  generatedAt: string;
}

// ============================================
// BUSINESS DOMAIN
// ============================================

export interface BusinessSettings {
  businessId: string;
  invoicePrefix: string | null;
  invoiceNextNumber: number;
  quotePrefix: string | null;
  quoteNextNumber: number;
  defaultVatRate: number | null;
  defaultPaymentTermsDays: number;
  createdAt: string;
  updatedAt: string;
}

export interface Business {
  id: string;
  userId: string;
  name: string;
  legalForm: string | null;
  registrationNumber: string | null;
  taxId: string | null;
  currency: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BusinessSummary {
  business: Business;
  settings: BusinessSettings;
}

export interface BusinessAccount {
  id: string;
  userId: string;
  businessId: string;
  name: string;
  type: string | null;
  currency: string | null;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BusinessProjectSummary {
  id: string;
  userId: string;
  businessId: string | null;
  clientId: string | null;
  name: string;
  description: string | null;
  status: string; // 'planning' | 'in_progress' | 'completed' | 'on_hold' | 'cancelled'
  startDate: string | null;
  dueDate: string | null;
  completedAt: string | null;
  budgetAmount: number | null;
  currency: string | null;
  priority: string | null;
  progressManualPct: number | null;
  progressAutoMode: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectStatusDistribution {
  status: string;
  count: number;
}

export interface BusinessProjectsPerformance {
  businessId: string;
  totalProjects: number;
  completedProjects: number;
  onTimeProjects: number;
  onTimeRate: number; // 0..1
  averageDurationDays: number;
  averageDelayDays: number;
  statusDistribution: ProjectStatusDistribution[];
  generatedAt: string;
}

export interface TopClient {
  clientId: string;
  name: string;
  totalInvoiced: number;
  totalPaid: number;
  projectCount: number;
  averageInvoice: number;
  lastActivityAt: string | null;
}

export interface BusinessTopClients {
  businessId: string;
  currency: string;
  period: {
    from: string;
    to: string;
  };
  topClients: TopClient[];
  generatedAt: string;
}

export interface BusinessPipelineInsights {
  businessId: string;
  quoteCount: number;
  acceptedCount: number;
  conversionRate: number;
  avgTimeToAcceptDays: number;
  totalQuoted: number;
  totalAccepted: number;
  generatedAt: string;
}

export interface BusinessTopClientsInsights {
  businessId: string;
  currency: string;
  period: { from: string; to: string };
  topClients: {
    clientId: string;
    name: string;
    totalInvoiced: number;
    totalPaid: number;
    projectCount: number;
    averageInvoice: number;
    lastActivityAt: string | null;
  }[];
  generatedAt: string;
}

export interface BusinessTopServicesInsights {
  businessId: string;
  currency: string;
  period: { from: string; to: string };
  topServices: {
    serviceId: string;
    name: string;
    totalInvoiced: number;
    totalPaid: number;
    projectCount: number;
    averagePrice: number;
    lastActivityAt: string | null;
  }[];
  generatedAt: string;
}

export interface BusinessClient {
  id: string;
  userId: string;
  businessId: string | null;
  name: string;
  type: "individual" | "company";
  email: string | null;
  phone: string | null;
  companyName: string | null;
  vatNumber: string | null;
  address: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// API RESPONSE WRAPPERS
// ============================================

export interface ApiResponse<T> {
  data: T;
}

export interface ApiListResponse<T> {
  data: T[];
}
