// The settings controls: direction, speed, smoothness, and self-timer.

import {
  SMOOTHNESS_STOPS,
  SPEED_STOPS,
  TIMER_STOPS,
  loadSettings,
  saveSettings,
} from './settings.js';

const SMOOTHNESS_LABELS = ['Sharp', 'Smooth', 'Softer', 'Dreamy'];

export class Controls {
  #onChange;
  #speed = document.querySelector('#speed');
  #speedValue = document.querySelector('#speed-value');
  #timer = document.querySelector('#timer');
  #timerValue = document.querySelector('#timer-value');
  #smoothness = document.querySelector('#smoothness');
  #smoothnessValue = document.querySelector('#smoothness-value');

  /** The current { direction, seconds, timer, smoothness }. */
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

    this.#timer.addEventListener('click', () => this.#cycle('timer', TIMER_STOPS));
    this.#smoothness.addEventListener('click', () => this.#cycle('smoothness', SMOOTHNESS_STOPS));

    this.#renderLabels();
  }

  #cycle(key, stops) {
    const next = (stops.indexOf(this.value[key]) + 1) % stops.length;
    this.#update({ [key]: stops[next] });
  }

  #update(change) {
    this.value = { ...this.value, ...change };
    saveSettings(this.value);
    this.#renderLabels();
    this.#onChange(this.value);
  }

  #renderLabels() {
    const { seconds, timer, smoothness } = this.value;
    this.#speedValue.textContent = `${seconds}s`;
    this.#speed.setAttribute('aria-valuetext', `${seconds} seconds`);
    this.#timerValue.textContent = timer ? `${timer}s` : 'Off';
    this.#timer.setAttribute('aria-label', `Self-timer: ${timer ? `${timer} seconds` : 'off'}`);
    this.#smoothnessValue.textContent = SMOOTHNESS_LABELS[smoothness];
    this.#smoothness.setAttribute('aria-label', `Scan smoothness: ${SMOOTHNESS_LABELS[smoothness]}`);
  }
}
