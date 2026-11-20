// Dev tool (not loaded by the game): checks the current screen for buttons
// that overlap, stick out of the screen, or have their text cut off.
// Use in the browser console: (await import('/tools/layout_audit.js')).audit()

const VISIBLE = (el) => {
  const s = getComputedStyle(el);
  if (s.visibility === 'hidden' || s.display === 'none' || Number(s.opacity) === 0) return false;
  const r = el.getBoundingClientRect();
  return r.width > 2 && r.height > 2;
};

// the part of a box that can really be seen (inside every scrolling/clipping parent)
function visibleRect(el) {
  let r = el.getBoundingClientRect();
  let box = { l: r.left, t: r.top, r: r.right, b: r.bottom };
  for (let p = el.parentElement; p; p = p.parentElement) {
    const s = getComputedStyle(p);
    if (/(auto|scroll|hidden|clip)/.test(s.overflow + s.overflowX + s.overflowY)) {
      const q = p.getBoundingClientRect();
      box = { l: Math.max(box.l, q.left), t: Math.max(box.t, q.top), r: Math.min(box.r, q.right), b: Math.min(box.b, q.bottom) };
    }
  }
  return box;
}

const inScroller = (el) => { for (let p = el.parentElement; p; p = p.parentElement) { if (/(auto|scroll)/.test(getComputedStyle(p).overflowX)) return true; } return false; };
const label = (el) => (el.innerText || el.getAttribute('aria-label') || el.className || el.tagName).replace(/\s+/g, ' ').trim().slice(0, 30);

export function audit(root = document.getElementById('ui')) {
  const W = innerWidth; const H = innerHeight;
  const problems = [];
  const btns = [...root.querySelectorAll('button, .btn, input, .lobby__btn, .tag, h1, h2, h3')].filter(VISIBLE)
    .filter((el) => !el.closest('.modal') || root.querySelector('.modal'));
  // 1) sticks out of the screen sideways (vertical is fine when the page scrolls)
  for (const el of btns) {
    const r = el.getBoundingClientRect();
    if (inScroller(el)) continue;
    if (r.left < -1 || r.right > W + 1) problems.push(`fora da tela: "${label(el)}" (${Math.round(r.left)}–${Math.round(r.right)} de ${W})`);
  }
  // 1b) cut at the bottom of a screen that does not scroll
  const scrollsY = (el) => { for (let p = el.parentElement; p; p = p.parentElement) { if (/(auto|scroll)/.test(getComputedStyle(p).overflowY) && p.scrollHeight > p.clientHeight) return true; } return false; };
  for (const el of btns) {
    const r = el.getBoundingClientRect();
    if (r.bottom > H + 1 && !scrollsY(el) && document.scrollingElement.scrollHeight <= H + 1) problems.push(`cortado embaixo: "${label(el)}" (${Math.round(r.bottom)} de ${H})`);
  }
  // 2) text cut inside a button or title
  for (const el of btns) {
    if (el.tagName === 'INPUT') continue;
    if (el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).overflowX !== 'visible') problems.push(`texto cortado: "${label(el)}"`);
  }
  // 3) buttons on top of each other (only where both can really be seen)
  const tap = btns.filter((el) => el.matches('button, .btn, input, .lobby__btn'));
  for (let i = 0; i < tap.length; i++) {
    for (let j = i + 1; j < tap.length; j++) {
      const a = tap[i]; const b = tap[j];
      if (a.contains(b) || b.contains(a)) continue;
      const A = visibleRect(a); const B = visibleRect(b);
      if (A.r <= A.l || A.b <= A.t || B.r <= B.l || B.b <= B.t) continue;
      const w = Math.min(A.r, B.r) - Math.max(A.l, B.l); const hgt = Math.min(A.b, B.b) - Math.max(A.t, B.t);
      if (w > 3 && hgt > 3) problems.push(`sobrepostos: "${label(a)}" × "${label(b)}" (${Math.round(w)}x${Math.round(hgt)}px)`);
    }
  }
  // 4) page wider than the screen
  const sc = document.scrollingElement;
  if (sc.scrollWidth > W + 1) problems.push(`página mais larga que a tela (${sc.scrollWidth} > ${W})`);
  return [...new Set(problems)];
}
