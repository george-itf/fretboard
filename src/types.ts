// ─── Fretboard Trainer: Shared Types ───

export const ALL_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;
export const ALL_STRINGS = ['E', 'A', 'D', 'G'] as const;

export type NoteState = 'hidden' | 'correct' | 'wrong' | 'revealed' | 'hint' | 'target' | 'selectable';
export type Mode = 'game' | 'learn' | 'practice' | 'identify' | 'scales';
export type IdentifyPhase = 'name' | 'find';
export type ScaleType = 'major' | 'natural-minor' | 'minor-pentatonic' | 'major-pentatonic' | 'blues';
export type ScalePhase = 'learn-scale' | 'degree-game' | 'name-degree';

// ─── Scale Degree Info ───

export interface DegreeInfo {
  label: string;    // 'R', 'b3', '5', etc.
  color: string;    // HSL color string
  semitone: number; // interval from root (0-11)
}

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

  // Scale mode
  scaleRoot: string;
  scaleType: ScaleType;
  scalePhase: ScalePhase;
  targetDegree: string;
  degreeChoices: string[];
  scaleMap: Map<string, DegreeInfo>;

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

// ─── Typed Results ───

export type ClickResult =
  | { kind: 'learn'; note: string; rawNote: string; string: string; fret: number }
  | { kind: 'play-only'; rawNote: string; string: string; fret: number }
  | { kind: 'game-correct'; note: string; string: string; fret: number; roundDone: boolean }
  | { kind: 'game-wrong'; note: string }
  | { kind: 'identify-find-correct'; note: string; string: string; fret: number }
  | { kind: 'identify-find-wrong'; note: string; string: string; fret: number }
  | { kind: 'scale-learn'; note: string; rawNote: string; string: string; fret: number; degree: string }
  | { kind: 'scale-degree-correct'; note: string; string: string; fret: number; roundDone: boolean }
  | { kind: 'scale-degree-wrong'; note: string }
  | { kind: 'scale-play-only'; rawNote: string; string: string; fret: number };

export type NameAnswerResult =
  | { kind: 'name-correct'; note: string; string: string; fret: number }
  | { kind: 'name-wrong'; note: string; correctNote: string };

export type DegreeAnswerResult =
  | { kind: 'degree-correct'; degree: string; string: string; fret: number }
  | { kind: 'degree-wrong'; picked: string; correctDegree: string };

// ─── Persistence ───

export interface PersistentStats {
  highScore: number;
  bestStreak: number;
  bestTime: number;
  totalRounds: number;
  lastPlayed: string;
}
