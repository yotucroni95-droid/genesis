// Loads the asset manifest and every image in it, reporting progress.
// A missing file never breaks the game: it is replaced by a placeholder.

import { makePlaceholder } from './placeholders.js';

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function loadJSON(url) {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Não foi possível carregar ${url} (${res.status})`);
  return res.json();
}

export class Assets {
  constructor() {
    this.entries = new Map(); // id -> { ...manifest entry, image, placeholder, url }
    this.data = new Map();    // JSON content by path
    this.manifest = null;
  }

  /** Image (HTMLImageElement or canvas) for an asset id, or null. */
  image(id) {
    const e = this.entries.get(id);
    return e ? e.image : null;
  }

  entry(id) {
    return this.entries.get(id) || null;
  }

  /** URL usable in <img src>, for DOM-based UI. */
  url(id) {
    const e = this.entries.get(id);
    if (!e || !e.image) return '';
    if (!e.url) e.url = e.placeholder ? e.image.toDataURL() : e.fullSrc;
    return e.url;
  }

  json(path) {
    return this.data.get(path);
  }

  /**
   * @param {string} manifestUrl
   * @param {string[]} jsonFiles extra JSON content to preload (relative to /content)
   * @param {(fraction:number)=>void} onProgress
   */
  async loadAll(manifestUrl, jsonFiles, onProgress) {
    this.manifest = await loadJSON(manifestUrl);
    const base = this.manifest.basePath || '';
    const list = this.manifest.assets;
    const total = list.length + jsonFiles.length;
    let done = 0;
    const tick = () => onProgress && onProgress(++done / total);

    const jsonJobs = jsonFiles.map(async (path) => {
      this.data.set(path, await loadJSON(`content/${path}`));
      tick();
    });

    // Reserve slots in manifest order so lists (e.g. the gallery) keep that order.
    for (const asset of list) this.entries.set(asset.id, null);

    const imageJobs = list.map(async (asset) => {
      const fullSrc = base + asset.src;
      const img = await loadImage(fullSrc);
      const entry = { ...asset, fullSrc, image: img, placeholder: !img, url: '' };
      if (!img) entry.image = makePlaceholder(asset);
      this.entries.set(asset.id, entry);
      tick();
    });

    await Promise.all([...jsonJobs, ...imageJobs]);
    return this;
  }
}
