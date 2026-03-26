// ─── Game Engine Hook ───
//
// Single useReducer replaces 40+ useStates.
// Handler functions compute results + dispatch state patches.
// Results returned to caller for audio/toast side effects.

import { useReducer, useCallback, useRef, useEffect } from 'react';
import type { GameState, Mode, IdentifyPhase, ClickResult, NameAnswerResult } from '@/types.ts';
import { noteAt, cellKey, displayNote, countPositions, getActiveStrings } from '@/engine/music.ts';
import { loadStats, saveStats } from '@/engine/persistence.ts';
import {
  startPracticeRound, startLearnRound,
  startIdentifyNameRound, startIdentifyFindRound,
  startGameRound,
} from '@/engine/rounds.ts';

// ─── Initial state ───

function createInitialState(): GameState {
  return {
    mode: 'game',
    numStrings: 4,
    maxFret: 12,
    activeStrings: getActiveStrings(4),
    identifyPhase: 'name',
    numChoices: 4,
    targetNote: '',
    cellStates: new Map(),
    roundKey: 0,
    roundComplete: false,
    foundKeys: new Set(),
    totalPositions: 0,
    roundMisses: 0,
    roundStartTime: 0,
    highlightedPos: null,
    identifyString: 'E',
    choiceOptions: [],
    selectableFrets: [],
    identifyAnswered: false,
    identifyCorrectAnswer: '',
    identifyLastResult: null,
    score: 0,
    streak: 0,
    bestStreak: 0,
    misses: 0,
    highScore: 0,
    bestTime: 0,
    totalRounds: 0,
    roundTime: 0,
  };
}

// ─── Reducer ───

type Action =
  | { type: 'PATCH'; patch: Partial<GameState> }
  | { type: 'LOAD_STATS'; highScore: number; bestStreak: number; bestTime: number; totalRounds: number }
  | { type: 'CLEAR_WRONG'; key: string };

function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'PATCH':
      return { ...state, ...action.patch };
    case 'LOAD_STATS':
      return {
        ...state,
        highScore: action.highScore,
        bestStreak: action.bestStreak,
        bestTime: action.bestTime,
        totalRounds: action.totalRounds,
      };
    case 'CLEAR_WRONG': {
      const next = new Map(state.cellStates);
      if (next.get(action.key) === 'wrong') next.delete(action.key);
      return { ...state, cellStates: next };
    }
    default:
      return state;
  }
}

// ─── Hook ───

export function useGameEngine() {
  const [state, dispatch] = useReducer(reducer, undefined, createInitialState);

  // Ref tracks latest state for stable callbacks (no stale closures)
  const stateRef = useRef(state);
  stateRef.current = state;

  const streakRef = useRef(0);
  const missedNotesRef = useRef<Map<string, number>>(new Map());

  // ── Persistence ──

  useEffect(() => {
    const stats = loadStats();
    dispatch({
      type: 'LOAD_STATS',
      highScore: stats.highScore,
      bestStreak: stats.bestStreak,
      bestTime: stats.bestTime,
      totalRounds: stats.totalRounds,
    });
  }, []);

  useEffect(() => {
    saveStats({
      highScore: state.highScore,
      bestStreak: state.bestStreak,
      bestTime: state.bestTime,
      totalRounds: state.totalRounds,
      lastPlayed: new Date().toISOString(),
    });
  }, [state.highScore, state.bestStreak, state.bestTime, state.totalRounds]);

  // ── Start Round ──
  // Accepts optional overrides (used by settings changes to atomically
  // update a setting + start a new round in one dispatch).

  const startRound = useCallback((overrides?: Partial<GameState>) => {
    const effective = { ...stateRef.current, ...overrides } as GameState;
    let patch: Partial<GameState>;

    switch (effective.mode) {
      case 'practice':
        patch = startPracticeRound(effective);
        break;
      case 'learn':
        patch = startLearnRound(effective);
        break;
      case 'identify':
        patch = effective.identifyPhase === 'name'
          ? startIdentifyNameRound(effective)
          : startIdentifyFindRound(effective);
        break;
      default:
        patch = startGameRound(effective, missedNotesRef.current);
        break;
    }

    // Merge overrides into patch so the setting change persists
    dispatch({ type: 'PATCH', patch: { ...overrides, ...patch } });
  }, []);

  // ── Cell Click ──

  const handleClick = useCallback((string: string, fret: number): ClickResult | undefined => {
    const s = stateRef.current;
    const clickedNote = noteAt(string, fret);
    const display = displayNote(clickedNote);

    // Learn / Practice — play the note, reveal it
    if (s.mode === 'learn' || s.mode === 'practice') {
      // In learn mode, reveal tapped notes
      if (s.mode === 'learn') {
        const key = cellKey(string, fret);
        if (!s.cellStates.has(key)) {
          const newCells = new Map(s.cellStates);
          newCells.set(key, 'revealed');
          dispatch({ type: 'PATCH', patch: { cellStates: newCells } });
        }
      }
      return { kind: 'learn', note: display, rawNote: clickedNote, string, fret };
    }

    // Identify mode
    if (s.mode === 'identify') {
      if (s.identifyAnswered) return undefined;

      // Name phase: tapping fretboard just plays the note, doesn't answer
      if (s.identifyPhase === 'name') {
        return { kind: 'play-only', rawNote: clickedNote, string, fret };
      }

      // Find phase: only the target string, only selectable frets
      if (string !== s.identifyString) return undefined;
      if (!s.selectableFrets.includes(fret)) return undefined;

      const correct = clickedNote === s.targetNote;
      const newStreak = correct ? streakRef.current + 1 : 0;
      streakRef.current = newStreak;

      const newCells = new Map(s.cellStates);
      newCells.set(cellKey(string, fret), correct ? 'correct' : 'wrong');

      // If wrong, reveal correct positions
      if (!correct) {
        for (const f of s.selectableFrets) {
          if (noteAt(string, f) === s.targetNote) {
            newCells.set(cellKey(string, f), 'correct');
          }
        }
      }

      dispatch({
        type: 'PATCH',
        patch: {
          identifyAnswered: true,
          identifyLastResult: { correct, picked: `${fret}` },
          cellStates: newCells,
          streak: newStreak,
          ...(correct
            ? { score: s.score + 1, bestStreak: Math.max(s.bestStreak, newStreak) }
            : { score: Math.max(0, s.score - 1), misses: s.misses + 1 }),
        },
      });

      return correct
        ? { kind: 'identify-find-correct', note: display, string, fret }
        : { kind: 'identify-find-wrong', note: display, string, fret };
    }

    // ── Game mode ──
    if (s.roundComplete) return undefined;
    const key = cellKey(string, fret);
    if (s.foundKeys.has(key)) return undefined;

    if (clickedNote === s.targetNote) {
      // Correct
      const newFound = new Set(s.foundKeys);
      newFound.add(key);
      const newStreak = streakRef.current + 1;
      streakRef.current = newStreak;

      const newCells = new Map(s.cellStates);
      newCells.set(key, 'correct');

      const totalCount = countPositions(s.targetNote, s.activeStrings, s.maxFret);
      const roundDone = newFound.size >= totalCount;

      const patch: Partial<GameState> = {
        foundKeys: newFound,
        score: s.score + 1,
        streak: newStreak,
        bestStreak: Math.max(s.bestStreak, newStreak),
        cellStates: newCells,
      };

      if (roundDone) {
        const elapsed = Date.now() - s.roundStartTime;
        patch.roundComplete = true;
        patch.roundTime = elapsed;
        patch.totalRounds = s.totalRounds + 1;
        if (s.bestTime === 0 || elapsed < s.bestTime) patch.bestTime = elapsed;
        if (s.score + 1 > s.highScore) patch.highScore = s.score + 1;

        // Missed notes tracking for weighted selection
        if (s.roundMisses > 0) {
          const c = missedNotesRef.current.get(s.targetNote) || 0;
          missedNotesRef.current.set(s.targetNote, c + 1);
        } else {
          const c = missedNotesRef.current.get(s.targetNote) || 0;
          if (c > 0) missedNotesRef.current.set(s.targetNote, c - 1);
        }

        // Reveal remaining target positions
        for (const str of s.activeStrings) {
          for (let f = 0; f <= s.maxFret; f++) {
            const k = cellKey(str, f);
            if (noteAt(str, f) === s.targetNote && !newFound.has(k)) {
              newCells.set(k, 'revealed');
            }
          }
        }
        patch.cellStates = new Map(newCells);
      }

      dispatch({ type: 'PATCH', patch });
      return { kind: 'game-correct', note: display, string, fret, roundDone };
    } else {
      // Wrong
      streakRef.current = 0;
      const newCells = new Map(s.cellStates);
      newCells.set(key, 'wrong');

      dispatch({
        type: 'PATCH',
        patch: {
          misses: s.misses + 1,
          score: Math.max(0, s.score - 1),
          roundMisses: s.roundMisses + 1,
          streak: 0,
          cellStates: newCells,
        },
      });

      // Clear wrong state after shake animation
      setTimeout(() => dispatch({ type: 'CLEAR_WRONG', key }), 600);

      return { kind: 'game-wrong', note: display };
    }
  }, []);

  // ── Name Answer (identify/name mode) ──

  const handleNameAnswer = useCallback((note: string): NameAnswerResult | undefined => {
    const s = stateRef.current;
    if (s.identifyAnswered || s.mode !== 'identify' || s.identifyPhase !== 'name') return undefined;

    const correct = note === s.identifyCorrectAnswer;
    const newStreak = correct ? streakRef.current + 1 : 0;
    streakRef.current = newStreak;

    // BUG FIX: was `correct ? 'correct' : 'correct'` — both branches identical
    const newCells = new Map(s.cellStates);
    if (s.highlightedPos) {
      newCells.set(
        cellKey(s.highlightedPos.string, s.highlightedPos.fret),
        correct ? 'correct' : 'wrong',
      );
    }

    dispatch({
      type: 'PATCH',
      patch: {
        identifyAnswered: true,
        identifyLastResult: { correct, picked: note },
        cellStates: newCells,
        streak: newStreak,
        ...(correct
          ? { score: s.score + 1, bestStreak: Math.max(s.bestStreak, newStreak) }
          // BUG FIX: identify mode now deducts points on wrong answer
          : { score: Math.max(0, s.score - 1), misses: s.misses + 1 }),
      },
    });

    if (correct && s.highlightedPos) {
      return { kind: 'name-correct', note, string: s.highlightedPos.string, fret: s.highlightedPos.fret };
    }
    return { kind: 'name-wrong', note, correctNote: s.identifyCorrectAnswer };
  }, []);

  // ── Settings Wrappers ──

  const changeStrings = useCallback((n: number) => startRound({ numStrings: n }), [startRound]);
  const changeFrets = useCallback((f: number) => startRound({ maxFret: f }), [startRound]);
  const changeMode = useCallback((mode: Mode) => {
    startRound({ mode, misses: 0, roundComplete: false });
  }, [startRound]);
  const changeIdentifyPhase = useCallback((phase: IdentifyPhase) => {
    startRound({ identifyPhase: phase });
  }, [startRound]);
  const changeIdentifyChoices = useCallback((n: number) => {
    startRound({ numChoices: n });
  }, [startRound]);

  return {
    state,
    startRound,
    handleClick,
    handleNameAnswer,
    changeStrings,
    changeFrets,
    changeMode,
    changeIdentifyPhase,
    changeIdentifyChoices,
  };
}
