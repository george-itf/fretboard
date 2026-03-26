// ─── localStorage Persistence ───
//
// SSR-safe, error-tolerant. Loads on mount, saves on change.

import type { PersistentStats } from '@/types.ts';

const STORAGE_KEY = 'fretboard-trainer-stats';

const EMPTY: PersistentStats = {
  highScore: 0,
  bestStreak: 0,
  bestTime: 0,
  totalRounds: 0,
  lastPlayed: '',
};

export function loadStats(): PersistentStats {
  if (typeof window === 'undefined') return { ...EMPTY };
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored) as PersistentStats;
  } catch (e) {
    console.error('Failed to load stats:', e);
  }
  return { ...EMPTY };
}

export function saveStats(stats: PersistentStats): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  } catch (e) {
    console.error('Failed to save stats:', e);
  }
}
