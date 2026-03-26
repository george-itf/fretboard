// ─── Music Theory & Fretboard Helpers ───
//
// Pure functions. No React, no state, no side effects.

import { ALL_NOTES } from '@/types.ts';

const OPEN_STRING_INDEX: Record<string, number> = {
  E: 4, A: 9, D: 2, G: 7,
};

const STRING_ORDER = ['E', 'A', 'D', 'G'] as const;

/** Note at a given string and fret position */
export function noteAt(stringName: string, fret: number): string {
  const openIndex = OPEN_STRING_INDEX[stringName] ?? 0;
  return ALL_NOTES[(openIndex + fret) % 12];
}

/** Display note with proper sharp symbol (bug fix: was a no-op) */
export function displayNote(note: string): string {
  return note.replace('#', '\u266F');
}

/** Canonical cell key — single source of truth */
export function cellKey(s: string, f: number): string {
  return `${s}:${f}`;
}

/** Parse a cell key back into components */
export function parseKey(key: string): { string: string; fret: number } {
  const [s, f] = key.split(':');
  return { string: s, fret: parseInt(f, 10) };
}

/** Get ordered active strings (reversed: low E at top on screen) */
export function getActiveStrings(numStrings: number): string[] {
  const ordered = STRING_ORDER.slice(0, numStrings);
  return [...ordered].reverse();
}

/** Count how many positions a note appears on the active fretboard */
export function countPositions(note: string, activeStrings: string[], maxFret: number): number {
  let count = 0;
  for (const s of activeStrings) {
    for (let f = 0; f <= maxFret; f++) {
      if (noteAt(s, f) === note) count++;
    }
  }
  return count;
}

/** Fisher-Yates shuffle */
export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Pick a target note with weighted selection toward missed notes.
 * Notes that have been missed get 1.5x selection weight.
 * Previous target excluded to avoid repeats.
 */
export function pickNote(
  activeStrings: string[],
  maxFret: number,
  lastNote: string,
  missedNotes: Map<string, number>,
): string {
  const noteSet = new Set<string>();
  for (const s of activeStrings) {
    for (let f = 0; f <= maxFret; f++) {
      noteSet.add(noteAt(s, f));
    }
  }
  const available = Array.from(noteSet);
  const choices = available.filter(n => n !== lastNote);
  if (!choices.length) return available[0] ?? 'A';

  if (missedNotes.size >= 2) {
    const weights = choices.map(note => {
      const missCount = missedNotes.get(note) || 0;
      return missCount > 0 ? 1.5 : 1;
    });
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    let random = Math.random() * totalWeight;
    for (let i = 0; i < choices.length; i++) {
      random -= weights[i];
      if (random <= 0) return choices[i];
    }
  }

  return choices[Math.floor(Math.random() * choices.length)];
}

/**
 * Generate plausible wrong answers for identify/name mode.
 * Neighboring semitones come first (most plausible if you miscounted frets).
 */
export function generateNameChoices(
  correctNote: string,
  numChoices: number,
  stringName: string,
  fret: number,
  maxFret: number,
): string[] {
  const choices = new Set([correctNote]);

  for (let df = -2; df <= 2; df++) {
    if (df === 0) continue;
    const f = fret + df;
    if (f >= 0 && f <= maxFret) {
      const n = noteAt(stringName, f);
      if (n !== correctNote) choices.add(n);
    }
    if (choices.size >= numChoices) break;
  }

  const remaining = shuffle([...ALL_NOTES].filter(n => !choices.has(n)));
  for (const n of remaining) {
    if (choices.size >= numChoices) break;
    choices.add(n);
  }

  return shuffle(Array.from(choices)).slice(0, numChoices);
}

/**
 * Generate selectable fret positions for identify/find mode.
 * Always includes all correct frets. Fills with random incorrect frets.
 * Result sorted numerically.
 */
export function generateFindChoices(
  correctFrets: number[],
  numChoices: number,
  maxFret: number,
): number[] {
  const cap = Math.min(numChoices, maxFret + 1);
  const choices = new Set(correctFrets);

  const available: number[] = [];
  for (let f = 0; f <= maxFret; f++) {
    if (!choices.has(f)) available.push(f);
  }

  const shuffled = shuffle(available);
  const needed = cap - choices.size;
  for (let i = 0; i < needed && i < shuffled.length; i++) {
    choices.add(shuffled[i]);
  }

  return Array.from(choices).sort((a, b) => a - b);
}
