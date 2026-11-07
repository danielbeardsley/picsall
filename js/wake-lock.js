// Keeps the screen on, so a phone can't go to sleep halfway through a long scan.

/** Returns a function that lets the screen sleep again. */
export async function keepScreenOn() {
  try {
    const lock = await navigator.wakeLock.request('screen');
    return () => lock.release();
  } catch {
    // Unsupported or refused. Long scans might get interrupted, nothing more.
    return () => {};
  }
}
