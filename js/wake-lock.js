// Keeps the screen on, so a phone can't go to sleep halfway through a long scan.

export class ScreenLock {
  #wanted = false;
  #lock = null;

  /**
   * Keeps the screen on until `release()`. Safe to call again, for example after
   * the browser dropped the lock because the page was hidden.
   */
  async hold() {
    this.#wanted = true;
    if (this.#held) return;
    try {
      const lock = await navigator.wakeLock.request('screen');
      // release() may have been called, or another hold() won, while waiting.
      if (this.#wanted && !this.#held) this.#lock = lock;
      else lock.release();
    } catch {
      // Unsupported or refused. Long scans might get interrupted, nothing more.
    }
  }

  get #held() {
    return Boolean(this.#lock && !this.#lock.released);
  }

  /** Lets the screen sleep again. */
  release() {
    this.#wanted = false;
    this.#lock?.release();
    this.#lock = null;
  }
}
