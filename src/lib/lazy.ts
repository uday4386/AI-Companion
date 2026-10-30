import { lazy, type ComponentType } from 'react';

/**
 * `React.lazy` with recovery.
 *
 * Every route is a separate chunk. When a chunk URL goes stale — a dev-server
 * restart, a redeploy with new hashes, or a transient network blip — the
 * dynamic import rejects and the route renders nothing at all. That failure is
 * invisible to the user ("the page just doesn't open") and is fixed by a reload,
 * so we retry the import once and then reload the document a single time.
 *
 * A session guard prevents a reload loop when the chunk is genuinely gone.
 */
const RELOAD_KEY = 'sentinel:chunk-reload';

function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /dynamically imported module|Importing a module script failed|Loading (CSS )?chunk .* failed|Failed to fetch/i.test(message);
}

export function lazyWithRetry<T extends ComponentType<unknown>>(
  factory: () => Promise<{ default: T }>,
) {
  return lazy(async () => {
    try {
      return await factory();
    } catch (error) {
      if (!isChunkLoadError(error)) throw error;

      // One retry: the server may have been restarted since the page loaded.
      try {
        return await factory();
      } catch {
        const lastReload = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
        const canReload = Date.now() - lastReload > 10_000;
        if (canReload) {
          sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
          window.location.reload();
          // Render a spinner while the document reloads.
          return await new Promise<{ default: T }>(() => {});
        }
        throw error;
      }
    }
  });
}
