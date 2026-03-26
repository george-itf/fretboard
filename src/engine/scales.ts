// ─── Scale Engine ───
//
// Scale definitions, degree mapping, color assignment.
// Pure functions. No React, no audio, no state.

import { ALL_NOTES } from '@/types.ts';
import type { DegreeInfo, ScaleType } from '@/types.ts';
import { noteAt, cellKey, shuffle } from './music.ts';

// ─── Scale Intervals (semitones from root) ───

const SCALE_INTERVALS: Record<ScaleType, number[]> = {
  'major':            [0, 2, 4, 5, 7, 9, 11],
  'natural-minor':    [0, 2, 3, 5, 7, 8, 10],
  'minor-pentatonic': [0, 3, 5, 7, 10],
  'major-pentatonic': [0, 2, 4, 7, 9],
  'blues':            [0, 3, 5, 6, 7, 10],
};

// ─── Interval → Degree Label ───

const INTERVAL_TO_DEGREE: Record<number, string> = {
  0: 'R', 1: 'b2', 2: '2', 3: 'b3', 4: '3', 5: '4',
  6: 'b5', 7: '5', 8: 'b6', 9: '6', 10: 'b7', 11: '7',
};

// ─── Degree Colors ───
//
// Root = gold (anchor). 3rd/b3 = blue (defines major/minor quality).
// 5th = green (power note). 7th/b7 = warm red (tension/resolution).
// b5 = purple (blue note). Others = neutral warm.

const DEGREE_COLORS: Record<string, string> = {
  'R':  'hsl(42, 90%, 58%)',
  '2':  'hsl(32, 45%, 58%)',
  'b2': 'hsl(32, 45%, 58%)',
  '3':  'hsl(215, 65%, 64%)',
  'b3': 'hsl(215, 65%, 64%)',
  '4':  'hsl(175, 50%, 52%)',
  'b5': 'hsl(275, 50%, 62%)',
  '5':  'hsl(150, 55%, 50%)',
  'b6': 'hsl(32, 45%, 58%)',
  '6':  'hsl(32, 45%, 58%)',
  'b7': 'hsl(12, 65%, 58%)',
  '7':  'hsl(12, 65%, 58%)',
};

// ─── Public API ───

export function getScaleIntervals(type: ScaleType): number[] {
  return SCALE_INTERVALS[type];
}

/** Degree labels for every note in a scale (e.g. ['R','2','3','4','5','6','7']) */
export function getScaleDegreeLabels(type: ScaleType): string[] {
  return SCALE_INTERVALS[type].map(i => INTERVAL_TO_DEGREE[i]);
}

export function scaleDisplayName(type: ScaleType): string {
  const names: Record<ScaleType, string> = {
    'major': 'Major',
    'natural-minor': 'Natural Minor',
    'minor-pentatonic': 'Minor Pentatonic',
    'major-pentatonic': 'Major Pentatonic',
    'blues': 'Blues',
  };
  return names[type];
}

export function degreeColor(label: string): string {
  return DEGREE_COLORS[label] || 'hsl(32, 30%, 55%)';
}

/**
 * Build a map of every fretboard position that falls in the given scale.
 * Key = cellKey, Value = degree info (label, color, semitone offset).
 */
export function computeScaleMap(
  root: string,
  scaleType: ScaleType,
  activeStrings: string[],
  maxFret: number,
): Map<string, DegreeInfo> {
  const rootIndex = ALL_NOTES.indexOf(root as (typeof ALL_NOTES)[number]);
  if (rootIndex === -1) return new Map();

  const intervals = SCALE_INTERVALS[scaleType];

  // noteIndex (0-11) → interval from root
  const noteToInterval = new Map<number, number>();
  for (const interval of intervals) {
    noteToInterval.set((rootIndex + interval) % 12, interval);
  }

  const result = new Map<string, DegreeInfo>();

  for (const s of activeStrings) {
    for (let f = 0; f <= maxFret; f++) {
      const note = noteAt(s, f);
      const noteIndex = ALL_NOTES.indexOf(note as (typeof ALL_NOTES)[number]);
      const interval = noteToInterval.get(noteIndex);
      if (interval !== undefined) {
        const label = INTERVAL_TO_DEGREE[interval];
        result.set(cellKey(s, f), {
          label,
          color: DEGREE_COLORS[label] || 'hsl(32, 30%, 55%)',
          semitone: interval,
        });
      }
    }
  }

  return result;
}

/** Count how many positions a specific degree occupies */
export function countDegreePositions(
  degreeLabel: string,
  scaleMap: Map<string, DegreeInfo>,
): number {
  let count = 0;
  for (const info of scaleMap.values()) {
    if (info.label === degreeLabel) count++;
  }
  return count;
}

/** Get all cell keys that have a specific degree */
export function getDegreePositions(
  degreeLabel: string,
  scaleMap: Map<string, DegreeInfo>,
): string[] {
  const positions: string[] = [];
  for (const [key, info] of scaleMap.entries()) {
    if (info.label === degreeLabel) positions.push(key);
  }
  return positions;
}

/**
 * Pick a target degree for the degree game.
 * Avoids the previous target. Ensures at least 2 positions exist.
 */
export function pickTargetDegree(
  scaleType: ScaleType,
  scaleMap: Map<string, DegreeInfo>,
  lastDegree: string,
): string {
  const labels = getScaleDegreeLabels(scaleType);
  // Only pick degrees with 2+ positions on the current fretboard
  const viable = labels.filter(
    l => l !== lastDegree && countDegreePositions(l, scaleMap) >= 2,
  );
  if (!viable.length) {
    // Fallback: allow any degree except last
    const any = labels.filter(l => l !== lastDegree);
    return any[Math.floor(Math.random() * any.length)] || labels[0];
  }
  return viable[Math.floor(Math.random() * viable.length)];
}

/**
 * Generate degree choices for name-degree phase.
 * Includes the correct degree + plausible wrong answers from the scale.
 */
export function generateDegreeChoices(
  correctDegree: string,
  scaleType: ScaleType,
): string[] {
  const labels = getScaleDegreeLabels(scaleType);
  // For pentatonic (5 degrees), show all. For 6-7 degree scales, show all too.
  // The difficulty comes from the scale itself.
  return shuffle([...labels]);
}
