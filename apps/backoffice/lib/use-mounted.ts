import { useSyncExternalStore } from 'react';

const subscribe = () => () => undefined;

/**
 * False in the server's HTML and true once the page runs in the browser: for
 * a component that would put an inline style in the server's HTML, which the
 * CSP drops (ADR 0020, E5).
 */
export function useMounted(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
