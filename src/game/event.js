// Special events, like the Acampamento dos Desbravadores e Aventureiros.
// An event chapter is a trail: its stops open one at a time, and the next one
// only appears after 3 stars on the current one. It is open only between the
// dates in chapters/index.json ("window": { "start": "AAAA-MM-DD", "end": ... }),
// and only after the chapter before it (the end of Gênesis) is finished.
// Characters of the event come only from here (stop.unlockChar, with 3 stars).

const isOwner = () => { try { return localStorage.getItem('genesis.owner') === '1'; } catch { return false; } };
const day = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const shortDate = (s) => day(s).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

/** { open, before, after } for the event dates. The game's owner can always enter (to test). */
export function eventWindow(entry, now = new Date()) {
  const w = entry.window || {};
  const before = w.start ? now < day(w.start) : false;
  const after = w.end ? now >= new Date(day(w.end).getTime() + 86400000) : false; // the end day still counts
  return { open: isOwner() || (!before && !after), before, after, start: w.start, end: w.end };
}

/** In an event, a stop is shown only when the one before it has 3 stars. */
export function stopVisible(save, chapter, stopId) {
  if (!chapter || !chapter.event) return true;
  const i = chapter.stops.findIndex((s) => s.id === stopId);
  if (i <= 0) return true;
  return ((save.state.stars || {})[chapter.stops[i - 1].id] || 0) >= 3;
}

/** Challenges of the event cleared with 3 stars. */
export function eventProgress(save, chapter) {
  const stars = save.state.stars || {};
  return chapter.stops.filter((s) => (stars[s.id] || 0) >= 3).length;
}

/** After a challenge: 3 stars at the end of a trail gives that trail's character. */
export function eventUnlocks(save, chapter, stop, stars) {
  if (!chapter.event || stars < 3 || !stop.unlockChar) return [];
  return save.unlock(stop.unlockChar) ? [{ type: 'unlock', id: stop.unlockChar }] : [];
}
