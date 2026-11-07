// Pure maths for the scan: no DOM in here, so it can be unit tested in Node.
//
// Vocabulary:
//   crop  - the part of the camera frame that is visible on screen
//   line  - one row (vertical wipe) or column (horizontal wipe) of the picture
//   band  - the run of lines captured from a single camera frame
//   fade  - already captured lines that a new band blends over

export const DIRECTIONS = Object.freeze({
  down: { axis: 'y', reversed: false, label: 'Top to bottom' },
  up: { axis: 'y', reversed: true, label: 'Bottom to top' },
  right: { axis: 'x', reversed: false, label: 'Left to right' },
  left: { axis: 'x', reversed: true, label: 'Right to left' },
});

/**
 * The centred part of a source frame that `object-fit: cover` shows in a view.
 * Scanning exactly this region makes the wipe run from screen edge to screen
 * edge, and makes the saved picture match what was on screen.
 */
export function coverCrop(sourceWidth, sourceHeight, viewWidth, viewHeight) {
  const viewAspect = viewWidth / viewHeight;
  let w = sourceWidth;
  let h = sourceHeight;
  if (sourceWidth / sourceHeight > viewAspect) {
    w = Math.round(sourceHeight * viewAspect);
  } else {
    h = Math.round(sourceWidth / viewAspect);
  }
  return {
    x: Math.floor((sourceWidth - w) / 2),
    y: Math.floor((sourceHeight - h) / 2),
    w,
    h,
  };
}

/** How many lines a full scan of a w x h picture takes. */
export function lineCount(direction, w, h) {
  return DIRECTIONS[direction].axis === 'y' ? h : w;
}

/** How many lines should have been captured after `elapsedMs` of the scan. */
export function linesDone(elapsedMs, durationMs, total) {
  const done = Math.floor((elapsedMs / durationMs) * total);
  return Math.min(total, Math.max(0, done));
}

/** The canvas rectangle covering scan lines [from, to). */
export function bandRect(direction, from, to, w, h) {
  const { axis, reversed } = DIRECTIONS[direction];
  const size = axis === 'y' ? h : w;
  const start = reversed ? size - to : from;
  const length = to - from;
  return axis === 'y'
    ? { x: 0, y: start, w, h: length }
    : { x: start, y: 0, w: length, h };
}

/**
 * The line where a new band's fade begins, `smoothness` bands back from `from`.
 * Using the real band starts rather than a fixed width keeps the blend seamless
 * when the frame rate wobbles: a smoothness of 1 fades across exactly the
 * previous band, so each line becomes a mix of the two nearest camera frames.
 */
export function fadeStart(bandStarts, from, smoothness) {
  if (smoothness === 0) return from;
  return bandStarts.at(-smoothness) ?? bandStarts[0] ?? from;
}

/** The ends of a fade across lines [fadeFrom, from), in scan order. */
export function fadeAxis(direction, fadeFrom, from, w, h) {
  const { axis, reversed } = DIRECTIONS[direction];
  const size = axis === 'y' ? h : w;
  const start = reversed ? size - fadeFrom : fadeFrom;
  const end = reversed ? size - from : from;
  return axis === 'y'
    ? { x0: 0, y0: start, x1: 0, y1: end }
    : { x0: start, y0: 0, x1: end, y1: 0 };
}

/** The same rectangle reflected across the vertical centre of a w-wide picture. */
export function mirrorRect(rect, w) {
  return { ...rect, x: w - rect.x - rect.w };
}

/** Where the scan line sits on its axis (0-1 from top/left) at a given progress. */
export function scanPosition(direction, progress) {
  return DIRECTIONS[direction].reversed ? 1 - progress : progress;
}
