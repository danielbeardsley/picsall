// The full-screen picture viewer: browse, download, and delete.

import { photoFilename } from './photo-store.js';
import { DIRECTIONS } from './scan-geometry.js';

export class Viewer {
  #dialog;
  #gallery;
  #parts;
  #index = 0;

  /** `onClose` runs whenever the viewer closes, however that happened. */
  constructor(dialog, gallery, onClose) {
    this.#dialog = dialog;
    this.#gallery = gallery;
    this.#parts = {
      image: dialog.querySelector('#viewer-image'),
      caption: dialog.querySelector('#viewer-caption'),
      download: dialog.querySelector('#viewer-download'),
      previous: dialog.querySelector('#viewer-previous'),
      next: dialog.querySelector('#viewer-next'),
    };

    this.#parts.previous.addEventListener('click', () => this.#step(1));
    this.#parts.next.addEventListener('click', () => this.#step(-1));
    dialog.querySelector('#viewer-close').addEventListener('click', () => dialog.close());
    dialog.querySelector('#viewer-delete').addEventListener('click', () => this.#deleteCurrent());
    dialog.addEventListener('close', onClose);
    dialog.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowLeft') this.#step(1);
      if (event.key === 'ArrowRight') this.#step(-1);
    });
  }

  open(id) {
    this.#index = this.#gallery.photos.findIndex((photo) => photo.id === id);
    this.#show();
    if (!this.#dialog.open) this.#dialog.showModal();
  }

  get isOpen() {
    return this.#dialog.open;
  }

  // Photos are newest first, so a positive step goes back in time.
  #step(delta) {
    const target = this.#index + delta;
    if (target < 0 || target >= this.#gallery.photos.length) return;
    this.#index = target;
    this.#show();
  }

  #show() {
    const { photos } = this.#gallery;
    const photo = photos[this.#index];
    const { image, caption, download, previous, next } = this.#parts;

    image.src = photo.url;
    image.alt = `Picture scanned ${DIRECTIONS[photo.direction].label.toLowerCase()} over ${photo.seconds} seconds`;
    caption.textContent = `${DIRECTIONS[photo.direction].label} · ${photo.seconds}s · ${photo.width}×${photo.height}`;
    download.href = photo.url;
    download.download = photoFilename(photo);
    previous.disabled = this.#index === photos.length - 1;
    next.disabled = this.#index === 0;
  }

  async #deleteCurrent() {
    await this.#gallery.remove(this.#gallery.photos[this.#index].id);
    const { photos } = this.#gallery;
    if (photos.length === 0) {
      this.#dialog.close();
      return;
    }
    this.#index = Math.min(this.#index, photos.length - 1);
    this.#show();
  }
}
