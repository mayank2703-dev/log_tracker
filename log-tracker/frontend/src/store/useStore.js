import { useSyncExternalStore } from 'react';
import { getState, subscribe } from './store.js';

// Selectors must return primitives or *stable* references
// (see EMPTY in config.js) so React can bail out of renders.
export function useStore(selector) {
  return useSyncExternalStore(
    subscribe,
    () => selector(getState()),
    () => selector(getState()),
  );
}
