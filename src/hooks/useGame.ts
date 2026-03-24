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

// Landmark fret positions (dot markers on the neck)
const DOT_FRETS = [0, 3, 5, 7, 9, 12];

export type NoteState = 'hidden' | 'correct' | 'wrong' | 'revealed' | 'hint';

export interface CellState {
  string: string;
  fret: number;
  note: string;
  state: NoteState;
  key: string;
}

export type LearnPhase = 'tour' | 'fill' | 'quiz';

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
  // Learn mode
  learnPhase: LearnPhase;
  learnStringIndex: number;
  learnFillRound: number;
  learnTourString: string;
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

/** Strings in learning order: E (thickest) first */
function getTourStrings(numStrings: number): string[] {
  return [...ALL_STRINGS.slice(0, numStrings)];
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

  // Mild weighting: missed notes get a small bump (1.5x)
  if (missedNotes && missedNotes.size >= 2) {
    const weights = choices.map(note => {
      const missCount = missedNotes.get(note) || 0;
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

/** Get all notes that appear at landmark fret positions */
function getLandmarkNotes(activeStrings: string[], maxFret: number): string[] {
  const notes = new Set<string>();
  for (const s of activeStrings) {
    for (const f of DOT_FRETS) {
      if (f <= maxFret) notes.add(noteAt(s, f));
    }
  }
  return [...notes];
}

/** Count how many landmark positions have this note */
function countLandmarkPositions(note: string, activeStrings: string[], maxFret: number): number {
  let count = 0;
  for (const s of activeStrings) {
    for (const f of DOT_FRETS) {
      if (f <= maxFret && noteAt(s, f) === note) count++;
    }
  }
  return count;
}

function isLandmarkFret(fret: number): boolean {
  return DOT_FRETS.includes(fret);
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

  // Learn mode state
  const [learnPhase, setLearnPhase] = useState<LearnPhase>('tour');
  const [learnStringIndex, setLearnStringIndex] = useState(0);
  const [learnFillRound, setLearnFillRound] = useState(0);

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
    overrideMode?: 'game' | 'learn' | 'practice',
    overrideLearnPhase?: LearnPhase,
    overrideStringIndex?: number,
    overrideFillRound?: number
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
      const lp = overrideLearnPhase ?? learnPhase;
      const lsi = overrideStringIndex ?? learnStringIndex;
      const lfr = overrideFillRound ?? learnFillRound;

      setRoundMisses(0);
      setFoundSet(new Set());
      setRoundComplete(false);
      setRoundKey(prev => prev + 1);

      if (lp === 'tour') {
        // TOUR: show landmarks on one string, user taps each to confirm
        const tourStrings = getTourStrings(ns);
        const idx = Math.min(lsi, tourStrings.length - 1);
        const currentString = tourStrings[idx];
        const fretList = DOT_FRETS.filter(f => f <= mf);

        setTargetNote('');
        setTotal(fretList.length);

        const states = new Map<string, NoteState>();
        for (const f of fretList) {
          states.set(`${currentString}:${f}`, 'revealed');
        }
        setCellStates(states);

      } else if (lp === 'fill') {
        // FILL: quiz on landmark positions with decreasing hints
        const landmarks: { string: string; fret: number; note: string; key: string }[] = [];
        for (const s of as2) {
          for (const f of DOT_FRETS) {
            if (f <= mf) {
              landmarks.push({ string: s, fret: f, note: noteAt(s, f), key: `${s}:${f}` });
            }
          }
        }

        const landmarkNotes = [...new Set(landmarks.map(l => l.note))];
        const choices = landmarkNotes.filter(n => n !== targetNote);
        const target = choices.length > 0
          ? choices[Math.floor(Math.random() * choices.length)]
          : landmarkNotes[0];

        const targetPositions = landmarks.filter(l => l.note === target);
        const otherPositions = landmarks.filter(l => l.note !== target);

        // Decrease hints as rounds progress: 70% → 50% → 30% → 10% → 0%
        const hintPct = lfr < 2 ? 0.7 : lfr < 4 ? 0.5 : lfr < 6 ? 0.3 : lfr < 8 ? 0.1 : 0;
        const numHints = Math.round(otherPositions.length * hintPct);
        const shuffled = [...otherPositions].sort(() => Math.random() - 0.5);

        const states = new Map<string, NoteState>();
        for (let i = 0; i < numHints && i < shuffled.length; i++) {
          states.set(shuffled[i].key, 'hint');
        }

        setTargetNote(target);
        setTotal(targetPositions.length);
        setCellStates(states);
        roundStartTimeRef.current = Date.now();

      } else {
        // QUIZ: landmark positions only, no hints
        const landmarkNotes = getLandmarkNotes(as2, mf);
        const choices = landmarkNotes.filter(n => n !== targetNote);
        const target = choices.length > 0
          ? choices[Math.floor(Math.random() * choices.length)]
          : landmarkNotes[0];

        setTargetNote(target);
        setTotal(countLandmarkPositions(target, as2, mf));
        setCellStates(new Map());
        roundStartTimeRef.current = Date.now();
      }

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
  }, [numStrings, maxFret, includeSharps, targetNote, mode, learnPhase, learnStringIndex, learnFillRound]);

  const handleClick = useCallback((string: string, fret: number) => {
    // Practice mode: always play the note
    if (mode === 'practice') {
      const clickedNote = noteAt(string, fret);
      return { correct: true, note: displayNote(clickedNote), learnMode: true, rawNote: clickedNote, string, fret };
    }

    // Learn mode: behaviour depends on phase
    if (mode === 'learn') {
      const clickedNote = noteAt(string, fret);

      if (learnPhase === 'tour') {
        // Tour: tap landmarks on the current string to confirm
        const key = `${string}:${fret}`;
        const tourStrings = getTourStrings(numStrings);
        const currentString = tourStrings[Math.min(learnStringIndex, tourStrings.length - 1)];

        if (string === currentString && isLandmarkFret(fret) && fret <= maxFret && !foundSet.has(key)) {
          const newFound = new Set(foundSet);
          newFound.add(key);
          setFoundSet(newFound);

          const newStates = new Map(cellStates);
          newStates.set(key, 'correct');
          setCellStates(newStates);

          if (newFound.size >= total) {
            setRoundComplete(true);
          }
        }
        // Always return note info so sound plays
        return { correct: true, note: displayNote(clickedNote), learnMode: true, rawNote: clickedNote, string, fret };
      }

      // Fill or Quiz: quiz-like but restricted to landmark frets
      if (roundComplete) return;
      const key = `${string}:${fret}`;
      if (foundSet.has(key)) return;

      if (isLandmarkFret(fret) && clickedNote === targetNote) {
        // Correct - found target at a landmark position
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

        const targetCount = countLandmarkPositions(targetNote, getActiveStrings(numStrings), maxFret);
        if (newFound.size >= targetCount) {
          setRoundComplete(true);
          const elapsed = Date.now() - roundStartTimeRef.current;
          setRoundTime(elapsed);
          setTotalRounds(t => t + 1);

          // Reveal any missed landmark positions
          for (const s of getActiveStrings(numStrings)) {
            for (const f of DOT_FRETS) {
              const k = `${s}:${f}`;
              if (f <= maxFret && noteAt(s, f) === targetNote && !newFound.has(k)) {
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
        setRoundMisses(rm => rm + 1);
        streakRef.current = 0;
        setStreak(0);

        const newStates = new Map(cellStates);
        newStates.set(key, 'wrong');
        setCellStates(newStates);

        setTimeout(() => {
          setCellStates(prev => {
            const next = new Map(prev);
            if (next.get(key) === 'wrong') next.delete(key);
            return next;
          });
        }, 600);

        return { correct: false, note: displayNote(clickedNote) };
      }
    }

    // Game mode
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

        // Track missed notes
        if (roundMisses > 0) {
          const targetNoteCount = missedNotesRef.current.get(targetNote) || 0;
          missedNotesRef.current.set(targetNote, targetNoteCount + 1);
        } else {
          const current = missedNotesRef.current.get(targetNote) || 0;
          if (current > 0) {
            missedNotesRef.current.set(targetNote, current - 1);
          }
        }

        // Reveal any that were missed
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
      setScore(s => Math.max(0, s - 1));
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
  }, [roundComplete, foundSet, targetNote, cellStates, numStrings, maxFret, mode, score, highScore, roundMisses, bestTime, learnPhase, learnStringIndex, total]);

  const changeStrings = useCallback((n: number) => {
    setNumStrings(n);
    if (mode === 'learn') {
      // Restart learn from tour with new string count
      setLearnPhase('tour');
      setLearnStringIndex(0);
      setLearnFillRound(0);
      startRound(n, undefined, undefined, 'learn', 'tour', 0, 0);
    } else {
      startRound(n, undefined, undefined);
    }
  }, [startRound, mode]);

  const changeFrets = useCallback((f: number) => {
    setMaxFret(f);
    if (mode === 'learn') {
      // Restart current learn phase
      startRound(undefined, f, undefined, 'learn', learnPhase, learnStringIndex, learnFillRound);
    } else {
      startRound(undefined, f, undefined);
    }
  }, [startRound, mode, learnPhase, learnStringIndex, learnFillRound]);

  const changeMode = useCallback((newMode: 'game' | 'learn' | 'practice') => {
    setMode(newMode);
    if (newMode === 'learn') {
      setLearnPhase('tour');
      setLearnStringIndex(0);
      setLearnFillRound(0);
      startRound(undefined, undefined, undefined, 'learn', 'tour', 0, 0);
    } else {
      startRound(undefined, undefined, undefined, newMode);
    }
  }, [startRound]);

  /** Advance through learn phases: tour strings → fill rounds → quiz */
  const advanceLearn = useCallback(() => {
    if (learnPhase === 'tour') {
      const tourStrings = getTourStrings(numStrings);
      const nextIdx = learnStringIndex + 1;
      if (nextIdx < tourStrings.length) {
        // Next string
        setLearnStringIndex(nextIdx);
        startRound(undefined, undefined, undefined, 'learn', 'tour', nextIdx);
      } else {
        // Tour complete → fill phase
        setLearnPhase('fill');
        setLearnStringIndex(0);
        setLearnFillRound(0);
        startRound(undefined, undefined, undefined, 'learn', 'fill', 0, 0);
      }
    } else if (learnPhase === 'fill') {
      const next = learnFillRound + 1;
      setLearnFillRound(next);
      if (next >= 10) {
        // Enough fill rounds → quiz phase
        setLearnPhase('quiz');
        startRound(undefined, undefined, undefined, 'learn', 'quiz');
      } else {
        startRound(undefined, undefined, undefined, 'learn', 'fill', undefined, next);
      }
    } else {
      // Quiz: just next round
      startRound(undefined, undefined, undefined, 'learn', 'quiz');
    }
  }, [learnPhase, learnStringIndex, learnFillRound, numStrings, startRound]);

  // Note: initialization happens via startRound() called from App useEffect

  // Compute tour string name for display
  const tourStrings = getTourStrings(numStrings);
  const tourString = tourStrings[Math.min(learnStringIndex, tourStrings.length - 1)] || 'E';

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
      learnPhase,
      learnStringIndex,
      learnFillRound,
      learnTourString: tourString,
    } as GameState,
    cellStates,
    handleClick,
    nextRound: () => startRound(),
    changeStrings,
    changeFrets,
    startRound,
    changeMode,
    advanceLearn,
  };
}
