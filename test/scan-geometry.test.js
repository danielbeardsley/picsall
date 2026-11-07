import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DIRECTIONS,
  bandRect,
  coverCrop,
  fadeAxis,
  fadeStart,
  lineCount,
  linesDone,
  mirrorRect,
  scanPosition,
} from '../js/scan-geometry.js';

test('coverCrop keeps the full frame when the aspect ratios match', () => {
  assert.deepEqual(coverCrop(1920, 1080, 1280, 720), { x: 0, y: 0, w: 1920, h: 1080 });
});

test('coverCrop trims the sides for a tall view', () => {
  assert.deepEqual(coverCrop(1920, 1080, 1080, 1920), { x: 656, y: 0, w: 608, h: 1080 });
});

test('coverCrop trims top and bottom for a wide view', () => {
  assert.deepEqual(coverCrop(1000, 1000, 200, 100), { x: 0, y: 250, w: 1000, h: 500 });
});

test('lineCount follows the axis of the wipe', () => {
  assert.equal(lineCount('down', 40, 30), 30);
  assert.equal(lineCount('up', 40, 30), 30);
  assert.equal(lineCount('left', 40, 30), 40);
  assert.equal(lineCount('right', 40, 30), 40);
});

test('linesDone is linear in time and clamped to the picture', () => {
  assert.equal(linesDone(-5, 1000, 100), 0);
  assert.equal(linesDone(0, 1000, 100), 0);
  assert.equal(linesDone(500, 1000, 100), 50);
  assert.equal(linesDone(1000, 1000, 100), 100);
  assert.equal(linesDone(99999, 1000, 100), 100);
});

test('bandRect places bands from the starting edge of each direction', () => {
  assert.deepEqual(bandRect('down', 0, 3, 40, 30), { x: 0, y: 0, w: 40, h: 3 });
  assert.deepEqual(bandRect('up', 0, 3, 40, 30), { x: 0, y: 27, w: 40, h: 3 });
  assert.deepEqual(bandRect('right', 0, 3, 40, 30), { x: 0, y: 0, w: 3, h: 30 });
  assert.deepEqual(bandRect('left', 0, 3, 40, 30), { x: 37, y: 0, w: 3, h: 30 });
});

test('consecutive bands tile the whole picture exactly once', () => {
  const [w, h] = [17, 11];
  for (const direction of Object.keys(DIRECTIONS)) {
    const covered = new Uint8Array(w * h);
    const total = lineCount(direction, w, h);
    let done = 0;
    for (const next of [1, 2, 2, 5, total]) {
      const band = bandRect(direction, done, Math.min(next, total), w, h);
      for (let y = band.y; y < band.y + band.h; y++) {
        for (let x = band.x; x < band.x + band.w; x++) covered[y * w + x]++;
      }
      done = Math.max(done, Math.min(next, total));
    }
    assert.ok(covered.every((count) => count === 1), `${direction} left gaps or overlaps`);
  }
});

test('mirrorRect reflects a rectangle and is its own inverse', () => {
  const rect = { x: 2, y: 5, w: 3, h: 7 };
  assert.deepEqual(mirrorRect(rect, 40), { x: 35, y: 5, w: 3, h: 7 });
  assert.deepEqual(mirrorRect(mirrorRect(rect, 40), 40), rect);
});

test('scanPosition runs backwards for reversed directions', () => {
  assert.equal(scanPosition('down', 0.25), 0.25);
  assert.equal(scanPosition('right', 0.25), 0.25);
  assert.equal(scanPosition('up', 0.25), 0.75);
  assert.equal(scanPosition('left', 0.25), 0.75);
});

test('fadeStart reaches back the requested number of bands', () => {
  const starts = [0, 12, 20];
  assert.equal(fadeStart(starts, 33, 1), 20);
  assert.equal(fadeStart(starts, 33, 2), 12);
  assert.equal(fadeStart(starts, 33, 3), 0);
});

test('fadeStart stops at the start of the picture', () => {
  assert.equal(fadeStart([0, 12], 20, 3), 0);
  assert.equal(fadeStart([], 0, 3), 0);
});

test('fadeStart gives no fade at smoothness 0', () => {
  assert.equal(fadeStart([0, 12, 20], 33, 0), 33);
});

test('fadeAxis runs in scan order for every direction', () => {
  assert.deepEqual(fadeAxis('down', 5, 9, 40, 30), { x0: 0, y0: 5, x1: 0, y1: 9 });
  assert.deepEqual(fadeAxis('up', 5, 9, 40, 30), { x0: 0, y0: 25, x1: 0, y1: 21 });
  assert.deepEqual(fadeAxis('right', 5, 9, 40, 30), { x0: 5, y0: 0, x1: 9, y1: 0 });
  assert.deepEqual(fadeAxis('left', 5, 9, 40, 30), { x0: 35, y0: 0, x1: 31, y1: 0 });
});

test('fadeAxis spans the same lines as bandRect', () => {
  for (const direction of Object.keys(DIRECTIONS)) {
    const rect = bandRect(direction, 5, 9, 40, 30);
    const { x0, y0, x1, y1 } = fadeAxis(direction, 5, 9, 40, 30);
    const [low, high] = DIRECTIONS[direction].axis === 'y'
      ? [Math.min(y0, y1), Math.max(y0, y1)]
      : [Math.min(x0, x1), Math.max(x0, x1)];
    const [rectLow, rectSize] = DIRECTIONS[direction].axis === 'y'
      ? [rect.y, rect.h]
      : [rect.x, rect.w];
    assert.deepEqual([low, high], [rectLow, rectLow + rectSize], direction);
  }
});
