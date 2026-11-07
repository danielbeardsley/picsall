// The heart of the app: builds a picture one scan line at a time.
//
// The canvas sits on top of the live video and starts out transparent. Each
// animation frame copies the lines the scan has just passed from the current
// video frame onto the canvas. Those lines are now frozen, and the live video
// keeps showing through everywhere the scan hasn't reached yet.

import {
  bandRect,
  coverCrop,
  lineCount,
  linesDone,
  mirrorRect,
} from './scan-geometry.js';

const JPEG_QUALITY = 0.92;

export class Scanner {
  #video;
  #canvas;
  #ctx;

  constructor(video, canvas) {
    this.#video = video;
    this.#canvas = canvas;
    this.#ctx = canvas.getContext('2d');
  }

  /** Removes the picture so the live video shows again. */
  clear() {
    this.#canvas.width = 0;
    this.#canvas.height = 0;
  }

  /**
   * Runs one scan. Resolves with { blob, width, height } when it finishes and
   * rejects with `signal.reason` if it is aborted.
   */
  async scan({ direction, durationMs, mirrored, view, signal, onProgress }) {
    const crop = coverCrop(this.#video.videoWidth, this.#video.videoHeight, view.width, view.height);
    this.#prepareCanvas(crop, mirrored);

    const total = lineCount(direction, crop.w, crop.h);
    await new Promise((resolve, reject) => {
      const startedAt = performance.now();
      let done = 0;
      let frame;

      const onAbort = () => {
        cancelAnimationFrame(frame);
        reject(signal.reason);
      };

      const tick = (now) => {
        const target = linesDone(now - startedAt, durationMs, total);
        if (target > done) {
          this.#copyBand(bandRect(direction, done, target, crop.w, crop.h), crop, mirrored);
          done = target;
        }
        onProgress(done / total);
        if (done < total) {
          frame = requestAnimationFrame(tick);
        } else {
          signal.removeEventListener('abort', onAbort);
          resolve();
        }
      };

      signal.addEventListener('abort', onAbort, { once: true });
      frame = requestAnimationFrame(tick);
    });

    const blob = await new Promise((resolve) => {
      this.#canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY);
    });
    if (!blob) throw new Error('The browser could not encode the picture');
    return { blob, width: crop.w, height: crop.h };
  }

  #prepareCanvas(crop, mirrored) {
    // Resizing also wipes the canvas and resets the context state set below.
    this.#canvas.width = crop.w;
    this.#canvas.height = crop.h;
    this.#ctx.imageSmoothingEnabled = false;
    // Mirror into the canvas itself, so the saved file matches the screen.
    if (mirrored) this.#ctx.setTransform(-1, 0, 0, 1, crop.w, 0);
  }

  #copyBand(band, crop, mirrored) {
    const { x, y, w, h } = mirrored ? mirrorRect(band, crop.w) : band;
    this.#ctx.drawImage(this.#video, crop.x + x, crop.y + y, w, h, x, y, w, h);
  }
}
