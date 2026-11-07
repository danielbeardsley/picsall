// Wires everything together and owns the app's state:
//
//   starting -> ready -> countdown -> scanning -> review -> ready
//                                       ^  |
//                                       paused
//
// plus `no-camera`, entered from starting. Stopping from countdown, scanning,
// or paused goes back to ready. The state lives on <body
// data-state> because the stylesheet decides what is visible in each one.

import { Camera, describeCameraError } from './camera.js';
import { Controls } from './controls.js';
import { runCountdown } from './countdown.js';
import { Gallery } from './gallery.js';
import { openPhotoStore } from './photo-store.js';
import { DIRECTIONS, scanPosition } from './scan-geometry.js';
import { Scanner } from './scanner.js';
import { Viewer } from './viewer.js';
import { ScreenLock } from './wake-lock.js';

const elements = {
  stage: document.querySelector('#stage'),
  video: document.querySelector('#live'),
  film: document.querySelector('#film'),
  scanline: document.querySelector('#scanline'),
  countdown: document.querySelector('#countdown'),
  noticeText: document.querySelector('#notice-text'),
  retry: document.querySelector('#retry'),
  toast: document.querySelector('#toast'),
  shutter: document.querySelector('#shutter'),
  stop: document.querySelector('#stop'),
  switchCamera: document.querySelector('#switch-camera'),
  fullscreen: document.querySelector('#fullscreen'),
};

const camera = new Camera(elements.video);
const scanner = new Scanner(elements.video, elements.film);
const controls = new Controls(() => showScanline(0));
const gallery = new Gallery(await openPhotoStore(), document.querySelector('#recent'), openPhoto);
const viewer = new Viewer(document.querySelector('#viewer'), gallery, onViewerClosed);
const screenLock = new ScreenLock();

/** A second shutter tap this soon after the last one is a double-tap, and is ignored. */
const DOUBLE_TAP_MS = 500;

/** What the shutter does in each state, when it isn't taking a picture. */
const SHUTTER_LABELS = { countdown: 'Stop', scanning: 'Pause', paused: 'Resume' };

/** Aborts the capture in progress, if there is one. */
let capture = null;
let lastShutterTap = -Infinity;

function setState(state) {
  document.body.dataset.state = state;
  elements.shutter.setAttribute('aria-label', SHUTTER_LABELS[state] ?? 'Take picture');
}

function currentState() {
  return document.body.dataset.state;
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.animate(
    [{ opacity: 0 }, { opacity: 1, offset: 0.05 }, { opacity: 1, offset: 0.9 }, { opacity: 0 }],
    { duration: 4000 },
  );
}

function showScanline(progress) {
  const { direction } = controls.value;
  const { style, dataset } = elements.scanline;
  dataset.axis = DIRECTIONS[direction].axis;
  style.setProperty('--position', scanPosition(direction, progress));
  elements.shutter.style.setProperty('--progress', progress);
}

function syncMirroring() {
  document.body.dataset.mirrored = camera.mirrored;
}

async function startCamera() {
  setState('starting');
  try {
    await camera.start();
    syncMirroring();
    elements.switchCamera.hidden = !(await camera.canSwitch());
    setState('ready');
  } catch (error) {
    console.error(error);
    elements.noticeText.textContent = describeCameraError(error);
    setState('no-camera');
  }
}

async function takePicture() {
  const controller = new AbortController();
  const { signal } = controller;
  const { direction, seconds, timer, smoothness } = controls.value;
  capture = controller;
  screenLock.hold();

  try {
    setState('countdown');
    await runCountdown(elements.countdown, timer, signal);

    setState('scanning');
    const picture = await scanner.scan({
      direction,
      durationMs: seconds * 1000,
      smoothness,
      mirrored: camera.mirrored,
      view: { width: elements.stage.clientWidth, height: elements.stage.clientHeight },
      signal,
      onProgress: showScanline,
    });

    const id = await gallery.add({ ...picture, direction, seconds, createdAt: Date.now() });
    setState('review');
    viewer.open(id);
  } catch (error) {
    returnToReady();
    if (!signal.aborted) {
      console.error(error);
      showToast("That picture couldn't be saved.");
    } else if (typeof signal.reason === 'string') {
      showToast(signal.reason);
    }
  } finally {
    capture = null;
    screenLock.release();
  }
}

function pauseScan() {
  scanner.pause();
  setState('paused');
  screenLock.release();
}

function resumeScan() {
  screenLock.hold();
  setState('scanning');
  scanner.resume();
}

function returnToReady() {
  scanner.clear();
  showScanline(0);
  setState('ready');
}

function openPhoto(id) {
  setState('review');
  viewer.open(id);
}

function onViewerClosed() {
  returnToReady();
}

function onShutter() {
  const now = performance.now();
  if (now - lastShutterTap < DOUBLE_TAP_MS) return;

  const state = currentState();
  if (state === 'ready' && !capture) takePicture();
  else if (state === 'countdown') capture?.abort();
  else if (state === 'scanning') pauseScan();
  else if (state === 'paused') resumeScan();
  else return;
  lastShutterTap = now;
}

async function onSwitchCamera() {
  elements.switchCamera.disabled = true;
  try {
    await camera.switch();
    syncMirroring();
  } catch (error) {
    console.error(error);
    showToast("Couldn't switch cameras.");
    await startCamera();
  } finally {
    elements.switchCamera.disabled = false;
  }
}

function onKeyDown(event) {
  if (viewer.isOpen) return;
  if (event.key === 'Escape') capture?.abort();
  const typing = event.target.closest('button, a, input');
  if (event.key === ' ' && !typing) {
    event.preventDefault();
    onShutter();
  }
}

elements.shutter.addEventListener('click', onShutter);
elements.stop.addEventListener('click', () => capture?.abort());
elements.retry.addEventListener('click', startCamera);
elements.switchCamera.addEventListener('click', onSwitchCamera);
document.addEventListener('keydown', onKeyDown);

// Animation frames stop in a hidden tab, so a scan pauses until the app is
// back. A countdown can't sensibly pause, so it stops instead. Rotating a phone
// changes the shape of the camera frame mid-picture, which no scan can survive.
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) return;
  const state = currentState();
  if (state === 'scanning') pauseScan();
  else if (state === 'countdown') capture?.abort('Picture stopped because the app was hidden.');
});
elements.video.addEventListener('resize', () => {
  capture?.abort('Scan stopped because the camera view changed.');
});

if (document.fullscreenEnabled) {
  elements.fullscreen.hidden = false;
  elements.fullscreen.addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen();
  });
}

showScanline(0);
await gallery.refresh();
await startCamera();
