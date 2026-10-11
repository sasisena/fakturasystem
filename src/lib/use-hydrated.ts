import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};

/** true når siden er klar i nettleseren. Brukes til å holde knapper inaktive til skjemaet virker. */
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
