// The settings controls: direction, speed, and self-timer.

import { SPEED_STOPS, TIMER_STOPS, loadSettings, saveSettings } from './settings.js';

export class Controls {
  #onChange;
  #speed = document.querySelector('#speed');
  #speedValue = document.querySelector('#speed-value');
  #timer = document.querySelector('#timer');
  #timerValue = document.querySelector('#timer-value');

  /** The current { direction, seconds, timer }. */
  value = loadSettings();

  constructor(onChange) {
    this.#onChange = onChange;

    document.querySelector(`input[name="direction"][value="${this.value.direction}"]`).checked = true;
    document.querySelector('#direction').addEventListener('change', (event) => {
      this.#update({ direction: event.target.value });
    });

    this.#speed.max = SPEED_STOPS.length - 1;
    this.#speed.value = SPEED_STOPS.indexOf(this.value.seconds);
    this.#speed.addEventListener('input', () => {
      this.#update({ seconds: SPEED_STOPS[this.#speed.valueAsNumber] });
    });

    this.#timer.addEventListener('click', () => {
      const next = (TIMER_STOPS.indexOf(this.value.timer) + 1) % TIMER_STOPS.length;
      this.#update({ timer: TIMER_STOPS[next] });
    });

    this.#renderLabels();
  }

  #update(change) {
    this.value = { ...this.value, ...change };
    saveSettings(this.value);
    this.#renderLabels();
    this.#onChange(this.value);
  }

  #renderLabels() {
    const { seconds, timer } = this.value;
    this.#speedValue.textContent = `${seconds}s`;
    this.#speed.setAttribute('aria-valuetext', `${seconds} seconds`);
    this.#timerValue.textContent = timer ? `${timer}s` : 'Off';
    this.#timer.setAttribute('aria-label', `Self-timer: ${timer ? `${timer} seconds` : 'off'}`);
  }
}
