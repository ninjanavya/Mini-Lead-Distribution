import { useState, useEffect, useCallback, useRef } from 'react';

// ============================================================
// POLLING HOOK
//
// Generic polling hook for real-time dashboard updates.
// Fetches data at a configurable interval (default: 3 seconds).
// Automatically cleans up on unmount.
// ============================================================

export function usePolling<T>(
  fetcher: () => Promise<T>,
  intervalMs: number = 3000
): {
  data: T | null;
  error: string | null;
  isLoading: boolean;
  refetch: () => Promise<void>;
} {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const mountedRef = useRef(true);

  const fetchData = useCallback(async () => {
    try {
      const result = await fetcher();
      if (mountedRef.current) {
        setData(result);
        setError(null);
      }
    } catch (err: unknown) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Fetch failed');
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [fetcher]);

  useEffect(() => {
    mountedRef.current = true;
    fetchData();

    const interval = setInterval(fetchData, intervalMs);

    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, [fetchData, intervalMs]);

  return { data, error, isLoading, refetch: fetchData };
}
