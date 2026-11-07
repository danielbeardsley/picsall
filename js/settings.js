// User settings, remembered between visits.

import { DIRECTIONS } from './scan-geometry.js';

const STORAGE_KEY = 'picsall.settings';

/** Slider stops, in seconds. Spaced unevenly so the slider covers a wide range. */
export const SPEED_STOPS = Object.freeze([1, 2, 3, 5, 8, 10, 15, 20, 30, 45, 60]);

/** Self-timer choices, in seconds. */
export const TIMER_STOPS = Object.freeze([0, 3, 5, 10]);

/**
 * How many camera frames back the edge of each band fades, by level. 0 keeps the
 * hard slices, 1 removes them, and more than that smears like motion blur.
 */
export const SMOOTHNESS_STOPS = Object.freeze([0, 1, 2, 3]);

export const DEFAULTS = Object.freeze({ direction: 'down', seconds: 5, timer: 3, smoothness: 1 });

/** Replaces anything missing or invalid with its default. */
export function sanitizeSettings(raw) {
  const value = raw && typeof raw === 'object' ? raw : {};
  return {
    direction: Object.hasOwn(DIRECTIONS, value.direction) ? value.direction : DEFAULTS.direction,
    seconds: SPEED_STOPS.includes(value.seconds) ? value.seconds : DEFAULTS.seconds,
    timer: TIMER_STOPS.includes(value.timer) ? value.timer : DEFAULTS.timer,
    smoothness: SMOOTHNESS_STOPS.includes(value.smoothness) ? value.smoothness : DEFAULTS.smoothness,
  };
}

// localStorage access can throw (blocked site data), and losing settings is harmless.
export function loadSettings() {
  try {
    return sanitizeSettings(JSON.parse(localStorage.getItem(STORAGE_KEY)));
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Nothing useful to do; settings just won't be remembered.
  }
}
