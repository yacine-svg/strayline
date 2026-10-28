/**
 * Everything that describes the four worlds: copy, colours, timings and file names.
 * Edit copy here — components never hard-code it.
 */

export type WorldId = "dune" | "neon" | "ice" | "petal";

export interface World {
  id: WorldId;
  eyebrow: string;
  /** Each word sits on its own line. */
  headline: string;
  sub: string;
  accent: string;
  /** Colours for the stand-in scene shown while a world has no footage. */
  scene: { sky: string; horizon: string; ground: string };
}

/** In run order. The last world transitions back to the first. */
export const WORLDS: readonly World[] = [
  {
    id: "dune",
    eyebrow: "Stage 01 · Sahara",
    headline: "DUNE LINE",
    sub: "Ride the ridge before the wind rewrites it.",
    accent: "#F2A65A",
    scene: { sky: "#2A1A2E", horizon: "#F2A65A", ground: "#6B3F24" },
  },
  {
    id: "neon",
    eyebrow: "Stage 02 · Downtown",
    headline: "NEON RAIN",
    sub: "Every puddle is a mirror. Don't look down.",
    accent: "#FF4FD8",
    scene: { sky: "#0B0818", horizon: "#FF4FD8", ground: "#1A1030" },
  },
  {
    id: "ice",
    eyebrow: "Stage 03 · North",
    headline: "ICE MIRROR",
    sub: "The lake holds. Probably. Keep moving.",
    accent: "#8FD3FF",
    scene: { sky: "#0D2135", horizon: "#8FD3FF", ground: "#24506E" },
  },
  {
    id: "petal",
    eyebrow: "Stage 04 · Highlands",
    headline: "PETAL PASS",
    sub: "Climb the switchbacks before the blossoms fall.",
    accent: "#FF9BB3",
    scene: { sky: "#24142A", horizon: "#FF9BB3", ground: "#4A2A3C" },
  },
];

/** Full plays of a world's loop before the run moves on. */
export const LOOPS_PER_WORLD = 2;

/** All in seconds. */
export const TIMING = {
  /** Fade that hides decode hitches when one clip hands over to the next. */
  seamFade: 0.12,
  /** Crossfade when jumping to a world that isn't next. */
  jumpFade: 0.4,
  /** Length of one stand-in loop while a world has no footage. */
  fallbackLoop: 5,
  /** Crossfade used in place of a missing transition clip. */
  fallbackTransition: 1.4,
  /** World change with reduced motion: posters only, simple fade. */
  reducedFade: 0.6,
} as const;

const DIR = "/worlds";

/** File names inside /public/worlds. */
export const media = {
  loop: (id: WorldId) => `${DIR}/${id}-loop.mp4`,
  transition: (from: WorldId, to: WorldId) => `${DIR}/${from}-to-${to}.mp4`,
  poster: (id: WorldId) => `${DIR}/${id}-poster.jpg`,
  thumb: (id: WorldId) => `${DIR}/${id}-thumb.jpg`,
};

export const nextIndex = (index: number) => (index + 1) % WORLDS.length;

export const titleCase = (text: string) =>
  text.toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());

/** The stand-in backdrop: sky, a glow along the horizon, then the ground. */
export function sceneBackground({ scene }: World) {
  return [
    `radial-gradient(70% 40% at 50% 56%, ${scene.horizon}99, transparent 70%)`,
    `linear-gradient(to bottom, ${scene.sky} 0%, ${scene.sky} 28%, ${scene.horizon}66 55%, ${scene.ground} 57.5%, ${scene.ground} 100%)`,
  ].join(", ");
}

/** Thumbnail image with the stand-in scene behind it, so a missing file still shows the world. */
export function thumbBackground(world: World) {
  return `url("${media.thumb(world.id)}"), ${sceneBackground(world)}`;
}
