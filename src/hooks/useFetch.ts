import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '@/lib/api';

interface FetchState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  errorCode?: string;
  refetch: () => void;
  setData: (data: T | null) => void;
}

/**
 * Minimal data-fetching hook with abort handling and manual refetch.
 * `path` may be null to skip fetching.
 */
export function useFetch<T>(path: string | null, deps: unknown[] = []): FetchState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(Boolean(path));
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | undefined>();
  const [nonce, setNonce] = useState(0);
  const hasData = useRef(false);

  useEffect(() => {
    if (!path) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    api
      .get<T>(path, controller.signal)
      .then((result) => {
        setData(result);
        hasData.current = true;
        setError(null);
        setErrorCode(undefined);
      })
      .catch((err: unknown) => {
        if ((err as Error).name === 'AbortError') return;
        setError(err instanceof ApiError ? err.message : 'Unable to load data.');
        setErrorCode(err instanceof ApiError ? err.code : undefined);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, nonce, ...deps]);

  const refetch = useCallback(() => setNonce((value) => value + 1), []);

  return { data, loading, error, errorCode, refetch, setData };
}

/** Small helper for one-off mutations with pending state. */
export function useMutation<TArgs extends unknown[], TResult>(fn: (...args: TArgs) => Promise<TResult>) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (...args: TArgs): Promise<TResult> => {
      setPending(true);
      setError(null);
      try {
        return await fn(...args);
      } catch (err) {
        const message = err instanceof ApiError ? err.message : 'Something went wrong.';
        setError(message);
        throw err;
      } finally {
        setPending(false);
      }
    },
    [fn],
  );

  return { run, pending, error, setError };
}
