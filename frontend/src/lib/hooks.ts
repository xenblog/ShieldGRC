'use client';

import { Dispatch, SetStateAction, useEffect, useState } from 'react';
import { api } from './api-client';

interface UseApiGetResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  setData: Dispatch<SetStateAction<T | null>>;
}

/**
 * GETs `path` and re-fetches whenever it (or anything in `deps`) changes.
 * Pass `null` for `path` to skip fetching entirely (e.g. a flat/grouped
 * toggle where only one of the two paths should ever be live) - see
 * RiskRegisterPage for that pattern.
 */
export function useApiGet<T>(path: string | null, deps: unknown[] = []): UseApiGetResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(path !== null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (path === null) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .get<T>(path)
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load');
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, ...deps]);

  return { data, loading, error, setData };
}
