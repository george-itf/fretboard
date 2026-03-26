// ─── Round Logic ───
//
// Pure functions: take state, return a patch to apply.
// Each mode has its own startRound function.
// No React imports, no side effects.

import type { GameState, NoteState } from '@/types.ts';
import {
  noteAt, cellKey, getActiveStrings,
  countPositions, pickNote, generateNameChoices, generateFindChoices,
} from './music.ts';

const DOT_FRETS = [3, 5, 7, 9, 12];

// ─── Practice ───

export function startPracticeRound(state: GameState): Partial<GameState> {
  const activeStrings = getActiveStrings(state.numStrings);
  const cells = new Map<string, NoteState>();
  for (const s of activeStrings) {
    for (let f = 0; f <= state.maxFret; f++) {
      cells.set(cellKey(s, f), 'revealed');
    }
  }
  return {
    targetNote: '',
    totalPositions: 0,
    foundKeys: new Set(),
    roundComplete: false,
    roundMisses: 0,
    cellStates: cells,
    roundKey: state.roundKey + 1,
    activeStrings,
  };
}

// ─── Learn ───

export function startLearnRound(state: GameState): Partial<GameState> {
  const activeStrings = getActiveStrings(state.numStrings);
  const cells = new Map<string, NoteState>();
  for (const s of activeStrings) {
    cells.set(cellKey(s, 0), 'revealed'); // open string always shown
    for (const f of DOT_FRETS) {
      if (f <= state.maxFret) cells.set(cellKey(s, f), 'revealed');
    }
  }
  return {
    targetNote: '',
    totalPositions: 0,
    foundKeys: new Set(),
    roundComplete: false,
    roundMisses: 0,
    cellStates: cells,
    roundKey: state.roundKey + 1,
    activeStrings,
  };
}

// ─── Identify: Name ───

export function startIdentifyNameRound(state: GameState): Partial<GameState> {
  const activeStrings = getActiveStrings(state.numStrings);
  const s = activeStrings[Math.floor(Math.random() * activeStrings.length)];
  const f = Math.floor(Math.random() * (state.maxFret + 1));
  const correctNote = noteAt(s, f);
  const choices = generateNameChoices(correctNote, state.numChoices, s, f, state.maxFret);

  const cells = new Map<string, NoteState>();
  cells.set(cellKey(s, f), 'target');

  return {
    identifyAnswered: false,
    identifyLastResult: null,
    roundComplete: false,
    roundMisses: 0,
    roundStartTime: Date.now(),
    highlightedPos: { string: s, fret: f },
    identifyCorrectAnswer: correctNote,
    targetNote: '',
    choiceOptions: choices,
    cellStates: cells,
    roundKey: state.roundKey + 1,
    activeStrings,
  };
}

// ─── Identify: Find ───

export function startIdentifyFindRound(state: GameState): Partial<GameState> {
  const activeStrings = getActiveStrings(state.numStrings);
  const s = activeStrings[Math.floor(Math.random() * activeStrings.length)];

  // Collect unique notes on this string
  const notesOnString = new Set<string>();
  for (let f = 0; f <= state.maxFret; f++) {
    notesOnString.add(noteAt(s, f));
  }
  const notePool = Array.from(notesOnString);
  const note = notePool[Math.floor(Math.random() * notePool.length)];

  // Find correct fret positions
  const correctFrets: number[] = [];
  for (let f = 0; f <= state.maxFret; f++) {
    if (noteAt(s, f) === note) correctFrets.push(f);
  }

  const selectable = generateFindChoices(correctFrets, state.numChoices, state.maxFret);
  const cells = new Map<string, NoteState>();
  for (const f of selectable) {
    cells.set(cellKey(s, f), 'selectable');
  }

  return {
    identifyAnswered: false,
    identifyLastResult: null,
    roundComplete: false,
    roundMisses: 0,
    roundStartTime: Date.now(),
    highlightedPos: null,
    identifyString: s,
    targetNote: note,
    identifyCorrectAnswer: note,
    selectableFrets: selectable,
    cellStates: cells,
    roundKey: state.roundKey + 1,
    activeStrings,
  };
}

// ─── Game ───

export function startGameRound(
  state: GameState,
  missedNotes: Map<string, number>,
): Partial<GameState> {
  const activeStrings = getActiveStrings(state.numStrings);
  const note = pickNote(activeStrings, state.maxFret, state.targetNote, missedNotes);
  const count = countPositions(note, activeStrings, state.maxFret);

  return {
    targetNote: note,
    totalPositions: count,
    foundKeys: new Set(),
    roundComplete: false,
    cellStates: new Map(),
    roundMisses: 0,
    roundKey: state.roundKey + 1,
    roundStartTime: Date.now(),
    activeStrings,
  };
}
