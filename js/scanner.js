// The heart of the app: builds a picture one scan line at a time.
//
// The canvas sits on top of the live video and starts out transparent. Each new
// camera frame stamps the lines the scan has just passed onto the canvas. Those
// lines are now frozen, and the live video keeps showing through everywhere the
// scan hasn't reached yet.
//
// A camera only delivers so many frames a second, so a fast scan stamps many
// lines at once, leaving a visible step on anything moving. To hide those steps,
// a stamp can also reach back over lines already captured, fading in across
// them. Stamps go through an offscreen canvas where that fade gets applied.

import {
  bandRect,
  coverCrop,
  fadeAxis,
  fadeStart,
  lineCount,
  linesDone,
  mirrorRect,
} from './scan-geometry.js';

const JPEG_QUALITY = 0.92;

/**
 * If no camera frame has arrived for this long, capture anyway so the scan keeps
 * moving. Without frame callbacks, every animation frame has to capture instead.
 */
const STALLED_CAMERA_MS = 250;

export class Scanner {
  #video;
  #canvas;
  #ctx;
  #stampCanvas = document.createElement('canvas');
  #stampCtx = this.#stampCanvas.getContext('2d');
  /** Pauses and resumes the scan in progress, if there is one. */
  #clock = null;

  constructor(video, canvas) {
    this.#video = video;
    this.#canvas = canvas;
    this.#ctx = canvas.getContext('2d');
  }

  /** Removes the picture so the live video shows again. */
  clear() {
    for (const canvas of [this.#canvas, this.#stampCanvas]) {
      canvas.width = 0;
      canvas.height = 0;
    }
  }

  /** Freezes the scan where it is. The live video keeps playing ahead of it. */
  pause() {
    this.#clock?.pause();
  }

  /** Carries on a paused scan from the line where it stopped. */
  resume() {
    this.#clock?.resume();
  }

  /**
   * Runs one scan. Resolves with { blob, width, height } when it finishes and
   * rejects with `signal.reason` if it is aborted.
   */
  async scan({ direction, durationMs, smoothness, mirrored, view, signal, onProgress }) {
    const crop = coverCrop(this.#video.videoWidth, this.#video.videoHeight, view.width, view.height);
    this.#prepareCanvases(crop, mirrored);

    const total = lineCount(direction, crop.w, crop.h);
    const bandStarts = [];
    let done = 0;

    const captureUpTo = (elapsedMs) => {
      const target = linesDone(elapsedMs, durationMs, total);
      if (target <= done) return done;
      const fadeFrom = fadeStart(bandStarts, done, smoothness);
      this.#stamp({ direction, fadeFrom, from: done, to: target, crop, mirrored });
      bandStarts.push(done);
      done = target;
      return done;
    };

    await this.#runClock({ durationMs, total, captureUpTo, signal, onProgress });

    const blob = await new Promise((resolve) => {
      this.#canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY);
    });
    if (!blob) throw new Error('The browser could not encode the picture');
    return { blob, width: crop.w, height: crop.h };
  }

  /**
   * Two clocks run during a scan. Camera frames decide when to capture, so each
   * frame is stamped once and fades blend two different moments. Animation
   * frames keep the scan line moving smoothly and end the scan on time.
   * Pausing stops both, and resuming moves the start time on by the length of
   * the pause, so the scan carries on as if no time had passed.
   */
  #runClock({ durationMs, total, captureUpTo, signal, onProgress }) {
    const video = this.#video;
    const hasFrameCallbacks = 'requestVideoFrameCallback' in video;
    const captureAfterMs = hasFrameCallbacks ? STALLED_CAMERA_MS : 0;

    return new Promise((resolve, reject) => {
      let startedAt = performance.now();
      let lastCapture = startedAt;
      let pausedAt = null;
      let done = 0;
      let animationFrame;
      let cameraFrame;

      const capture = (now) => {
        lastCapture = now;
        done = captureUpTo(now - startedAt);
      };

      const schedule = () => {
        if (hasFrameCallbacks) cameraFrame = video.requestVideoFrameCallback(onCameraFrame);
        animationFrame = requestAnimationFrame(onAnimationFrame);
      };

      const cancel = () => {
        cancelAnimationFrame(animationFrame);
        if (hasFrameCallbacks) video.cancelVideoFrameCallback(cameraFrame);
      };

      const stop = () => {
        cancel();
        this.#clock = null;
        signal.removeEventListener('abort', onAbort);
      };

      const onAbort = () => {
        stop();
        reject(signal.reason);
      };

      const onCameraFrame = (now) => {
        capture(now);
        cameraFrame = video.requestVideoFrameCallback(onCameraFrame);
      };

      const onAnimationFrame = (now) => {
        const elapsed = now - startedAt;
        if (elapsed >= durationMs || now - lastCapture >= captureAfterMs) capture(now);
        onProgress(Math.min(1, Math.max(0, elapsed / durationMs)));
        if (done < total) {
          animationFrame = requestAnimationFrame(onAnimationFrame);
        } else {
          stop();
          resolve();
        }
      };

      this.#clock = {
        pause() {
          if (pausedAt !== null) return;
          pausedAt = performance.now();
          cancel();
        },
        resume() {
          if (pausedAt === null) return;
          const now = performance.now();
          startedAt += now - pausedAt;
          lastCapture = now;
          pausedAt = null;
          schedule();
        },
      };

      signal.addEventListener('abort', onAbort, { once: true });
      schedule();
    });
  }

  #prepareCanvases(crop, mirrored) {
    // Resizing also wipes a canvas and resets the context state set below.
    for (const canvas of [this.#canvas, this.#stampCanvas]) {
      canvas.width = crop.w;
      canvas.height = crop.h;
    }
    this.#ctx.imageSmoothingEnabled = false;
    this.#stampCtx.imageSmoothingEnabled = false;
    // Mirror on the way in, so the saved file matches the screen.
    if (mirrored) this.#stampCtx.setTransform(-1, 0, 0, 1, crop.w, 0);
  }

  /** Puts lines [fadeFrom, to) of the current video frame onto the picture. */
  #stamp({ direction, fadeFrom, from, to, crop, mirrored }) {
    const region = bandRect(direction, fadeFrom, to, crop.w, crop.h);
    const { x, y, w, h } = mirrored ? mirrorRect(region, crop.w) : region;
    this.#stampCtx.drawImage(this.#video, crop.x + x, crop.y + y, w, h, x, y, w, h);

    if (fadeFrom < from) {
      this.#fadeIn(
        bandRect(direction, fadeFrom, from, crop.w, crop.h),
        fadeAxis(direction, fadeFrom, from, crop.w, crop.h),
      );
    }

    this.#ctx.drawImage(
      this.#stampCanvas,
      region.x, region.y, region.w, region.h,
      region.x, region.y, region.w, region.h,
    );
  }

  /** Makes `rect` of the stamp ramp from transparent to solid along `axis`. */
  #fadeIn(rect, { x0, y0, x1, y1 }) {
    const ctx = this.#stampCtx;
    const gradient = ctx.createLinearGradient(x0, y0, x1, y1);
    gradient.addColorStop(0, '#0000');
    gradient.addColorStop(1, '#000');

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.w, rect.h);
    ctx.clip();
    ctx.globalCompositeOperation = 'destination-in';
    ctx.fillStyle = gradient;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.restore();
  }
}
