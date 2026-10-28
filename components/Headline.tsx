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

/**
 * The giant two-line headline, one word per line. On change the old letters lift away
 * blurred while the new ones rise in from below. Screen readers get the text from the
 * parent <h1>, so this visual copy is hidden from them.
 */
export function Headline({ text, reducedMotion }: Props) {
  const { items, drop } = useSwap(text);
  const scope = useRef<HTMLSpanElement>(null);

  useGSAP(
    () => {
      if (items.length < 2) return;
      const [outgoing, incoming] = items;
      const root = scope.current;
      const outLayer = root?.querySelector<HTMLElement>(`[data-swap="${outgoing.id}"]`);
      const inLayer = root?.querySelector<HTMLElement>(`[data-swap="${incoming.id}"]`);
      if (!outLayer || !inLayer) return;
      const done = () => drop(outgoing.id);

      if (reducedMotion) {
        gsap.killTweensOf([outLayer, inLayer]);
        gsap.to(outLayer, { opacity: 0, duration: 0.3, onComplete: done });
        gsap.fromTo(inLayer, { opacity: 0 }, { opacity: 1, duration: 0.45 });
        return;
      }

      const outChars = Array.from(outLayer.querySelectorAll<HTMLElement>("[data-char]"));
      const inChars = Array.from(inLayer.querySelectorAll<HTMLElement>("[data-char]"));
      gsap.killTweensOf([...outChars, ...inChars]);
      gsap.to(outChars, {
        yPercent: -40,
        opacity: 0,
        filter: "blur(8px)",
        duration: 0.45,
        ease: "power2.in",
        stagger: 0.02,
        onComplete: done,
      });
      gsap.fromTo(
        inChars,
        { yPercent: 40, opacity: 0, filter: "blur(8px)" },
        {
          yPercent: 0,
          opacity: 1,
          filter: "blur(0px)",
          duration: 0.7,
          ease: "power3.out",
          stagger: 0.02,
          delay: 0.12,
          clearProps: "transform,filter,opacity",
        },
      );
    },
    { dependencies: [items, reducedMotion], scope },
  );

  return (
    <span ref={scope} aria-hidden="true" className="grid">
      {items.map((item) => (
        <span key={item.id} data-swap={item.id} className="col-start-1 row-start-1 block">
          {item.value.split(" ").map((word, w) => (
            <span key={w} className="block whitespace-nowrap">
              {Array.from(word).map((char, c) => (
                <span key={c} data-char="" className="inline-block">
                  {char}
                </span>
              ))}
            </span>
          ))}
        </span>
      ))}
    </span>
  );
}
