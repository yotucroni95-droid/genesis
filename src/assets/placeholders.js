// Generates colored placeholder images for any asset whose file is missing.
// When the real PNG is added to /assets, the loader uses it instead.

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  return { c, ctx };
}

function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const clamp = (v) => Math.max(0, Math.min(255, v));
  const r = clamp((n >> 16) + amount);
  const g = clamp(((n >> 8) & 255) + amount);
  const b = clamp((n & 255) + amount);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

function initials(label) {
  const words = label.replace(/^(Arcanjo)\s+/i, '').split(/\s+/);
  return words.length > 1 ? (words[0][0] + words[1][0]).toUpperCase() : label.slice(0, 2).toUpperCase();
}

function text(ctx, str, x, y, size, color, align = 'center') {
  ctx.font = `bold ${size}px system-ui, sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
}

// Sprite sheet: walking frames (columns) x 4 directions (rows: down, left, right, up).
// Real sheets may have 3 or 4 columns; the manifest's `anim` says which to play.
function sheet(a) {
  const f = a.frame || 32;
  const { c, ctx } = canvas(f * 3, f * 4);
  const body = a.color;
  const dark = shade(body, -50);
  const skin = '#f1c9a0';
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 3; col++) {
      const ox = col * f;
      const oy = row * f;
      const step = col === 1 ? 0 : col === 0 ? -2 : 2;
      // shadow
      ctx.fillStyle = 'rgba(0,0,0,.25)';
      ctx.fillRect(ox + 9, oy + 28, 14, 3);
      // legs
      ctx.fillStyle = dark;
      ctx.fillRect(ox + 11 + step, oy + 22, 4, 7);
      ctx.fillRect(ox + 17 - step, oy + 22, 4, 7);
      // body
      ctx.fillStyle = body;
      ctx.fillRect(ox + 9, oy + 13, 14, 11);
      // head
      ctx.fillStyle = skin;
      ctx.fillRect(ox + 10, oy + 3, 12, 11);
      ctx.fillStyle = dark;
      ctx.fillRect(ox + 10, oy + 2, 12, 3);
      // eyes show the facing direction
      ctx.fillStyle = '#1b1430';
      if (row === 0) { ctx.fillRect(ox + 12, oy + 8, 2, 2); ctx.fillRect(ox + 18, oy + 8, 2, 2); }
      if (row === 1) { ctx.fillRect(ox + 11, oy + 8, 2, 2); }
      if (row === 2) { ctx.fillRect(ox + 19, oy + 8, 2, 2); }
      if (row === 3) { ctx.fillStyle = dark; ctx.fillRect(ox + 10, oy + 3, 12, 8); }
    }
  }
  return c;
}

function portrait(a) {
  const { c, ctx } = canvas(a.w, a.h);
  const g = ctx.createLinearGradient(0, 0, 0, a.h);
  g.addColorStop(0, shade(a.color, 40));
  g.addColorStop(1, shade(a.color, -60));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, a.w, a.h);
  ctx.fillStyle = 'rgba(0,0,0,.25)';
  ctx.fillRect(16, 36, 32, 28);
  ctx.fillStyle = '#f1c9a0';
  ctx.fillRect(20, 12, 24, 24);
  text(ctx, initials(a.label), 32, 50, 14, '#fff');
  ctx.strokeStyle = 'rgba(255,255,255,.6)';
  ctx.strokeRect(0.5, 0.5, a.w - 1, a.h - 1);
  return c;
}

function tiles(a) {
  const f = a.frame || 32;
  const cols = a.cols || 8;
  const rows = a.rows || 8;
  const { c, ctx } = canvas(cols * f, rows * f);
  const pal = a.palette && a.palette.length ? a.palette : [a.color];
  for (let i = 0; i < cols * rows; i++) {
    const x = (i % cols) * f;
    const y = Math.floor(i / cols) * f;
    const base = pal[i % pal.length];
    ctx.fillStyle = base;
    ctx.fillRect(x, y, f, f);
    ctx.fillStyle = shade(base, 18);
    ctx.fillRect(x + 4, y + 6, 3, 2);
    ctx.fillRect(x + 20, y + 18, 3, 2);
    ctx.fillStyle = shade(base, -22);
    ctx.fillRect(x, y + f - 1, f, 1);
    ctx.fillRect(x + f - 1, y, 1, f);
    text(ctx, String(i), x + f / 2, y + f / 2, 9, 'rgba(255,255,255,.55)');
  }
  return c;
}

function icon(a) {
  const { c, ctx } = canvas(a.w, a.h);
  ctx.fillStyle = shade(a.color, -40);
  ctx.fillRect(2, 2, a.w - 4, a.h - 4);
  ctx.fillStyle = a.color;
  ctx.fillRect(4, 4, a.w - 8, a.h - 8);
  text(ctx, a.glyph || initials(a.label), a.w / 2, a.h / 2 + 1, 16, '#1b1430');
  return c;
}

function medal(a) {
  const { c, ctx } = canvas(a.w, a.h);
  const cx = a.w / 2;
  const cy = a.h / 2;
  ctx.fillStyle = '#c0392b';
  ctx.fillRect(cx - 12, 0, 8, 22);
  ctx.fillStyle = '#2b5fc0';
  ctx.fillRect(cx + 4, 0, 8, 22);
  ctx.beginPath();
  ctx.arc(cx, cy + 6, 24, 0, Math.PI * 2);
  ctx.fillStyle = shade(a.color, -50);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy + 6, 20, 0, Math.PI * 2);
  ctx.fillStyle = a.color;
  ctx.fill();
  text(ctx, initials(a.label), cx, cy + 7, 14, '#1b1430');
  return c;
}

function generic(a) {
  const w = a.w || 32;
  const h = a.h || 32;
  const { c, ctx } = canvas(w, h);
  if (a.cols && a.frame) {
    // multi-frame strip, e.g. the glowing stop marker
    for (let i = 0; i < a.cols; i++) {
      const x = i * a.frame + a.frame / 2;
      const r = 6 + i * 2;
      const g = ctx.createRadialGradient(x, a.frame / 2, 1, x, a.frame / 2, r + 6);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.4, a.color);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(i * a.frame, 0, a.frame, a.frame);
    }
    return c;
  }
  ctx.globalAlpha = a.id.startsWith('ui.joystick') ? 0.35 : 1;
  ctx.fillStyle = a.color;
  if (a.id.startsWith('ui.joystick')) {
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, w / 2 - 1, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = shade(a.color, 60);
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, w - 2, h - 2);
  }
  ctx.globalAlpha = 1;
  return c;
}

function puzzle(a) {
  const { c, ctx } = canvas(a.w, a.h);
  const g = ctx.createLinearGradient(0, 0, a.w, a.h);
  g.addColorStop(0, shade(a.color, 70));
  g.addColorStop(1, shade(a.color, -70));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, a.w, a.h);
  // Distinct shapes so each 3x3 piece is recognisable.
  ctx.fillStyle = '#ffd36e';
  ctx.beginPath();
  ctx.arc(a.w * 0.75, a.h * 0.25, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.85)';
  ctx.fillRect(16, a.h * 0.62, a.w - 32, 18);
  ctx.fillStyle = 'rgba(0,0,0,.3)';
  ctx.beginPath();
  ctx.moveTo(0, a.h);
  ctx.lineTo(a.w * 0.35, a.h * 0.45);
  ctx.lineTo(a.w * 0.7, a.h);
  ctx.fill();
  text(ctx, a.label, a.w / 2, a.h * 0.66 + 1, 13, '#1b1430');
  return c;
}

const BUILDERS = { sheet, portrait, tiles, icon, medal, puzzle, ui: generic, logo: generic };

/** Returns a canvas for the asset, or null for optional assets with no placeholder. */
export function makePlaceholder(asset) {
  if (asset.optional) return null;
  const build = BUILDERS[asset.kind] || generic;
  return build(asset);
}
