"use client";

import { useCallback, useRef, useState, useSyncExternalStore } from "react";
import type { CSSProperties } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { createProgressStore } from "@/lib/progress";
import { SITE } from "@/lib/site";
import { WORLDS, titleCase } from "@/lib/worlds";
import { CrossFade } from "./CrossFade";
import { Headline } from "./Headline";
import { ArrowIcon } from "./icons";
import { Nav } from "./Nav";
import { StatBadge } from "./StatBadge";
import { VideoStage, type StageController } from "./VideoStage";
import { WorldPicker } from "./WorldPicker";

gsap.registerPlugin(useGSAP);

const MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const subscribeMotion = (onChange: () => void) => {
  const query = window.matchMedia(MOTION_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};
const prefersReducedMotion = () => window.matchMedia(MOTION_QUERY).matches;

export function Hero() {
  const root = useRef<HTMLDivElement>(null);
  const stage = useRef<StageController | null>(null);
  const [progress] = useState(createProgressStore);
  const [active, setActive] = useState(0);
  const [queued, setQueued] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const reducedMotion = useSyncExternalStore(subscribeMotion, prefersReducedMotion, () => false);
  const world = WORLDS[active];

  // The accent (eyebrow dot, ring, logo) eases into the new world's colour.
  useGSAP(
    () => {
      if (!root.current) return;
      gsap.to(root.current, {
        "--accent": world.accent,
        duration: reducedMotion ? 0 : 0.9,
        ease: "power2.out",
      });
    },
    { dependencies: [world.accent, reducedMotion], scope: root },
  );

  const onDisplay = useCallback((index: number) => setActive(index), []);
  const onQueue = useCallback((index: number | null) => setQueued(index), []);
  const onBlocked = useCallback(() => setPaused(true), []);
  const selectWorld = useCallback((index: number) => stage.current?.goTo(index), []);

  const togglePause = () => {
    const next = !paused;
    setPaused(next);
    // Called straight from the click, so resuming counts as a user gesture for autoplay.
    stage.current?.setPaused(next);
  };

  return (
    <div
      ref={root}
      data-paused={paused ? "true" : undefined}
      className="hero relative h-svh min-h-[34rem] w-full overflow-hidden text-white"
      style={{ "--accent": WORLDS[0].accent } as CSSProperties}
    >
      <VideoStage
        controller={stage}
        onDisplay={onDisplay}
        onProgress={progress.set}
        onQueue={onQueue}
        onBlocked={onBlocked}
      />
      <div aria-hidden="true" className="scrim pointer-events-none absolute inset-0 z-10" />

      <Nav />

      <main className="absolute inset-x-5 bottom-32 z-20 md:inset-x-auto md:top-1/2 md:bottom-auto md:left-12 md:-translate-y-1/2 lg:left-16">
        <p className="flex items-center gap-2.5 text-[13px] font-medium text-white/85">
          <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-[color:var(--accent)] shadow-[0_0_14px_var(--accent)]" />
          <CrossFade text={world.eyebrow} reducedMotion={reducedMotion} />
        </p>
        <h1 className="hero-headline mt-4 font-display font-black uppercase">
          <span className="sr-only">{titleCase(world.headline)}</span>
          <Headline text={world.headline} reducedMotion={reducedMotion} />
        </h1>
        <p className="mt-5 max-w-[26ch] text-base leading-snug text-white/85 md:mt-6 md:text-lg">
          <CrossFade text={world.sub} reducedMotion={reducedMotion} />
        </p>
        <a
          href={SITE.cta.href}
          className="group mt-7 inline-flex items-center gap-4 rounded-full bg-cream py-1.5 pr-1.5 pl-6 text-[15px] font-semibold text-ink shadow-[0_12px_32px_-14px_rgb(0_0_0/0.7)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white md:mt-9"
        >
          {SITE.cta.label}
          <span className="grid size-10 place-items-center rounded-full bg-ink text-white">
            <ArrowIcon className="size-4 transition-transform duration-300 group-hover:rotate-45" />
          </span>
        </a>
      </main>

      <WorldPicker
        worlds={WORLDS}
        active={active}
        queued={queued}
        progress={progress}
        paused={paused}
        onSelect={selectWorld}
        onTogglePause={togglePause}
      />
      <StatBadge />
    </div>
  );
}
