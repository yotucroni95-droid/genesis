// Game rules that turn a finished stop into rewards: first-step medal,
// chapter medal, level up and unlocked characters. All data comes from the
// chapter JSON, so new books need no code changes.

export async function loadChapterIndex(assets) {
  return assets.json('chapters/index.json').chapters;
}

export async function loadChapter(assets, entry) {
  try {
    return await assets.loadJSON(entry.file);
  } catch {
    return null; // chapter file not written yet
  }
}

export function chapterDone(save, chapter) {
  return chapter.stops.every((s) => save.isStopDone(s.id));
}

export function chapterProgress(save, chapter) {
  const done = chapter.stops.filter((s) => save.isStopDone(s.id)).length;
  return { done, total: chapter.stops.length };
}

/** Chapter n is open when chapter n-1 is finished. */
export function isChapterOpen(save, index, loadedChapters, entries = []) {
  // chapters whose map is still being drawn are skipped, so they never block the next ones
  // events (like the Acampamento) never block the story chapters after them
  let k = index - 1;
  const skip = (e) => e && (e.waitingMap || (e.event && !(entries[index] || {}).event));
  while (k >= 0 && skip(entries[k])) k -= 1;
  if (k < 0) return true;
  const prev = loadedChapters[k];
  return Boolean(prev && chapterDone(save, prev));
}

/**
 * Records a finished stop and returns what the player just earned,
 * so the game can celebrate it.
 */
export function completeStop(save, chapter, stop, score) {
  const events = [];
  const wasChapterDone = chapterDone(save, chapter);
  const isNew = save.completeStop(stop.id, score);
  if (isNew && save.earn('primeiros_passos')) events.push({ type: 'medal', id: 'primeiros_passos' });
  if (!wasChapterDone && chapterDone(save, chapter)) {
    events.push({ type: 'chapter', id: chapter.id, title: chapter.title });
    if (chapter.medal && save.earn(chapter.medal)) events.push({ type: 'medal', id: chapter.medal });
    for (const id of chapter.unlocks || []) {
      if (save.unlock(id)) events.push({ type: 'unlock', id });
    }
    const level = save.state.level + 1;
    if (save.setLevel(level)) events.push({ type: 'level', level });
  }
  return events;
}
