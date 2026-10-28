# Strayline

A full-viewport hero for an endless runner. The runner never stops while the world changes under its feet: four worlds, each with its own loop, a transition into the next, and a giant headline that swaps as the world morphs.

Next.js (App Router) · TypeScript · Tailwind CSS 4 · GSAP

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000. It works before you have any footage: each world shows a gradient stand-in (a path running to the horizon) until its files exist.

## Add your footage

Put these files in `public/worlds/`. The names must match exactly.

| World | Loop | Transition into next | Poster | Thumbnail |
| --- | --- | --- | --- | --- |
| dune | `dune-loop.mp4` | `dune-to-neon.mp4` | `dune-poster.jpg` | `dune-thumb.jpg` |
| neon | `neon-loop.mp4` | `neon-to-ice.mp4` | `neon-poster.jpg` | `neon-thumb.jpg` |
| ice | `ice-loop.mp4` | `ice-to-petal.mp4` | `ice-poster.jpg` | `ice-thumb.jpg` |
| petal | `petal-loop.mp4` | `petal-to-dune.mp4` | `petal-poster.jpg` | `petal-thumb.jpg` |

Reload the page and they're used; there's nothing to change in code. You can add them one at a time: anything missing keeps its stand-in.

- **Loop:** first frame = last frame, about 5 s.
- **Transition:** starts on this world's keyframe, ends on the next world's keyframe.
- **Poster:** the keyframe itself. It shows instantly while the video loads, and stays as the background with reduced motion.
- Compress for the web, no audio:
  `ffmpeg -i in.mp4 -an -vf scale=1920:-2 -c:v libx264 -crf 24 -preset veryfast -movflags +faststart out.mp4`
- Keep the character the same size and position in every keyframe, or the seams will show.

## Where things live

| File | What's in it |
| --- | --- |
| `lib/worlds.ts` | World copy, accent colours, stand-in colours, timings, file names |
| `lib/site.ts` | Nav, buttons, the stat and accessible labels |
| `lib/engine.ts` | The A/B video engine |
| `components/VideoStage.tsx` | The two stacked layers the engine drives |
| `components/Headline.tsx` | Letter-by-letter headline swap |
| `components/WorldPicker.tsx` | Thumbnails, progress ring, pause button |
| `components/Nav.tsx`, `StatBadge.tsx`, `CrossFade.tsx`, `Hero.tsx` | The rest of the hero |
| `app/globals.css` | Tailwind theme, headline sizing, scrim, stand-in path |

## How the engine works

Two stacked layers: one on screen, the other hidden and buffering whatever comes next.

1. A world's loop plays twice (`LOOPS_PER_WORLD` in `lib/worlds.ts`).
2. On its last play the loop stops looping, so it ends on its final frame. That frame matches the transition's first frame, so the hand-over is seamless: the transition starts in the hidden layer and fades in over 120 ms.
3. Halfway through the transition, the headline, eyebrow, sub, accent colour and active thumbnail switch to the new world.
4. When the transition ends, the next loop takes over the same way, and the cycle repeats. After petal, it goes back to dune.

Other behaviour:

- **Thumbnails.** Clicking the next world queues it: the ring pulses and the transition plays at the end of the current loop. Clicking any other world crossfades straight to its loop in 400 ms.
- **Missing or broken files.** The engine checks which clips exist when the page loads. A missing loop shows its poster (or the stand-in) on a 5 s timer. A missing transition becomes a 1.4 s crossfade. A file that fails to decode is handled the same way.
- **Pausing.** Playback pauses when the tab is hidden, and there's a pause button beside the thumbnails. If the browser blocks autoplay (iOS Low Power Mode, for example), the poster stays up with the button showing play, and one tap starts it.
- **Reduced motion.** With `prefers-reduced-motion`, no video loads. Posters change with a simple fade, and the headline fades instead of animating letter by letter.

## Deploy

Push to GitHub and import the repo on Vercel; no settings needed. Files in `public/` are served from the CDN.
