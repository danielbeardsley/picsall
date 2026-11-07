// The strip of recent pictures, and the object URLs that display them.

export class Gallery {
  #store;
  #strip;
  #onOpen;
  #urls = new Map();

  /** Newest first. Each photo also has a `url` usable as an image src. */
  photos = [];

  constructor(store, strip, onOpen) {
    this.#store = store;
    this.#strip = strip;
    this.#onOpen = onOpen;
  }

  async add(photo) {
    const saved = await this.#store.add(photo);
    await this.refresh();
    return saved.id;
  }

  async remove(id) {
    await this.#store.remove(id);
    await this.refresh();
  }

  async refresh() {
    const stored = await this.#store.list();
    this.#releaseUrls(new Set(stored.map((photo) => photo.id)));
    this.photos = stored.map((photo) => ({ ...photo, url: this.#urlFor(photo) }));
    this.#render();
  }

  #urlFor(photo) {
    if (!this.#urls.has(photo.id)) {
      this.#urls.set(photo.id, URL.createObjectURL(photo.blob));
    }
    return this.#urls.get(photo.id);
  }

  #releaseUrls(keepIds) {
    for (const [id, url] of this.#urls) {
      if (keepIds.has(id)) continue;
      URL.revokeObjectURL(url);
      this.#urls.delete(id);
    }
  }

  #render() {
    this.#strip.replaceChildren(...this.photos.map((photo, index) => {
      const image = document.createElement('img');
      image.src = photo.url;
      image.alt = '';

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'thumb';
      button.setAttribute('aria-label', `Open picture ${index + 1} of ${this.photos.length}`);
      button.addEventListener('click', () => this.#onOpen(photo.id));
      button.append(image);

      const item = document.createElement('li');
      item.append(button);
      return item;
    }));
  }
}
