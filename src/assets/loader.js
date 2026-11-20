// Loads the asset manifest and every image in it, reporting progress.
// A missing file never breaks the game: it is replaced by a placeholder.

import { makePlaceholder } from './placeholders.js';

// a file that never arrives (slow network, server hiccup) must not freeze the
// loading bar: after a while it gets the placeholder and the game goes on
const IMAGE_TIMEOUT_MS = 15000;
const LAZY_KINDS = new Set(['map', 'puzzle']);

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    const timer = setTimeout(() => resolve(null), IMAGE_TIMEOUT_MS);
    img.onload = () => { clearTimeout(timer); resolve(img); };
    img.onerror = () => { clearTimeout(timer); resolve(null); };
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
    if (e && e.lazy) return e.fullSrc; // the browser loads it when the screen shows it
    if (!e || !e.image) return '';
    if (!e.url) e.url = e.placeholder ? e.image.toDataURL() : e.fullSrc;
    return e.url;
  }

  /** Makes sure an image loaded on demand is ready (see LAZY_KINDS). */
  async ensure(id) {
    const e = this.entries.get(id);
    if (!e || !e.lazy) return;
    if (!e.loading) {
      e.loading = loadImage(e.fullSrc).then((img) => {
        e.image = img || makePlaceholder(e);
        e.placeholder = !img;
        e.url = img ? e.fullSrc : '';
        e.lazy = false;
      });
    }
    await e.loading;
  }

  json(path) {
    return this.data.get(path);
  }

  /** Loads a content JSON on demand (e.g. a map) and keeps it for next time. */
  async loadJSON(path) {
    if (!this.data.has(path)) this.data.set(path, await loadJSON(`content/${path}`));
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
      // big images used by one chapter only (map backgrounds, puzzles): loaded when needed
      if (LAZY_KINDS.has(asset.kind) && !asset.pending) {
        this.entries.set(asset.id, { ...asset, fullSrc, image: null, placeholder: false, lazy: true, url: fullSrc });
        tick();
        return;
      }
      // art still being drawn: do not even ask the server (no 404s, faster start)
      const img = asset.pending ? null : await loadImage(fullSrc);
      const entry = { ...asset, fullSrc, image: img, placeholder: !img, url: '' };
      if (!img) entry.image = makePlaceholder(asset);
      this.entries.set(asset.id, entry);
      tick();
    });

    await Promise.all([...jsonJobs, ...imageJobs]);
    this.tintPendingSheets();
    return this;
  }

  /**
   * Characters whose walking art has not arrived yet borrow the Peregrino's
   * sheet, tinted with the character's colour, so they still walk nicely.
   */
  tintPendingSheets() {
    const base = this.entries.get('sheet.peregrino');
    if (!base || !base.image || base.placeholder) return;
    for (const e of this.entries.values()) {
      if (!e || e.kind !== 'sheet' || !e.placeholder || !e.pending) continue;
      const c = document.createElement('canvas');
      c.width = base.image.width;
      c.height = base.image.height;
      const ctx = c.getContext('2d');
      ctx.drawImage(base.image, 0, 0);
      ctx.globalCompositeOperation = 'source-atop';
      ctx.globalAlpha = 0.45;
      ctx.fillStyle = e.color || '#ffffff';
      ctx.fillRect(0, 0, c.width, c.height);
      Object.assign(e, { image: c, frame: base.frame, cols: base.cols, rows: base.rows, anim: base.anim, url: '' });
    }
  }
}
