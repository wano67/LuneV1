/**
 * Custom hooks for Business domain data
 */

'use client';

import { useEffect, useState } from 'react';
import {
  fetchBusinesses,
  fetchBusinessProjects,
  fetchBusinessAccounts,
  fetchBusinessProjectsPerformance,
  fetchBusinessTopClients,
  fetchBusinessClients,
  createBusinessClient,
  createBusinessProject,
  getBusinessInvoices,
  createBusinessInvoice,
  getBusinessServices,
  getBusinessPipelineInsights,
  getBusinessTopClients as getBusinessTopClientsInsights,
  getBusinessTopServices,
  getBusinessQuotes,
  createBusinessQuote,
  acceptBusinessQuote,
  createInvoiceFromQuote,
  updateBusinessQuote,
  deleteBusinessQuote,
  updateBusinessInvoice,
  deleteBusinessInvoice,
  addInvoicePayment,
  createBusinessTransaction,
} from '@/lib/api/business';
import type {
  BusinessSummary,
  BusinessProjectSummary,
  BusinessProjectsPerformance,
  BusinessTopClients,
  BusinessAccount,
  BusinessClient,
  BusinessPipelineInsights,
  BusinessTopClientsInsights,
  BusinessTopServicesInsights,
} from '@/lib/api/types';

interface UseDataState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  reload: () => void;
}

/**
 * Hook to fetch all businesses
 */
export function useBusinesses(): UseDataState<BusinessSummary[]> {
  const [data, setData] = useState<BusinessSummary[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const reload = () => setReloadToken((x) => x + 1);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await fetchBusinesses();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch businesses'));
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [reloadToken]);

  return { data, loading, error, reload };
}

/**
 * Hook to pick the first active business as current
 */
export function useActiveBusiness(): UseDataState<BusinessSummary | null> {
  const businesses = useBusinesses();
  const [selected, setSelected] = useState<BusinessSummary | null>(null);

  useEffect(() => {
    if (businesses.data && businesses.data.length > 0) {
      setSelected(businesses.data[0]);
    }
  }, [businesses.data]);

  return {
    data: selected,
    loading: businesses.loading,
    error: businesses.error,
    reload: businesses.reload,
  };
}

/**
 * Hook to fetch projects for a specific business
 */
export function useBusinessProjects(
  businessId: string | undefined
): UseDataState<BusinessProjectSummary[]> {
  const [data, setData] = useState<BusinessProjectSummary[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const reload = () => setReloadToken((x) => x + 1);

  useEffect(() => {
    // Skip if businessId is not provided
    if (!businessId) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await fetchBusinessProjects(businessId);
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch business projects'));
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [businessId, reloadToken]);

  return { data, loading, error, reload };
}

/**
 * Hook to fetch business accounts
 */
export function useBusinessAccounts(
  businessId: string | undefined
): UseDataState<BusinessAccount[]> {
  const [data, setData] = useState<BusinessAccount[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const reload = () => setReloadToken((x) => x + 1);

  useEffect(() => {
    if (!businessId) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await fetchBusinessAccounts(businessId);
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch business accounts'));
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [businessId, reloadToken]);

  return { data, loading, error, reload };
}

/**
 * Hook to fetch clients for a business
 */
export function useBusinessClients(
  businessId: string | undefined
): UseDataState<BusinessClient[]> {
  const [data, setData] = useState<BusinessClient[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const reload = () => setReloadToken((x) => x + 1);

  useEffect(() => {
    if (!businessId) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await fetchBusinessClients(businessId);
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch business clients'));
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [businessId, reloadToken]);

  return { data, loading, error, reload };
}

/**
 * Hook to fetch both performance metrics and top clients for a business
 * Returns combined data from both endpoints
 */
export function useBusinessPerformance(businessId: string | undefined): UseDataState<{
  performance: BusinessProjectsPerformance | null;
  topClients: BusinessTopClients | null;
}> {
  const [data, setData] = useState<{
    performance: BusinessProjectsPerformance | null;
    topClients: BusinessTopClients | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const reload = () => setReloadToken((x) => x + 1);

  useEffect(() => {
    // Skip if businessId is not provided
    if (!businessId) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }

    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch both in parallel
        const [performance, topClients] = await Promise.all([
          fetchBusinessProjectsPerformance(businessId),
          fetchBusinessTopClients(businessId),
        ]);

        setData({ performance, topClients });
      } catch (err) {
        setError(
          err instanceof Error
            ? err
            : new Error('Failed to fetch business performance data')
        );
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [businessId, reloadToken]);

  return { data, loading, error, reload };
}

export function useBusinessInvoices(
  businessId: string | undefined
): UseDataState<any[]> {
  const [data, setData] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const reload = () => setReloadToken((x) => x + 1);

  useEffect(() => {
    if (!businessId) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await getBusinessInvoices(businessId);
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch business invoices'));
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [businessId, reloadToken]);

  return { data, loading, error, reload };
}

export function useBusinessServices(
  businessId: string | undefined
): UseDataState<any[]> {
  const [data, setData] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const reload = () => setReloadToken((x) => x + 1);

  useEffect(() => {
    if (!businessId) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await getBusinessServices(businessId);
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch business services'));
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [businessId, reloadToken]);

  return { data, loading, error, reload };
}

export function useBusinessPipeline(
  businessId: string | undefined
): UseDataState<BusinessPipelineInsights> {
  const [data, setData] = useState<BusinessPipelineInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const reload = () => setReloadToken((x) => x + 1);

  useEffect(() => {
    if (!businessId) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await getBusinessPipelineInsights(businessId);
        setData(result);
      } catch (err) {
        setError(
          err instanceof Error ? err : new Error('Failed to fetch pipeline insights')
        );
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [businessId, reloadToken]);

  return { data, loading, error, reload };
}

export function useBusinessTopClients(
  businessId: string | undefined
): UseDataState<BusinessTopClientsInsights> {
  const [data, setData] = useState<BusinessTopClientsInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const reload = () => setReloadToken((x) => x + 1);

  useEffect(() => {
    if (!businessId) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await getBusinessTopClientsInsights(businessId);
        setData(result);
      } catch (err) {
        setError(
          err instanceof Error
            ? err
            : new Error('Failed to fetch top clients insights')
        );
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [businessId, reloadToken]);

  return { data, loading, error, reload };
}

export function useBusinessTopServices(
  businessId: string | undefined
): UseDataState<BusinessTopServicesInsights> {
  const [data, setData] = useState<BusinessTopServicesInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const reload = () => setReloadToken((x) => x + 1);

  useEffect(() => {
    if (!businessId) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await getBusinessTopServices(businessId);
        setData(result);
      } catch (err) {
        setError(
          err instanceof Error
            ? err
            : new Error('Failed to fetch top services insights')
        );
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [businessId, reloadToken]);

  return { data, loading, error, reload };
}

export function useBusinessQuotes(
  businessId: string | undefined
): UseDataState<any[]> {
  const [data, setData] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const reload = () => setReloadToken((x) => x + 1);

  useEffect(() => {
    if (!businessId) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await getBusinessQuotes(businessId);
        setData(result);
      } catch (err) {
        setError(
          err instanceof Error ? err : new Error('Failed to fetch business quotes')
        );
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [businessId, reloadToken]);

  return { data, loading, error, reload };
}

export const businessActions = {
  createClient: createBusinessClient,
  createProject: createBusinessProject,
  createInvoice: createBusinessInvoice,
  createQuote: createBusinessQuote,
  acceptQuote: acceptBusinessQuote,
  createInvoiceFromQuote,
  updateQuote: updateBusinessQuote,
  deleteQuote: deleteBusinessQuote,
  updateInvoice: updateBusinessInvoice,
  deleteInvoice: deleteBusinessInvoice,
  addInvoicePayment,
  recordBusinessTransaction: createBusinessTransaction,
};
