import { useCallback, useEffect, useRef, useState } from "react";

export interface SwapItem<T> {
  id: number;
  value: T;
}

/**
 * Keeps the previous value mounted beside the new one, so the old one can animate out
 * while the new one animates in. Call `drop(id)` when the outgoing animation finishes.
 */
export function useSwap<T>(value: T) {
  const [items, setItems] = useState<SwapItem<T>[]>(() => [{ id: 0, value }]);
  const nextId = useRef(1);

  useEffect(() => {
    setItems((current) => {
      const last = current[current.length - 1];
      if (Object.is(last.value, value)) return current;
      return [last, { id: nextId.current++, value }];
    });
  }, [value]);

  const drop = useCallback((id: number) => {
    setItems((current) =>
      current.length > 1 && current.some((item) => item.id === id)
        ? current.filter((item) => item.id !== id)
        : current,
    );
  }, []);

  return { items, drop };
}
