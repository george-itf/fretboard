import { useState, useCallback, useRef, useEffect } from 'react';

// Standard bass tuning: open string note indices in chromatic scale
// C=0, C#=1, D=2, D#=3, E=4, F=5, F#=6, G=7, G#=8, A=9, A#=10, B=11
const ALL_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;
const NATURAL_NOTES = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;
// Sharps only - no flats

// Open string pitches (index in ALL_NOTES)
const OPEN_STRING_INDEX: Record<string, number> = {
  'E': 4,
  'A': 9,
  'D': 2,
  'G': 7,
};

// Strings ordered bottom-up (thickest first), displayed top-down reversed
const ALL_STRINGS = ['E', 'A', 'D', 'G'] as const;

export type NoteState = 'hidden' | 'correct' | 'wrong' | 'revealed' | 'hint';

export interface CellState {
  string: string;
  fret: number;
  note: string;
  state: NoteState;
  key: string;
}

export interface GameState {
  targetNote: string;
  targetDisplay: string;
  numStrings: number;
  maxFret: number;
  includeSharps: boolean;
  score: number;
  streak: number;
  bestStreak: number;
  misses: number;
  found: number;
  total: number;
  roundComplete: boolean;
  activeStrings: string[];
  roundKey: number;
  mode: 'game' | 'learn' | 'practice';
  roundTime: number;
  bestTime: number;
  highScore: number;
  totalRounds: number;
  roundMisses: number;
  roundStartTime: number;
}

interface PersistentStats {
  highScore: number;
  bestStreak: number;
  bestTime: number;
  totalRounds: number;
  lastPlayed: string;
}

export function noteAt(stringName: string, fret: number): string {
  const openIndex = OPEN_STRING_INDEX[stringName];
  return ALL_NOTES[(openIndex + fret) % 12];
}

export function displayNote(note: string): string {
  return note;
}

function getActiveStrings(numStrings: number): string[] {
  // E first, then add A, D, G
  const ordered = ALL_STRINGS.slice(0, numStrings);
  // Display: thinnest on top → reverse so G is top when all 4
  return [...ordered].reverse();
}

function pickNote(
  activeStrings: string[],
  maxFret: number,
  includeSharps: boolean,
  lastNote: string,
  missedNotes?: Map<string, number>
): string {
  const pool = includeSharps ? [...ALL_NOTES] : [...NATURAL_NOTES];

  // Filter to notes that exist on the current fretboard
  const available = pool.filter(note => {
    for (const s of activeStrings) {
      for (let f = 0; f <= maxFret; f++) {
        if (noteAt(s, f) === note) return true;
      }
    }
    return false;
  });

  const choices = available.filter(n => n !== lastNote);

  if (!choices.length) {
    return available[0];
  }

  // Mild weighting: missed notes get a small bump (1.5x), not enough to dominate
  // Only apply if at least 5 notes have been seen to avoid early-session skew
  if (missedNotes && missedNotes.size >= 2) {
    const weights = choices.map(note => {
      const missCount = missedNotes.get(note) || 0;
      // Cap at 1.5x so missed notes get a nudge, not a takeover
      return missCount > 0 ? 1.5 : 1;
    });

    const totalWeight = weights.reduce((a, b) => a + b, 0);
    let random = Math.random() * totalWeight;

    for (let i = 0; i < choices.length; i++) {
      random -= weights[i];
      if (random <= 0) {
        return choices[i];
      }
    }
  }

  return choices[Math.floor(Math.random() * choices.length)];
}

function countPositions(note: string, activeStrings: string[], maxFret: number): number {
  let count = 0;
  for (const s of activeStrings) {
    for (let f = 0; f <= maxFret; f++) {
      if (noteAt(s, f) === note) count++;
    }
  }
  return count;
}

function loadPersistentStats(): PersistentStats {
  if (typeof window === 'undefined') {
    return { highScore: 0, bestStreak: 0, bestTime: 0, totalRounds: 0, lastPlayed: '' };
  }

  try {
    const stored = localStorage.getItem('fretboard-trainer-stats');
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Failed to load persistent stats:', e);
  }

  return { highScore: 0, bestStreak: 0, bestTime: 0, totalRounds: 0, lastPlayed: '' };
}

function savePersistentStats(stats: PersistentStats): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem('fretboard-trainer-stats', JSON.stringify(stats));
  } catch (e) {
    console.error('Failed to save persistent stats:', e);
  }
}

export function useGame() {
  const [numStrings, setNumStrings] = useState(4);
  const [maxFret, setMaxFret] = useState(12);
  const [includeSharps] = useState(true);
  const [targetNote, setTargetNote] = useState('A');
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [misses, setMisses] = useState(0);
  const [foundSet, setFoundSet] = useState<Set<string>>(new Set());
  const [total, setTotal] = useState(0);
  const [roundComplete, setRoundComplete] = useState(false);
  const [cellStates, setCellStates] = useState<Map<string, NoteState>>(new Map());
  const [roundKey, setRoundKey] = useState(0);
  const [mode, setMode] = useState<'game' | 'learn' | 'practice'>('game');
  const [roundTime, setRoundTime] = useState(0);
  const [bestTime, setBestTime] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [totalRounds, setTotalRounds] = useState(0);
  const [roundMisses, setRoundMisses] = useState(0);

  const streakRef = useRef(0);
  const roundStartTimeRef = useRef(0);
  const missedNotesRef = useRef<Map<string, number>>(new Map());

  // Load persistent stats on mount
  useEffect(() => {
    const stats = loadPersistentStats();
    setBestStreak(stats.bestStreak);
    setHighScore(stats.highScore);
    setBestTime(stats.bestTime);
    setTotalRounds(stats.totalRounds);
  }, []);

  // Save persistent stats whenever they change
  useEffect(() => {
    const stats: PersistentStats = {
      highScore,
      bestStreak,
      bestTime,
      totalRounds,
      lastPlayed: new Date().toISOString(),
    };
    savePersistentStats(stats);
  }, [highScore, bestStreak, bestTime, totalRounds]);

  const activeStrings = getActiveStrings(numStrings);

  const startRound = useCallback((
    strings?: number,
    frets?: number,
    sharps?: boolean,
    overrideMode?: 'game' | 'learn' | 'practice'
  ) => {
    const ns = strings ?? numStrings;
    const mf = frets ?? maxFret;
    const is = sharps ?? includeSharps;
    const as2 = getActiveStrings(ns);
    const currentMode = overrideMode ?? mode;

    if (currentMode === 'practice') {
      // Practice: reveal all notes, click to hear them
      setTargetNote('');
      setTotal(0);
      setFoundSet(new Set());
      setRoundComplete(false);
      setRoundMisses(0);

      const allNotes = new Map<string, NoteState>();
      for (const s of as2) {
        for (let f = 0; f <= mf; f++) {
          allNotes.set(`${s}:${f}`, 'revealed');
        }
      }
      setCellStates(allNotes);
      setRoundKey(prev => prev + 1);
    } else if (currentMode === 'learn') {
      // Learn: show only dot fret positions (3, 5, 7, 9, 12) as landmarks
      setTargetNote('');
      setTotal(0);
      setFoundSet(new Set());
      setRoundComplete(false);
      setRoundMisses(0);

      const DOT_FRETS = [3, 5, 7, 9, 12];
      const landmarkNotes = new Map<string, NoteState>();
      for (const s of as2) {
        // Also show open string (fret 0) as a reference point
        landmarkNotes.set(`${s}:0`, 'revealed');
        for (const f of DOT_FRETS) {
          if (f <= mf) {
            landmarkNotes.set(`${s}:${f}`, 'revealed');
          }
        }
      }
      setCellStates(landmarkNotes);
      setRoundKey(prev => prev + 1);
    } else {
      // Game: quiz mode - find all positions of a target note
      const note = pickNote(as2, mf, is, targetNote, missedNotesRef.current);
      const count = countPositions(note, as2, mf);

      setTargetNote(note);
      setTotal(count);
      setFoundSet(new Set());
      setRoundComplete(false);
      setCellStates(new Map());
      setRoundMisses(0);
      setRoundKey(prev => prev + 1);
      roundStartTimeRef.current = Date.now();
    }
  }, [numStrings, maxFret, includeSharps, targetNote, mode]);

  const handleClick = useCallback((string: string, fret: number) => {
    // In learn or practice mode, return the note info so the app can play the sound
    if (mode === 'learn' || mode === 'practice') {
      const clickedNote = noteAt(string, fret);
      return { correct: true, note: displayNote(clickedNote), learnMode: true, rawNote: clickedNote, string, fret };
    }

    if (roundComplete) return;

    const key = `${string}:${fret}`;
    const clickedNote = noteAt(string, fret);

    // Already found
    if (foundSet.has(key)) return;

    if (clickedNote === targetNote) {
      // Correct!
      const newFound = new Set(foundSet);
      newFound.add(key);
      setFoundSet(newFound);
      setScore(s => s + 1);
      const newStreak = streakRef.current + 1;
      streakRef.current = newStreak;
      setStreak(newStreak);
      setBestStreak(b => Math.max(b, newStreak));

      const newStates = new Map(cellStates);
      newStates.set(key, 'correct');
      setCellStates(newStates);

      // Check if round complete
      const as2 = getActiveStrings(numStrings);
      const totalCount = countPositions(targetNote, as2, maxFret);
      if (newFound.size >= totalCount) {
        setRoundComplete(true);

        // Calculate round time
        const elapsed = Date.now() - roundStartTimeRef.current;
        setRoundTime(elapsed);

        // Update bestTime if this is the best
        if (bestTime === 0 || elapsed < bestTime) {
          setBestTime(elapsed);
        }

        // Increment total rounds and update high score
        setTotalRounds(t => t + 1);
        if (score + 1 > highScore) {
          setHighScore(score + 1);
        }

        // Track missed notes: increment on miss, decrement on clean round (decay)
        if (roundMisses > 0) {
          const targetNoteCount = missedNotesRef.current.get(targetNote) || 0;
          missedNotesRef.current.set(targetNote, targetNoteCount + 1);
        } else {
          // Clean round - decay this note's miss count
          const current = missedNotesRef.current.get(targetNote) || 0;
          if (current > 0) {
            missedNotesRef.current.set(targetNote, current - 1);
          }
        }

        // Reveal any that were missed (shouldn't be any, but safety)
        for (const s of as2) {
          for (let f = 0; f <= maxFret; f++) {
            const k = `${s}:${f}`;
            if (noteAt(s, f) === targetNote && !newFound.has(k)) {
              newStates.set(k, 'revealed');
            }
          }
        }
        setCellStates(new Map(newStates));
      }

      return { correct: true, note: displayNote(clickedNote), string, fret };
    } else {
      // Wrong
      setMisses(m => m + 1);
      setScore(s => Math.max(0, s - 1)); // Deduct 1 point, floor at 0
      setRoundMisses(rm => rm + 1);
      streakRef.current = 0;
      setStreak(0);

      const newStates = new Map(cellStates);
      newStates.set(key, 'wrong');
      setCellStates(newStates);

      // Clear wrong state after animation
      setTimeout(() => {
        setCellStates(prev => {
          const next = new Map(prev);
          if (next.get(key) === 'wrong') next.delete(key);
          return next;
        });
      }, 600);

      return { correct: false, note: displayNote(clickedNote) };
    }
  }, [roundComplete, foundSet, targetNote, cellStates, numStrings, maxFret, mode, score, highScore, roundMisses, bestTime]);

  const changeStrings = useCallback((n: number) => {
    setNumStrings(n);
    startRound(n, undefined, undefined);
  }, [startRound]);

  const changeFrets = useCallback((f: number) => {
    setMaxFret(f);
    startRound(undefined, f, undefined);
  }, [startRound]);

  const changeMode = useCallback((newMode: 'game' | 'learn' | 'practice') => {
    setMode(newMode);
    startRound(undefined, undefined, undefined, newMode);
  }, [startRound]);

  // Note: initialization happens via startRound() called from App useEffect

  return {
    state: {
      targetNote,
      targetDisplay: displayNote(targetNote),
      numStrings,
      maxFret,
      includeSharps,
      score,
      streak,
      bestStreak,
      misses,
      found: foundSet.size,
      total,
      roundComplete,
      activeStrings,
      roundKey,
      mode,
      roundTime,
      bestTime,
      highScore,
      totalRounds,
      roundMisses,
      roundStartTime: roundStartTimeRef.current,
    } as GameState,
    cellStates,
    handleClick,
    nextRound: () => startRound(),
    changeStrings,
    changeFrets,
    startRound,
    changeMode,
  };
}
