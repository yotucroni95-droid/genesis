// Saves the player's progress on this phone (localStorage). No login, no server.
// Every change is written immediately, and writing the same thing twice is harmless.

const KEY = 'genesis.save.v1';

function emptySave() {
  const now = new Date().toISOString();
  return {
    version: 1,
    nick: '',
    avatarId: 'peregrino',
    level: 1,
    progress: {},      // stopId -> { completedAt, score }
    unlocked: { peregrino: now }, // characterId -> unlockedAt
    achievements: {},  // achievementId -> earnedAt
    createdAt: now,
    lastSeen: now,
  };
}

/** Nickname rules: 3 to 16 letters (no accents), numbers or "_". */
export const NICK_RULE = /^[A-Za-z0-9_]{3,16}$/;

export function sanitizeNick(raw) {
  return String(raw || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // remove accents: João -> Joao
    .replace(/\s+/g, '_')
    .replace(/[^A-Za-z0-9_]/g, '')
    .slice(0, 16);
}

export class SaveManager {
  constructor() {
    this.storageOk = true;
    this.state = this.read();
    this.touch();
    // Ask the browser to keep our data even when the phone is low on space.
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  }

  read() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return emptySave();
      const data = JSON.parse(raw);
      return { ...emptySave(), ...data, unlocked: { peregrino: data.createdAt, ...(data.unlocked || {}) } };
    } catch {
      this.storageOk = false;
      return emptySave();
    }
  }

  write() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.state));
      this.storageOk = true;
    } catch {
      this.storageOk = false; // private mode or storage blocked: keeps working in memory
    }
  }

  touch() {
    this.state.lastSeen = new Date().toISOString();
    this.write();
  }

  get hasNick() { return Boolean(this.state.nick); }

  setNick(nick) {
    const clean = sanitizeNick(nick);
    if (!NICK_RULE.test(clean)) return false;
    this.state.nick = clean;
    this.write();
    return true;
  }

  setAvatar(characterId) {
    if (!this.state.unlocked[characterId]) return false;
    this.state.avatarId = characterId;
    this.write();
    return true;
  }

  isUnlocked(characterId) { return Boolean(this.state.unlocked[characterId]); }

  unlock(characterId) {
    if (this.state.unlocked[characterId]) return false;
    this.state.unlocked[characterId] = new Date().toISOString();
    this.write();
    return true;
  }

  isStopDone(stopId) { return Boolean(this.state.progress[stopId]); }

  /** Records a finished stop. Keeps the best score if played again. */
  completeStop(stopId, score = 0) {
    const prev = this.state.progress[stopId];
    if (prev && prev.score >= score) return false;
    this.state.progress[stopId] = { completedAt: prev ? prev.completedAt : new Date().toISOString(), score };
    this.write();
    return !prev;
  }

  earn(achievementId) {
    if (this.state.achievements[achievementId]) return false;
    this.state.achievements[achievementId] = new Date().toISOString();
    this.write();
    return true;
  }

  setLevel(level) {
    if (level <= this.state.level) return false;
    this.state.level = level;
    this.write();
    return true;
  }
}
