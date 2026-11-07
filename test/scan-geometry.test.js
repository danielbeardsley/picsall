import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DIRECTIONS,
  bandRect,
  coverCrop,
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
