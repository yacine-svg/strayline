"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import type { ProgressStore } from "@/lib/progress";
import { SITE } from "@/lib/site";
import { thumbBackground, titleCase, type World } from "@/lib/worlds";
import { PauseIcon, PlayIcon } from "./icons";

const RING_RADIUS = 47;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

interface Props {
  worlds: readonly World[];
  active: number;
  /** World waiting for the current loop to finish, if any. */
  queued: number | null;
  progress: ProgressStore;
  paused: boolean;
  onSelect(index: number): void;
  onTogglePause(): void;
}

function paint(ring: SVGCircleElement | null, value: number) {
  if (ring) ring.style.strokeDashoffset = String(RING_LENGTH * (1 - value));
}

export function WorldPicker({ worlds, active, queued, progress, paused, onSelect, onTogglePause }: Props) {
  const ring = useRef<SVGCircleElement>(null);

  // The engine updates the ring every frame, outside React.
  useEffect(() => progress.subscribe((value) => paint(ring.current, value)), [progress]);
  // The ring moves to a new thumbnail when the world changes.
  useLayoutEffect(() => paint(ring.current, progress.get()), [active, progress]);

  return (
    <div className="absolute bottom-6 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3 md:bottom-8 md:gap-4">
      <button
        type="button"
        onClick={onTogglePause}
        aria-label={paused ? SITE.labels.resume : SITE.labels.pause}
        className="grid size-9 place-items-center rounded-full border border-white/25 bg-white/15 text-white backdrop-blur-md transition-colors hover:bg-white/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        {paused ? <PlayIcon /> : <PauseIcon />}
      </button>
      <span aria-hidden="true" className="h-6 w-px bg-white/25" />
      <ul aria-label={SITE.labels.worlds} className="flex items-center gap-2.5 md:gap-3">
        {worlds.map((world, i) => {
          const isActive = i === active;
          return (
            <li key={world.id} className="grid place-items-center">
              <button
                type="button"
                onClick={() => onSelect(i)}
                aria-label={SITE.labels.showWorld(titleCase(world.headline))}
                aria-current={isActive ? "true" : undefined}
                className={`relative block rounded-full transition-[width,height,scale] duration-500 ease-out hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-[6px] focus-visible:outline-white ${
                  isActive ? "size-14 md:size-[4.5rem]" : "size-10 md:size-12"
                }`}
              >
                <span
                  className={`absolute inset-0 rounded-full bg-cover bg-center ${isActive ? "ring-2 ring-white" : "opacity-80"}`}
                  style={{ backgroundImage: thumbBackground(world) }}
                />
                {i === queued && (
                  <span className="absolute -inset-1.5 animate-pulse rounded-full border-2 border-[color:var(--accent)]" />
                )}
                {isActive && (
                  <svg viewBox="0 0 100 100" aria-hidden="true" className="pointer-events-none absolute -inset-2 -rotate-90">
                    <circle cx="50" cy="50" r={RING_RADIUS} fill="none" stroke="white" strokeOpacity="0.22" strokeWidth="3" />
                    <circle
                      ref={ring}
                      cx="50"
                      cy="50"
                      r={RING_RADIUS}
                      fill="none"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeDasharray={RING_LENGTH}
                      style={{ stroke: "var(--accent)", strokeDashoffset: RING_LENGTH }}
                    />
                  </svg>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
