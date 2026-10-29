import { gsap } from "gsap";
import {
  LOOPS_PER_WORLD,
  PLAYBACK_RATE,
  SEAM_BLEND,
  TIMING,
  WORLDS,
  media,
  nextIndex,
  sceneBackground,
  type World,
} from "./worlds";

/**
 * WorldEngine drives two stacked layers (A and B). One is on screen, the other is
 * hidden and buffering whatever comes next. The run goes:
 *
 *   LOOPING(world)  ── loop has played LOOPS_PER_WORLD times, or next world clicked ──▶
 *   TRANSITIONING   ── transition clip ends ──▶  LOOPING(next world)
 *
 * The loop only hands over at its very end (its last frame matches the transition's
 * first), and every hand-over is a short fade between layers to hide decode hitches.
 * Clicking a world that isn't next crossfades straight to its loop ("fading").
 *
 * Any clip whose file is missing becomes a "still": the layer shows the poster (or
 * the gradient stand-in when there's no poster) and a timer stands in for playback.
 */

/** The DOM pieces of one layer. */
export interface StageLayer {
  /** Faded in and out as a whole. */
  root: HTMLDivElement;
  /** Gradient stand-in. */
  scene: HTMLDivElement;
  /** Poster image, painted over the stand-in. */
  poster: HTMLDivElement;
  video: HTMLVideoElement;
}

export interface EngineCallbacks {
  /** The world the copy, accent and thumbnails should now show. */
  onDisplay(index: number): void;
  /** 0–1 fill for the active thumbnail's ring. Called every frame. */
  onProgress(value: number): void;
  /** A click on the next world is waiting for the current loop to finish (or null). */
  onQueue(index: number | null): void;
  /** The browser refused to autoplay. Playback stays paused until the user presses play. */
  onBlocked(): void;
}

interface Clip {
  kind: "loop" | "transition";
  /** A loop's own world, or the world a transition arrives in. */
  world: number;
  /** World painted behind the clip while it loads. */
  backdrop: number;
  src: string;
  /** false: no usable file (or reduced motion), so show the poster on a timer instead. */
  real: boolean;
}

/** "handoff": a transition has ended (or is ending) and the next loop is starting. */
type Phase = "boot" | "looping" | "transitioning" | "handoff" | "fading";
type Slot = 0 | 1;

const clamp01 = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);

const sameClip = (a: Clip | null, b: Clip) =>
  !!a && a.src === b.src && a.kind === b.kind && a.real === b.real;

export class WorldEngine {
  private readonly layers: [StageLayer, StageLayer];
  private readonly cb: EngineCallbacks;
  private readonly useVideo: boolean;

  private clips: [Clip | null, Clip | null] = [null, null];
  private front: Slot = 0;
  private phase: Phase = "boot";
  /** World whose loop is on screen (or that a transition is leaving). */
  private world = 0;
  /** Destination of a transition or fade; equals `world` while looping. */
  private target = 0;
  /** Completed plays of the current loop. */
  private loops = 0;
  private lastTime = 0;
  private queued: number | null = null;
  private display = 0;
  /** Whether the copy has already moved to `target` during the current change. */
  private switched = false;
  /** Ring value when the current change began; the ring fills from here to full. */
  private progressFrom = 0;
  /** Point in a fade (0–1) at which the copy switches worlds. */
  private switchAt = 0;

  private available = new Map<string, boolean>();
  private userPaused = false;
  private hidden = false;
  /** Bumped by every new hand-over so stale async continuations bail out. */
  private token = 0;
  private raf = 0;
  private fade: gsap.core.Tween | null = null;
  private resumeList = new Set<HTMLVideoElement>();
  private timer = new Stopwatch();
  private destroyed = false;
  private cleanups: Array<() => void> = [];

  constructor(
    layers: [StageLayer, StageLayer],
    callbacks: EngineCallbacks,
    options: { reducedMotion: boolean },
  ) {
    this.layers = layers;
    this.cb = callbacks;
    this.useVideo = !options.reducedMotion;
    this.reset();
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  /** Call after first paint: probes which files exist, then starts the first loop. */
  async start(): Promise<void> {
    if (this.phase !== "boot" || this.destroyed) return;
    this.listen();
    if (this.useVideo) await this.probe();
    if (this.destroyed) return;

    const token = ++this.token;
    const world = this.display; // a thumbnail may have been clicked while probing
    const layer = this.layers[this.front];
    this.cb.onDisplay(world);
    this.prepare(this.front, this.loopClip(world));
    const real = this.clips[this.front]?.real ?? false;
    // The loop plays in place over its own poster, fading in as it starts.
    if (real) layer.video.style.opacity = "0";
    this.enterLoop(world);
    this.tick();

    await this.play(this.front);
    if (token !== this.token || this.destroyed) return;
    if (real) gsap.to(layer.video, { opacity: 1, duration: 0.6, ease: "power1.out" });
    this.preloadNext();
  }

  /** Thumbnail click. */
  goTo(index: number) {
    if (this.destroyed || index < 0 || index >= WORLDS.length) return;
    if (this.phase === "boot") {
      this.setDisplay(index);
      setScene(this.layers[this.front], WORLDS[index]);
      return;
    }
    // Already showing it, or already heading there.
    if (index === this.display || index === this.target) return;

    if (this.phase === "looping" && index === nextIndex(this.world)) {
      const current = this.clips[this.front];
      // A seamless hand-over needs real footage on both sides; wait for the loop's end.
      if (current?.real && this.transitionClip(this.world).real) {
        if (this.queued === index) return;
        this.queued = index;
        this.cb.onQueue(index);
        this.layers[this.front].video.loop = false;
        return;
      }
    }
    this.fadeTo(index, this.useVideo ? TIMING.jumpFade : TIMING.reducedFade, 0);
  }

  setPaused(paused: boolean) {
    this.userPaused = paused;
    this.applyPause();
  }

  destroy() {
    this.destroyed = true;
    this.token++;
    cancelAnimationFrame(this.raf);
    this.fade?.kill();
    this.fade = null;
    this.cleanups.forEach((cleanup) => cleanup());
    this.cleanups = [];
    for (const { video } of this.layers) video.pause();
  }

  // ─── Set-up ────────────────────────────────────────────────────────────────

  /** Put both layers into their starting state (also undoes a previous engine after hot reload). */
  private reset() {
    this.layers.forEach((layer, i) => {
      const { root, video } = layer;
      gsap.killTweensOf([root, video]);
      root.style.opacity = i === 0 ? "1" : "0";
      root.style.zIndex = i === 0 ? "2" : "1";
      root.dataset.mode = "still";
      video.muted = true;
      video.defaultMuted = true;
      video.playsInline = true;
      // Loading a new source resets playbackRate to this default.
      video.defaultPlaybackRate = PLAYBACK_RATE;
      video.playbackRate = PLAYBACK_RATE;
      video.setAttribute("muted", "");
      video.setAttribute("playsinline", "");
      video.loop = false;
      video.style.opacity = "";
      video.hidden = true;
      if (video.hasAttribute("src")) {
        video.removeAttribute("src");
        video.load();
      }
    });
    setScene(this.layers[0], WORLDS[0]);
  }

  private listen() {
    const onVisibility = () => {
      this.hidden = document.visibilityState === "hidden";
      this.applyPause();
    };
    this.hidden = document.visibilityState === "hidden";
    document.addEventListener("visibilitychange", onVisibility);
    this.cleanups.push(() => document.removeEventListener("visibilitychange", onVisibility));

    this.layers.forEach(({ video }, i) => {
      const slot = i as Slot;
      const onEnded = () => this.handleEnded(slot);
      const onError = () => this.handleError(slot);
      video.addEventListener("ended", onEnded);
      video.addEventListener("error", onError);
      this.cleanups.push(() => {
        video.removeEventListener("ended", onEnded);
        video.removeEventListener("error", onError);
      });
    });
  }

  /** Find out which clip files exist, so missing ones go straight to the stand-in. */
  private async probe() {
    const urls = new Set<string>();
    WORLDS.forEach((world, i) => {
      urls.add(media.loop(world.id));
      urls.add(media.transition(world.id, WORLDS[nextIndex(i)].id));
    });
    await Promise.all(
      Array.from(urls, async (url) => {
        this.available.set(url, await fileExists(url));
      }),
    );
  }

  // ─── Clips and layers ──────────────────────────────────────────────────────

  private get back(): Slot {
    return this.front === 0 ? 1 : 0;
  }

  private get paused() {
    return this.userPaused || this.hidden;
  }

  private isReal(src: string) {
    return this.useVideo && this.available.get(src) === true;
  }

  private loopClip(world: number): Clip {
    const src = media.loop(WORLDS[world].id);
    return { kind: "loop", world, backdrop: world, src, real: this.isReal(src) };
  }

  private transitionClip(from: number): Clip {
    const to = nextIndex(from);
    const src = media.transition(WORLDS[from].id, WORLDS[to].id);
    return { kind: "transition", world: to, backdrop: from, src, real: this.isReal(src) };
  }

  /** Load a clip into a layer without showing it. Real clips start buffering. */
  private prepare(slot: Slot, clip: Clip) {
    const layer = this.layers[slot];
    const { video } = layer;
    this.clips[slot] = clip;
    setScene(layer, WORLDS[clip.backdrop]);
    gsap.killTweensOf(video);
    video.loop = false;
    video.style.opacity = "";
    this.resumeList.delete(video);

    if (clip.real) {
      layer.root.dataset.mode = "video";
      video.hidden = false;
      if (video.getAttribute("src") !== clip.src) {
        video.src = clip.src;
        video.playbackRate = PLAYBACK_RATE;
      } else {
        video.pause();
        if (video.currentTime !== 0) video.currentTime = 0;
      }
    } else {
      layer.root.dataset.mode = "still";
      video.hidden = true;
      if (video.hasAttribute("src")) {
        video.pause();
        video.removeAttribute("src");
        video.load(); // releases the old file
      }
    }
  }

  /** Start a prepared layer. Resolves once its first frame is on screen (at once for stills). */
  private play(slot: Slot): Promise<void> {
    const clip = this.clips[slot];
    const video = this.layers[slot].video;
    if (!clip?.real) return Promise.resolve();

    return new Promise<void>((resolve) => {
      const stop = new AbortController();
      const done = () => {
        stop.abort();
        resolve();
      };
      // An error resolves too, so the hand-over never stalls; the clip becomes a still.
      video.addEventListener("error", done, { signal: stop.signal });
      const withFrames = video as HTMLVideoElement & {
        requestVideoFrameCallback?: (callback: () => void) => number;
      };
      if (typeof withFrames.requestVideoFrameCallback === "function") {
        withFrames.requestVideoFrameCallback(() => done());
      } else {
        video.addEventListener("playing", () => requestAnimationFrame(done), {
          once: true,
          signal: stop.signal,
        });
      }
      if (this.paused) this.resumeList.add(video);
      else this.tryPlay(video);
    });
  }

  private tryPlay(video: HTMLVideoElement) {
    video.play().catch((error: unknown) => {
      if (error instanceof DOMException && error.name === "NotAllowedError") {
        this.resumeList.add(video);
        this.block();
      }
      // AbortError means the source changed before playback began: nothing to do.
    });
  }

  /** Bring a layer up over the current front layer, then retire the old one. */
  private reveal(slot: Slot, duration: number, after: () => void) {
    const incoming = this.layers[slot];
    const outgoing = this.layers[this.front];
    this.front = slot;
    incoming.root.style.zIndex = "2";
    outgoing.root.style.zIndex = "1";
    this.fade = gsap.fromTo(
      incoming.root,
      { opacity: 0 },
      {
        opacity: 1,
        duration,
        ease: "none",
        onComplete: () => {
          this.fade = null;
          outgoing.root.style.opacity = "0";
          outgoing.video.pause();
          this.resumeList.delete(outgoing.video);
          after();
        },
      },
    );
    if (this.paused) this.fade.pause();
  }

  /** Finish any fade that's still running, so a new hand-over starts from a clean state. */
  private settleFade() {
    this.fade?.progress(1);
  }

  /** Buffer whatever follows the clip on screen into the hidden layer. */
  private preloadNext() {
    if (this.destroyed) return;
    if (this.phase === "transitioning") {
      this.prepare(this.back, this.loopClip(this.target));
    } else if (this.phase === "looping") {
      const transition = this.transitionClip(this.world);
      // Without a transition clip the next step is a crossfade, so buffer the next loop.
      this.prepare(this.back, transition.real ? transition : this.loopClip(nextIndex(this.world)));
    }
  }

  // ─── The run ───────────────────────────────────────────────────────────────

  private enterLoop(world: number) {
    this.phase = "looping";
    this.world = world;
    this.target = world;
    this.loops = 0;
    this.lastTime = 0;
    this.setDisplay(world);
    if (this.clips[this.front]?.real) {
      this.layers[this.front].video.loop = this.repeatAgain();
    } else {
      this.timer.start(TIMING.fallbackLoop);
      if (this.paused) this.timer.pause();
    }
  }

  /** Whether the loop plays again after the current play. */
  private repeatAgain() {
    return this.queued === null && this.loops < LOOPS_PER_WORLD - 1;
  }

  /** The loop finished its last play: move on to the next world. */
  private advance() {
    if (this.phase !== "looping") return;
    const from = this.world;
    const to = nextIndex(from);
    const ring = this.ringValue();
    this.clearQueue();

    const transition = this.transitionClip(from);
    if (!transition.real) {
      this.fadeTo(to, this.useVideo ? TIMING.fallbackTransition : TIMING.reducedFade, 0.5, ring);
      return;
    }

    this.settleFade();
    const token = ++this.token;
    const back = this.back;
    if (!sameClip(this.clips[back], transition)) this.prepare(back, transition);
    this.phase = "transitioning";
    this.target = to;
    this.switched = false;
    this.progressFrom = ring;

    void this.play(back).then(() => {
      if (token !== this.token) return;
      if (!this.clips[back]?.real) {
        // The transition file failed while loading: crossfade instead.
        this.fadeTo(to, TIMING.fallbackTransition, 0.5, ring);
        return;
      }
      this.reveal(back, this.seamFade(from, "in"), () => this.preloadNext());
    });
  }

  /** The transition clip ended (or is about to): hand over to the next world's loop. */
  private finishTransition() {
    if (this.phase !== "transitioning") return;
    const from = this.world;
    const to = this.target;
    this.phase = "handoff";
    if (!this.switched) this.switchDisplay(to);
    this.settleFade();
    const token = ++this.token;
    const back = this.back;
    const loop = this.loopClip(to);
    if (!sameClip(this.clips[back], loop)) this.prepare(back, loop);

    void this.play(back).then(() => {
      if (token !== this.token) return;
      this.reveal(back, this.seamFade(from, "out"), () => this.preloadNext());
      this.enterLoop(to);
    });
  }

  /** Fade length at a seam: the usual short fade, or a longer blend from SEAM_BLEND. */
  private seamFade(from: number, side: "in" | "out") {
    return Math.max(TIMING.seamFade, SEAM_BLEND[WORLDS[from].id]?.[side] ?? 0);
  }

  /** Whether this seam blends long enough to need its clips overlapping. */
  private overlaps(from: number, side: "in" | "out") {
    return this.seamFade(from, side) > TIMING.seamFade;
  }

  /** Seconds of screen time left in a clip. */
  private remaining(video: HTMLVideoElement) {
    const d = video.duration;
    if (!Number.isFinite(d) || d <= 0) return Infinity;
    return (d - video.currentTime) / (video.playbackRate || 1);
  }

  /** Crossfade straight to a world's loop: jumps, missing transitions and reduced motion. */
  private fadeTo(to: number, duration: number, switchAt: number, progressFrom = 0) {
    this.settleFade();
    const token = ++this.token;
    this.clearQueue();
    this.phase = "fading";
    this.target = to;
    this.switchAt = switchAt;
    this.progressFrom = progressFrom;
    this.switched = false;
    if (switchAt <= 0) this.switchDisplay(to);

    const back = this.back;
    this.prepare(back, this.loopClip(to));
    void this.play(back).then(() => {
      if (token !== this.token) return;
      this.reveal(back, duration, () => {
        if (!this.switched) this.switchDisplay(to);
        this.enterLoop(to);
        this.preloadNext();
      });
    });
  }

  private tick = () => {
    this.raf = requestAnimationFrame(this.tick);
    if (this.paused || this.phase === "boot") return;
    const clip = this.clips[this.front];
    if (!clip) return;

    if (this.phase === "looping") {
      if (clip.real) {
        const video = this.layers[this.front].video;
        const t = video.currentTime;
        if (t + 0.25 < this.lastTime) {
          // The element wrapped back to the start: one more play done.
          this.loops += 1;
          video.loop = this.repeatAgain();
        }
        this.lastTime = t;
        // A long blend into the transition starts while the loop's last play is still running.
        if (
          !video.loop &&
          this.overlaps(this.world, "in") &&
          this.transitionClip(this.world).real &&
          this.remaining(video) <= this.seamFade(this.world, "in")
        ) {
          this.advance();
          return;
        }
      } else if (this.timer.elapsed >= this.timer.duration) {
        if (this.repeatAgain()) {
          this.loops += 1;
          this.timer.wrap();
        } else {
          this.advance();
          return;
        }
      }
      this.cb.onProgress(this.ringValue());
      return;
    }

    // A long blend into the next loop starts before the transition finishes.
    if (
      this.phase === "transitioning" &&
      clip.kind === "transition" &&
      clip.real &&
      this.overlaps(this.world, "out") &&
      this.remaining(this.layers[this.front].video) <= this.seamFade(this.world, "out")
    ) {
      this.finishTransition();
      return;
    }

    // Changing worlds: the ring fills to full, then the copy switches.
    if (this.switched) return;
    let k = -1;
    if (this.phase === "transitioning" && clip.kind === "transition") {
      const { t, d } = this.clock();
      k = clamp01(t / (d / 2)); // switch halfway through the transition clip
    } else if (this.phase === "fading" && this.fade) {
      k = this.switchAt > 0 ? clamp01(this.fade.progress() / this.switchAt) : 1;
    }
    if (k < 0) return;
    this.cb.onProgress(this.progressFrom + (1 - this.progressFrom) * k);
    if (k >= 1) this.switchDisplay(this.target);
  };

  /** Playback position of the clip on screen. */
  private clock(): { t: number; d: number } {
    if (this.clips[this.front]?.real) {
      const video = this.layers[this.front].video;
      const d = video.duration;
      return { t: video.currentTime, d: Number.isFinite(d) && d > 0 ? d : TIMING.fallbackLoop };
    }
    return { t: this.timer.elapsed, d: this.timer.duration || TIMING.fallbackLoop };
  }

  private ringValue() {
    if (this.phase !== "looping") return 0;
    const { t, d } = this.clock();
    return clamp01((this.loops + clamp01(t / d)) / LOOPS_PER_WORLD);
  }

  // ─── Events ────────────────────────────────────────────────────────────────

  private handleEnded(slot: Slot) {
    if (slot !== this.front || this.destroyed) return;
    if (this.phase === "looping") this.advance();
    else if (this.phase === "transitioning" && this.clips[slot]?.kind === "transition") {
      this.finishTransition();
    }
  }

  /** A file failed to load or decode: treat it as missing from now on. */
  private handleError(slot: Slot) {
    const clip = this.clips[slot];
    const video = this.layers[slot].video;
    // Ignore errors from a source that has since been replaced.
    if (!clip?.real || video.getAttribute("src") !== clip.src) return;
    this.available.set(clip.src, false);
    this.prepare(slot, { ...clip, real: false });
    if (slot !== this.front) return; // a hidden clip is re-checked when it's needed

    if (this.phase === "looping") {
      this.timer.start(TIMING.fallbackLoop);
      if (this.paused) this.timer.pause();
    } else if (this.phase === "transitioning") {
      this.finishTransition();
    }
  }

  private block() {
    if (this.userPaused) return;
    this.userPaused = true;
    this.applyPause();
    this.cb.onBlocked();
  }

  private applyPause() {
    if (this.destroyed) return;
    if (this.paused) {
      for (const { video } of this.layers) {
        if (!video.paused) {
          video.pause();
          this.resumeList.add(video);
        }
      }
      this.timer.pause();
      this.fade?.pause();
      return;
    }
    // Resuming from a click keeps the user gesture, which unblocks autoplay.
    const waiting = Array.from(this.resumeList);
    this.resumeList.clear();
    waiting.forEach((video) => this.tryPlay(video));
    this.timer.resume();
    this.fade?.resume();
  }

  // ─── Copy and ring ─────────────────────────────────────────────────────────

  private setDisplay(index: number) {
    if (index === this.display) return;
    this.display = index;
    this.cb.onDisplay(index);
  }

  private switchDisplay(index: number) {
    this.switched = true;
    this.setDisplay(index);
    this.cb.onProgress(0);
  }

  private clearQueue() {
    if (this.queued === null) return;
    this.queued = null;
    this.cb.onQueue(null);
  }
}

/** Paint a world's stand-in scene and poster into a layer. */
function setScene(layer: StageLayer, world: World) {
  layer.scene.style.background = sceneBackground(world);
  layer.scene.style.setProperty("--scene-accent", world.accent);
  layer.poster.style.backgroundImage = `url("${media.poster(world.id)}")`;
}

async function fileExists(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: "HEAD" });
    if (response.status === 405) return true; // host doesn't answer HEAD; let the <video> find out
    if (!response.ok) return false;
    // Some hosts answer missing files with an HTML page.
    const type = response.headers.get("content-type") ?? "";
    return type === "" || type.startsWith("video/") || type.includes("octet-stream");
  } catch {
    return false;
  }
}

/** A pausable clock that stands in for playback when a clip is a still. */
class Stopwatch {
  duration = 0;
  private base = 0;
  private startedAt = 0;
  private running = false;

  start(duration: number) {
    this.duration = duration;
    this.base = 0;
    this.startedAt = performance.now();
    this.running = true;
  }

  /** Begin the next lap, carrying any overshoot so laps don't drift. */
  wrap() {
    this.base = Math.max(0, this.elapsed - this.duration);
    this.startedAt = performance.now();
  }

  pause() {
    if (!this.running) return;
    this.base += (performance.now() - this.startedAt) / 1000;
    this.running = false;
  }

  resume() {
    if (this.running) return;
    this.startedAt = performance.now();
    this.running = true;
  }

  get elapsed() {
    return this.base + (this.running ? (performance.now() - this.startedAt) / 1000 : 0);
  }
}
