/**
 * The engine reports ring progress every frame. Routing it through this tiny store
 * lets the ring repaint directly without re-rendering React 60 times a second.
 */
export interface ProgressStore {
  get(): number;
  set(value: number): void;
  subscribe(listener: (value: number) => void): () => void;
}

export function createProgressStore(): ProgressStore {
  let current = 0;
  const listeners = new Set<(value: number) => void>();
  return {
    get: () => current,
    set: (value) => {
      current = value;
      listeners.forEach((listener) => listener(value));
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
