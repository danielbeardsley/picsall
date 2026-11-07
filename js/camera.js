// Owns the camera stream and feeds it to the <video> element.

const RESOLUTION = { width: { ideal: 1920 }, height: { ideal: 1080 } };

export class Camera {
  #video;
  #stream = null;

  constructor(video) {
    this.#video = video;
  }

  get #settings() {
    return this.#stream?.getVideoTracks()[0]?.getSettings() ?? {};
  }

  /** Selfie cameras and desktop webcams feel wrong unless they act like a mirror. */
  get mirrored() {
    return this.#settings.facingMode !== 'environment';
  }

  async start() {
    await this.#open({ facingMode: { ideal: 'user' } });
  }

  async canSwitch() {
    return (await videoInputs()).length > 1;
  }

  /**
   * Phones report which way a camera faces, so swap front and back directly:
   * cycling devices would also land on every ultrawide and telephoto lens.
   * Desktop webcams don't report it, so step through the devices instead.
   */
  async switch() {
    const { facingMode, deviceId } = this.#settings;
    if (facingMode) {
      const other = facingMode === 'user' ? 'environment' : 'user';
      await this.#open({ facingMode: { exact: other } });
      return;
    }
    const ids = (await videoInputs()).map((device) => device.deviceId);
    const next = ids[(ids.indexOf(deviceId) + 1) % ids.length];
    await this.#open({ deviceId: { exact: next } });
  }

  async #open(constraints) {
    // Release the old camera first: many phones can't run two at once.
    this.#stream?.getTracks().forEach((track) => track.stop());
    this.#stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { ...RESOLUTION, ...constraints },
    });
    this.#video.srcObject = this.#stream;
    await this.#video.play();
  }
}

async function videoInputs() {
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter((device) => device.kind === 'videoinput');
}

/** A message a person can act on, for any error from starting the camera. */
export function describeCameraError(error) {
  if (!window.isSecureContext || !navigator.mediaDevices) {
    return 'Browsers only allow the camera on https:// or localhost. See the README for how to run Picsall.';
  }
  switch (error?.name) {
    case 'NotAllowedError':
      return 'Picsall needs permission to use the camera. Allow it in your browser, then try again.';
    case 'NotFoundError':
    case 'OverconstrainedError':
      return "Couldn't find a camera on this device.";
    case 'NotReadableError':
    case 'AbortError':
      return 'The camera is busy. Close anything else using it, then try again.';
    default:
      return `The camera wouldn't start (${error?.message ?? error}).`;
  }
}
