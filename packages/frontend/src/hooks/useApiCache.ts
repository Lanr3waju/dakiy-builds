import { useState, useEffect, useCallback } from 'react';
import { frontendCache } from '../utils/cache';
import apiClient from '../lib/api';
import { ApiError, ApiErrorHandler } from '../lib/api';

interface UseApiCacheOptions {
  cacheKey: string;
  cacheTTL?: number;
  skipCache?: boolean;
}

interface UseApiCacheResult<T> {
  data: T | null;
  loading: boolean;
  error: ApiError | null;
  refetch: () => Promise<void>;
  invalidate: () => void;
}

/**
 * Custom hook for API calls with automatic caching
 * Reduces unnecessary API calls and improves performance
 */
export function useApiCache<T>(
  endpoint: string,
  options: UseApiCacheOptions
): UseApiCacheResult<T> {
  const { cacheKey, cacheTTL, skipCache = false } = options;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Check cache first
      if (!skipCache) {
        const cachedData = frontendCache.get<T>(cacheKey);
        if (cachedData) {
          setData(cachedData);
          setLoading(false);
          return;
        }
      }

      // Fetch from API
      const response = await apiClient.get(endpoint);
      const responseData = response.data.data || response.data;

      // Cache the result
      if (!skipCache) {
        frontendCache.set(cacheKey, responseData, cacheTTL);
      }

      setData(responseData);
    } catch (err) {
      const apiError = ApiErrorHandler.handleError(err);
      setError(apiError);
    } finally {
      setLoading(false);
    }
  }, [endpoint, cacheKey, cacheTTL, skipCache]);

  const invalidate = useCallback(() => {
    frontendCache.invalidate(cacheKey);
  }, [cacheKey]);

  const refetch = useCallback(async () => {
    invalidate();
    await fetchData();
  }, [fetchData, invalidate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    refetch,
    invalidate,
  };
}

/**
 * Hook for mutations that invalidate cache
 */
export function useApiMutation<TData, TVariables>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options?: {
    onSuccess?: (data: TData) => void;
    onError?: (error: ApiError) => void;
    invalidateKeys?: string[];
  }
) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const mutate = useCallback(
    async (variables: TVariables) => {
      try {
        setLoading(true);
        setError(null);

        const result = await mutationFn(variables);

        // Invalidate cache keys
        if (options?.invalidateKeys) {
          options.invalidateKeys.forEach((key) => {
            frontendCache.invalidate(key);
          });
        }

        if (options?.onSuccess) {
          options.onSuccess(result);
        }

        return result;
      } catch (err) {
        const apiError = ApiErrorHandler.handleError(err);
        setError(apiError);

        if (options?.onError) {
          options.onError(apiError);
        }

        throw apiError;
      } finally {
        setLoading(false);
      }
    },
    [mutationFn, options]
  );

  return {
    mutate,
    loading,
    error,
  };
}
