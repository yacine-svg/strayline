"use client";

import { memo, useEffect, useRef } from "react";
import type { CSSProperties, RefObject } from "react";
import { WorldEngine, type EngineCallbacks, type StageLayer } from "@/lib/engine";
import { WORLDS, media, sceneBackground } from "@/lib/worlds";

export interface StageController {
  goTo(index: number): void;
  setPaused(paused: boolean): void;
}

interface Props extends EngineCallbacks {
  /** Filled in once the engine is running. */
  controller: RefObject<StageController | null>;
}

const FIRST = WORLDS[0];
const firstScene = {
  background: sceneBackground(FIRST),
  "--scene-accent": FIRST.accent,
} as CSSProperties;
const firstPoster: CSSProperties = { backgroundImage: `url("${media.poster(FIRST.id)}")` };

/**
 * Two stacked layers, each a gradient stand-in, a poster and a <video>.
 * React renders them once; the engine drives them directly from then on.
 */
function VideoStageBase({ controller, onDisplay, onProgress, onQueue, onBlocked }: Props) {
  const parts = useRef<Array<Partial<StageLayer>>>([{}, {}]);
  const callbacks = useRef<EngineCallbacks>({ onDisplay, onProgress, onQueue, onBlocked });

  useEffect(() => {
    callbacks.current = { onDisplay, onProgress, onQueue, onBlocked };
  });

  useEffect(() => {
    const layers: [StageLayer, StageLayer] = [toLayer(parts.current[0]), toLayer(parts.current[1])];
    const engine = new WorldEngine(
      layers,
      {
        onDisplay: (index) => callbacks.current.onDisplay(index),
        onProgress: (value) => callbacks.current.onProgress(value),
        onQueue: (index) => callbacks.current.onQueue(index),
        onBlocked: () => callbacks.current.onBlocked(),
      },
      { reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches },
    );
    controller.current = {
      goTo: (index) => engine.goTo(index),
      setPaused: (paused) => engine.setPaused(paused),
    };

    // The first paint shows the poster; video only starts after it.
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => void engine.start());
    });

    return () => {
      cancelAnimationFrame(frame);
      engine.destroy();
      controller.current = null;
    };
  }, [controller]);

  return (
    <div aria-hidden="true" className="absolute inset-0 isolate overflow-hidden bg-ink">
      {[0, 1].map((i) => {
        const first = i === 0;
        return (
          <div
            key={i}
            ref={(el) => {
              parts.current[i].root = el ?? undefined;
            }}
            data-mode="still"
            className="stage-layer"
            style={{ opacity: first ? 1 : 0, zIndex: first ? 2 : 1 }}
          >
            <div
              ref={(el) => {
                parts.current[i].scene = el ?? undefined;
              }}
              className="stage-scene absolute inset-0"
              style={first ? firstScene : undefined}
            >
              <div className="stage-path" />
            </div>
            <div
              ref={(el) => {
                parts.current[i].poster = el ?? undefined;
              }}
              className="absolute inset-0 bg-cover bg-center"
              style={first ? firstPoster : undefined}
            />
            <video
              ref={(el) => {
                parts.current[i].video = el ?? undefined;
              }}
              className="absolute inset-0 size-full object-cover"
              muted
              playsInline
              preload="auto"
              hidden
            />
          </div>
        );
      })}
    </div>
  );
}

function toLayer(part: Partial<StageLayer>): StageLayer {
  const { root, scene, poster, video } = part;
  if (!root || !scene || !poster || !video) throw new Error("VideoStage: a layer element is missing");
  return { root, scene, poster, video };
}

export const VideoStage = memo(VideoStageBase);
