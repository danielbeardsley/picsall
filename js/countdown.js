// The big self-timer numbers shown before a scan starts.

const POP = [
  { transform: 'scale(0.4)', opacity: 0 },
  { transform: 'scale(1.1)', opacity: 1, offset: 0.2 },
  { transform: 'scale(1)', opacity: 1, offset: 0.8 },
  { transform: 'scale(1)', opacity: 0 },
];

/** Counts down in `element`. Rejects with `signal.reason` if aborted. */
export async function runCountdown(element, seconds, signal) {
  try {
    for (let remaining = seconds; remaining > 0; remaining--) {
      element.textContent = remaining;
      element.animate(POP, { duration: 1000 });
      await wait(1000, signal);
    }
  } finally {
    element.textContent = '';
  }
}

function wait(ms, signal) {
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal.addEventListener('abort', onAbort, { once: true });
  });
}
