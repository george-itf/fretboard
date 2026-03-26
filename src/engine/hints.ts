// ─── Deterministic Hint Placement ───
//
// Seeded XORshift32 PRNG + Fisher-Yates partial shuffle.
// Same roundKey always produces the same hint positions.

import type { NoteState } from '@/types.ts';
import { noteAt, cellKey } from './music.ts';

export function computeHints(
  baseCells: Map<string, NoteState>,
  hintPct: number,
  roundKey: number,
  activeStrings: string[],
  maxFret: number,
  targetNote: string,
): Map<string, NoteState> {
  if (hintPct === 0) return baseCells;

  // Seeded XORshift32
  let seed = (roundKey * 2654435761) >>> 0;
  const nextRand = () => {
    seed = (seed ^ (seed << 13)) >>> 0;
    seed = (seed ^ (seed >> 17)) >>> 0;
    seed = (seed ^ (seed << 5)) >>> 0;
    return (seed >>> 0) / 4294967296;
  };

  const merged = new Map(baseCells);
  const candidates: string[] = [];

  for (const s of activeStrings) {
    for (let f = 0; f <= maxFret; f++) {
      const key = cellKey(s, f);
      if (noteAt(s, f) !== targetNote && !merged.has(key)) {
        candidates.push(key);
      }
    }
  }

  // Fisher-Yates partial shuffle: pick numHints from candidates
  const numHints = Math.round(candidates.length * hintPct / 100);
  for (let i = 0; i < numHints && i < candidates.length; i++) {
    const j = i + Math.floor(nextRand() * (candidates.length - i));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    merged.set(candidates[i], 'hint');
  }

  return merged;
}
