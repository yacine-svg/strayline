"use client";

import { useRef } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { useSwap } from "@/lib/useSwap";

gsap.registerPlugin(useGSAP);

interface Props {
  text: string;
  reducedMotion: boolean;
}

/** Swaps a line of text with a short cross-fade and a slight vertical drift. */
export function CrossFade({ text, reducedMotion }: Props) {
  const { items, drop } = useSwap(text);
  const scope = useRef<HTMLSpanElement>(null);

  useGSAP(
    () => {
      if (items.length < 2) return;
      const [outgoing, incoming] = items;
      const root = scope.current;
      const outEl = root?.querySelector<HTMLElement>(`[data-swap="${outgoing.id}"]`);
      const inEl = root?.querySelector<HTMLElement>(`[data-swap="${incoming.id}"]`);
      if (!outEl || !inEl) return;
      const shift = reducedMotion ? 0 : 10;
      gsap.killTweensOf([outEl, inEl]);
      gsap.to(outEl, {
        opacity: 0,
        y: -shift,
        duration: 0.3,
        ease: "power1.in",
        onComplete: () => drop(outgoing.id),
      });
      gsap.fromTo(
        inEl,
        { opacity: 0, y: shift },
        { opacity: 1, y: 0, duration: 0.5, delay: 0.15, ease: "power2.out" },
      );
    },
    { dependencies: [items, reducedMotion], scope },
  );

  return (
    <span ref={scope} className="grid">
      {items.map((item, i) => (
        <span
          key={item.id}
          data-swap={item.id}
          aria-hidden={i < items.length - 1 ? true : undefined}
          className="col-start-1 row-start-1"
        >
          {item.value}
        </span>
      ))}
    </span>
  );
}
