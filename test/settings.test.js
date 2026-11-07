import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULTS, sanitizeSettings } from '../js/settings.js';

test('valid settings pass through', () => {
  const settings = { direction: 'left', seconds: 30, timer: 0 };
  assert.deepEqual(sanitizeSettings(settings), settings);
});

test('missing or corrupt settings fall back to defaults', () => {
  assert.deepEqual(sanitizeSettings(null), DEFAULTS);
  assert.deepEqual(sanitizeSettings('nope'), DEFAULTS);
  assert.deepEqual(
    sanitizeSettings({ direction: 'toString', seconds: 7, timer: -1 }),
    DEFAULTS,
  );
});
