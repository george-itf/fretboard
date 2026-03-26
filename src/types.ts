// ─── Fretboard Trainer: Shared Types ───

export const ALL_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;
export const ALL_STRINGS = ['E', 'A', 'D', 'G'] as const;

export type NoteState = 'hidden' | 'correct' | 'wrong' | 'revealed' | 'hint' | 'target' | 'selectable';
export type Mode = 'game' | 'learn' | 'practice' | 'identify';
export type IdentifyPhase = 'name' | 'find';

// ─── Game State ───

export interface GameState {
  // Settings
  mode: Mode;
  numStrings: number;
  maxFret: number;
  activeStrings: string[];
  identifyPhase: IdentifyPhase;
  numChoices: number;

  // Round
  targetNote: string;
  cellStates: Map<string, NoteState>;
  roundKey: number;
  roundComplete: boolean;
  foundKeys: Set<string>;
  totalPositions: number;
  roundMisses: number;
  roundStartTime: number;

  // Identify round
  highlightedPos: { string: string; fret: number } | null;
  identifyString: string;
  choiceOptions: string[];
  selectableFrets: number[];
  identifyAnswered: boolean;
  identifyCorrectAnswer: string;
  identifyLastResult: { correct: boolean; picked: string } | null;

  // Scoring
  score: number;
  streak: number;
  bestStreak: number;
  misses: number;
  highScore: number;
  bestTime: number;
  totalRounds: number;
  roundTime: number;
}

// ─── Typed Results (no more `as any`) ───

export type ClickResult =
  | { kind: 'learn'; note: string; rawNote: string; string: string; fret: number }
  | { kind: 'play-only'; rawNote: string; string: string; fret: number }
  | { kind: 'game-correct'; note: string; string: string; fret: number; roundDone: boolean }
  | { kind: 'game-wrong'; note: string }
  | { kind: 'identify-find-correct'; note: string; string: string; fret: number }
  | { kind: 'identify-find-wrong'; note: string; string: string; fret: number };

export type NameAnswerResult =
  | { kind: 'name-correct'; note: string; string: string; fret: number }
  | { kind: 'name-wrong'; note: string; correctNote: string };

// ─── Persistence ───

export interface PersistentStats {
  highScore: number;
  bestStreak: number;
  bestTime: number;
  totalRounds: number;
  lastPlayed: string;
}
