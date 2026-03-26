// ─── App Shell ───
//
// Settings bar, hero section, fretboard, and side-effect wiring.
// All game logic delegated to useGameEngine.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Mode, IdentifyPhase } from '@/types.ts';
import { useGameEngine } from '@/hooks/useGameEngine.ts';
import { displayNote } from '@/engine/music.ts';
import { computeHints } from '@/engine/hints.ts';
import { playCorrect, playWrong, playComplete } from '@/audio/synth.ts';
import Fretboard from '@/components/Fretboard.tsx';
import ChoiceButtons from '@/components/ChoiceButtons.tsx';
import ScoreBar from '@/components/ScoreBar.tsx';
import Toast, { useToast } from '@/components/Toast.tsx';
import { cn } from '@/lib/utils.ts';

/* ═══════════════════════════════════════════════════
   Settings options
   ═══════════════════════════════════════════════════ */

const STRING_OPTIONS = [
  { val: 1, label: 'E' },
  { val: 2, label: 'E A' },
  { val: 3, label: 'E A D' },
  { val: 4, label: 'All' },
];
const FRET_OPTIONS = [
  { val: 5, label: '0\u20135' },
  { val: 7, label: '0\u20137' },
  { val: 12, label: '0\u201312' },
];
const NAME_CHOICE_OPTIONS = [4, 6, 8];
const FIND_CHOICE_OPTIONS = [4, 6, 8, 10, 12];

/* ═══════════════════════════════════════════════════ */

function App() {
  const {
    state, startRound, handleClick, handleNameAnswer,
    changeStrings, changeFrets, changeMode, changeIdentifyPhase, changeIdentifyChoices,
  } = useGameEngine();

  const { toast, showToast } = useToast();
  const [targetKey, setTargetKey] = useState(0);
  const [showSettingsHint, setShowSettingsHint] = useState(true);
  const [muted, setMuted] = useState(false);
  const [timerOn, setTimerOn] = useState(false);
  const [liveTime, setLiveTime] = useState(0);
  const [hintPct, setHintPct] = useState(0);
  const initialized = useRef(false);

  // Initialise first round
  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      startRound();
    }
  }, [startRound]);

  // Animate target note change
  useEffect(() => { setTargetKey(p => p + 1); }, [state.targetNote]);

  // Settings hint auto-hide
  useEffect(() => {
    if (showSettingsHint) {
      const timer = setTimeout(() => setShowSettingsHint(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [showSettingsHint]);

  // Live timer tick (game mode only)
  useEffect(() => {
    if (!timerOn || state.roundComplete || state.mode !== 'game') return;
    const iv = setInterval(() => {
      if (state.roundKey > 0) setLiveTime(Date.now());
    }, 100);
    return () => clearInterval(iv);
  }, [timerOn, state.roundComplete, state.mode, state.roundKey]);

  // Auto-advance after answering in identify mode
  useEffect(() => {
    if (state.mode !== 'identify' || !state.identifyAnswered) return;
    const delay = state.identifyLastResult?.correct ? 1000 : 1800;
    const timer = setTimeout(() => startRound(), delay);
    return () => clearTimeout(timer);
  }, [state.identifyAnswered, state.identifyLastResult, state.mode, startRound]);

  // Keyboard: space/enter for next round
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.key === ' ' || e.key === 'Enter') && state.roundComplete) {
        e.preventDefault();
        startRound();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [state.roundComplete, startRound]);

  // ── Cell click with audio/toast side effects ──

  const onCellClick = useCallback((s: string, f: number) => {
    const result = handleClick(s, f);
    if (!result) return result;

    switch (result.kind) {
      case 'play-only':
        if (!muted) playCorrect(result.rawNote, result.string, result.fret);
        break;
      case 'learn':
        if (!muted) playCorrect(result.rawNote, result.string, result.fret);
        showToast(result.note, 'good');
        break;
      case 'game-correct':
        if (!muted) playCorrect(state.targetNote, result.string, result.fret);
        if (result.roundDone) {
          showToast('All found!', 'good');
          if (!muted) setTimeout(() => playComplete(), 120);
        }
        break;
      case 'game-wrong':
        if (!muted) playWrong();
        showToast(`That's ${result.note}`, 'bad');
        break;
      case 'identify-find-correct':
        if (!muted) playCorrect(state.targetNote, result.string, result.fret);
        break;
      case 'identify-find-wrong':
        if (!muted) playWrong();
        showToast(`That's ${result.note}`, 'bad');
        break;
    }
    return result;
  }, [handleClick, showToast, state.targetNote, muted]);

  // ── Name answer with audio ──

  const onNameAnswer = useCallback((note: string) => {
    const result = handleNameAnswer(note);
    if (!result) return;

    if (result.kind === 'name-correct') {
      if (!muted) playCorrect(result.note, result.string, result.fret);
    } else {
      if (!muted) playWrong();
    }
  }, [handleNameAnswer, muted]);

  // ── Computed values ──

  const mergedCellStates = useMemo(() => {
    if (hintPct === 0 || state.mode !== 'game') return state.cellStates;
    return computeHints(
      state.cellStates, hintPct, state.roundKey,
      state.activeStrings, state.maxFret, state.targetNote,
    );
  }, [state.cellStates, hintPct, state.roundKey, state.mode, state.activeStrings, state.maxFret, state.targetNote]);

  const dimStrings = useMemo(() => {
    if (state.mode !== 'identify' || state.identifyPhase !== 'find') return undefined;
    return new Set(state.activeStrings.filter(s => s !== state.identifyString));
  }, [state.mode, state.identifyPhase, state.activeStrings, state.identifyString]);

  const findChoiceOptions = useMemo(() => {
    return FIND_CHOICE_OPTIONS.filter(n => n <= state.maxFret + 1);
  }, [state.maxFret]);

  const showScore = state.mode === 'game' || state.mode === 'identify';
  const found = state.foundKeys.size;

  return (
    <div className="vignette grain min-h-[100dvh] flex flex-col relative">
      <div className="stage-glow" />

      {/* ═══ TOP BAR ═══ */}
      <div className="relative z-10 w-full px-3 sm:px-4 pt-3 sm:pt-5 flex flex-col sm:flex-row items-center sm:justify-between gap-1.5 sm:gap-4">
        {showScore && (
          <ScoreBar
            score={state.score}
            streak={state.streak}
            bestStreak={state.bestStreak}
            highScore={state.highScore}
          />
        )}

        {/* Settings cluster */}
        <div className="relative flex items-center justify-center flex-wrap gap-1 sm:gap-3 font-mono text-[12px] sm:text-[14px] tracking-wider">
          {/* String picker */}
          <div className="flex gap-0">
            {STRING_OPTIONS.map(opt => (
              <button
                key={opt.val}
                className={cn(
                  "px-1 sm:px-1.5 py-1 cursor-pointer bg-transparent border-none outline-none transition-all duration-150",
                  state.numStrings === opt.val
                    ? "text-[hsl(32,90%,56%)]"
                    : "text-[hsl(20,8%,48%)] hover:text-[hsl(20,8%,50%)]"
                )}
                style={{ fontFamily: 'inherit', fontSize: 'inherit', letterSpacing: 'inherit' }}
                onClick={() => changeStrings(opt.val)}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <span className="text-[hsl(20,8%,30%)] text-[10px]">&middot;</span>

          {/* Fret picker */}
          <div className="flex gap-0">
            {FRET_OPTIONS.map(opt => (
              <button
                key={opt.val}
                className={cn(
                  "px-1 sm:px-1.5 py-1 cursor-pointer bg-transparent border-none outline-none transition-all duration-150",
                  state.maxFret === opt.val
                    ? "text-[hsl(32,90%,56%)]"
                    : "text-[hsl(20,8%,48%)] hover:text-[hsl(20,8%,50%)]"
                )}
                style={{ fontFamily: 'inherit', fontSize: 'inherit', letterSpacing: 'inherit' }}
                onClick={() => changeFrets(opt.val)}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <span className="text-[hsl(20,8%,30%)] text-[10px]">&middot;</span>

          {/* Mute */}
          <button
            className={cn(
              "px-1 py-1 cursor-pointer bg-transparent border-none outline-none transition-all duration-150",
              !muted ? "text-[hsl(32,90%,56%)]" : "text-[hsl(20,8%,48%)] hover:text-[hsl(20,8%,50%)]"
            )}
            style={{ fontFamily: 'inherit', fontSize: 'inherit', letterSpacing: 'inherit' }}
            onClick={() => setMuted(m => !m)}
          >
            {muted ? '\u266A\u0338' : '\u266A'}
          </button>

          <span className="text-[hsl(20,8%,30%)] text-[10px]">&middot;</span>

          {/* Timer (game only) */}
          {state.mode === 'game' && (
            <>
              <button
                className={cn(
                  "px-1 py-1 cursor-pointer bg-transparent border-none outline-none transition-all duration-150",
                  timerOn ? "text-[hsl(32,90%,56%)]" : "text-[hsl(20,8%,48%)] hover:text-[hsl(20,8%,50%)]"
                )}
                style={{ fontFamily: 'inherit', fontSize: 'inherit', letterSpacing: 'inherit' }}
                onClick={() => setTimerOn(t => !t)}
              >
                timer
              </button>
              <span className="text-[hsl(20,8%,30%)] text-[10px]">&middot;</span>
            </>
          )}

          {/* Mode selector */}
          <select
            value={state.mode}
            onChange={e => changeMode(e.target.value as Mode)}
            className="bg-transparent border-none outline-none cursor-pointer text-[hsl(32,90%,56%)] appearance-none px-1 py-1"
            style={{
              fontFamily: 'inherit',
              fontSize: 'inherit',
              letterSpacing: 'inherit',
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='5' viewBox='0 0 8 5'%3E%3Cpath d='M0 0l4 5 4-5z' fill='hsl(32,90%25,56%25)'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 2px center',
              paddingRight: '14px',
            }}
          >
            <option value="game" style={{ background: '#2a2520', color: '#e8d5b0' }}>game</option>
            <option value="identify" style={{ background: '#2a2520', color: '#e8d5b0' }}>identify</option>
            <option value="learn" style={{ background: '#2a2520', color: '#e8d5b0' }}>learn</option>
            <option value="practice" style={{ background: '#2a2520', color: '#e8d5b0' }}>practice</option>
          </select>

          {/* Game mode: hints slider */}
          {state.mode === 'game' && (
            <>
              <span className="text-[hsl(20,8%,30%)] text-[10px]">&middot;</span>
              <div className="flex items-center gap-1.5">
                <span className={cn(
                  "text-[11px]",
                  hintPct > 0 ? "text-[hsl(32,90%,56%)]" : "text-[hsl(20,8%,48%)]"
                )}>
                  hints
                </span>
                <input
                  type="range"
                  min={0} max={50} step={5}
                  value={hintPct}
                  onChange={e => setHintPct(Number(e.target.value))}
                  className="w-[50px] sm:w-[60px] h-[3px] appearance-none rounded-full cursor-pointer"
                  style={{
                    background: hintPct > 0
                      ? `linear-gradient(to right, hsl(32,80%,50%) ${hintPct * 2}%, hsl(20,6%,25%) ${hintPct * 2}%)`
                      : 'hsl(20,6%,25%)',
                    accentColor: 'hsl(32,80%,50%)',
                  }}
                />
                {hintPct > 0 && (
                  <span className="text-[10px] text-[hsl(32,60%,50%)] tabular-nums w-[24px]">
                    {hintPct}%
                  </span>
                )}
              </div>
            </>
          )}

          {/* Identify mode: phase + choices */}
          {state.mode === 'identify' && (
            <>
              <span className="text-[hsl(20,8%,30%)] text-[10px]">&middot;</span>

              <div className="flex gap-0">
                {(['name', 'find'] as IdentifyPhase[]).map(phase => (
                  <button
                    key={phase}
                    className={cn(
                      "px-1 sm:px-1.5 py-1 cursor-pointer bg-transparent border-none outline-none transition-all duration-150",
                      state.identifyPhase === phase
                        ? "text-[hsl(32,90%,56%)]"
                        : "text-[hsl(20,8%,48%)] hover:text-[hsl(20,8%,50%)]"
                    )}
                    style={{ fontFamily: 'inherit', fontSize: 'inherit', letterSpacing: 'inherit' }}
                    onClick={() => changeIdentifyPhase(phase)}
                  >
                    {phase}
                  </button>
                ))}
              </div>

              <span className="text-[hsl(20,8%,30%)] text-[10px]">&middot;</span>

              <div className="flex gap-0">
                {(state.identifyPhase === 'name' ? NAME_CHOICE_OPTIONS : findChoiceOptions).map(n => (
                  <button
                    key={n}
                    className={cn(
                      "px-1 sm:px-1.5 py-1 cursor-pointer bg-transparent border-none outline-none transition-all duration-150",
                      state.numChoices === n
                        ? "text-[hsl(32,90%,56%)]"
                        : "text-[hsl(20,8%,48%)] hover:text-[hsl(20,8%,50%)]"
                    )}
                    style={{ fontFamily: 'inherit', fontSize: 'inherit', letterSpacing: 'inherit' }}
                    onClick={() => changeIdentifyChoices(n)}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </>
          )}

          {showSettingsHint && (
            <div
              className="absolute -bottom-4 right-0 font-mono text-[8px] text-[hsl(32,50%,45%)] tracking-wider animate-fade-in"
              style={{ opacity: 0.7 }}
            >
              settings
            </div>
          )}
        </div>
      </div>

      {/* ═══ CENTER ═══ */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-2 sm:px-3 py-2 sm:py-4 gap-2 sm:gap-5">

        {/* Hero section */}
        <div className="text-center relative">
          {/* Atmospheric glow */}
          <div
            className="absolute left-1/2 top-1/2 pointer-events-none"
            style={{
              width: 280, height: 200,
              transform: 'translate(-50%, -50%)',
              background: 'radial-gradient(ellipse at center, hsla(32, 75%, 45%, 0.1) 0%, transparent 65%)',
              filter: 'blur(20px)',
              animation: 'target-glow-pulse 3s ease-in-out infinite',
            }}
          />

          {/* Game hero */}
          {state.mode === 'game' && (
            <>
              <div className="text-[11px] sm:text-[12px] font-semibold tracking-[0.35em] uppercase text-[hsl(20,10%,58%)] mb-1 relative">
                Find all the
              </div>
              <div key={targetKey} className="animate-target-enter relative">
                <span
                  className="font-display text-6xl sm:text-[110px] font-normal leading-none"
                  style={{
                    color: 'hsl(38, 28%, 92%)',
                    textShadow: '0 0 80px hsla(32, 60%, 50%, 0.12), 0 0 30px hsla(32, 60%, 50%, 0.06), 0 4px 8px rgba(0,0,0,0.4)',
                  }}
                >
                  {displayNote(state.targetNote)}
                </span>
              </div>
            </>
          )}

          {/* Identify / Name hero */}
          {state.mode === 'identify' && state.identifyPhase === 'name' && (
            <div className="text-[11px] sm:text-[12px] font-semibold tracking-[0.35em] uppercase text-[hsl(20,10%,58%)] mb-2 relative">
              NAME THIS NOTE
            </div>
          )}

          {/* Identify / Find hero */}
          {state.mode === 'identify' && state.identifyPhase === 'find' && (
            <>
              <div className="text-[11px] sm:text-[12px] font-semibold tracking-[0.35em] uppercase text-[hsl(20,10%,58%)] mb-1 relative">
                Find the
              </div>
              <div key={targetKey} className="animate-target-enter relative">
                <span
                  className="font-display text-6xl sm:text-[110px] font-normal leading-none"
                  style={{
                    color: 'hsl(38, 28%, 92%)',
                    textShadow: '0 0 80px hsla(32, 60%, 50%, 0.12), 0 0 30px hsla(32, 60%, 50%, 0.06), 0 4px 8px rgba(0,0,0,0.4)',
                  }}
                >
                  {displayNote(state.targetNote)}
                </span>
              </div>
              <div className="text-[10px] sm:text-[11px] font-mono text-[hsl(20,8%,42%)] mt-2 tracking-wider relative">
                on the {state.identifyString} string
              </div>
            </>
          )}

          {/* Learn hero */}
          {state.mode === 'learn' && (
            <div className="text-[11px] sm:text-[12px] font-semibold tracking-[0.35em] uppercase text-[hsl(20,10%,58%)] mb-1 relative">
              LANDMARK NOTES
            </div>
          )}

          {/* Practice hero */}
          {state.mode === 'practice' && (
            <div className="text-[11px] sm:text-[12px] font-semibold tracking-[0.35em] uppercase text-[hsl(20,10%,58%)] mb-1 relative">
              PRACTICE
            </div>
          )}

          {/* Progress dots (game mode) */}
          {state.mode === 'game' && (
            <>
              <div className="mt-3 flex items-center justify-center gap-2 relative">
                {Array.from({ length: state.totalPositions }).map((_, i) => (
                  <div
                    key={`${state.roundKey}-${i}`}
                    className={cn("rounded-full transition-all", i < found ? "w-3.5 h-3.5" : "w-3 h-3")}
                    style={i < found ? {
                      background: 'radial-gradient(circle at 35% 30%, hsl(40,100%,68%), hsl(30,85%,48%))',
                      boxShadow: '0 0 8px hsla(32,90%,54%,0.45)',
                      animation: 'progress-pop 0.28s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
                    } : {
                      background: 'hsl(20,6%,18%)',
                      border: '1px solid hsl(20,6%,24%)',
                    }}
                  />
                ))}
              </div>

              <div className="font-mono text-[13px] text-[hsl(20,10%,55%)] mt-1.5 relative flex items-center gap-3 justify-center">
                <span>
                  <span className="text-[hsl(32,70%,52%)]">{found}</span>
                  <span className="mx-1 text-[hsl(20,8%,38%)]">/</span>
                  {state.totalPositions}
                </span>
                {timerOn && !state.roundComplete && state.roundStartTime > 0 && (
                  <span className="text-[hsl(32,50%,50%)]">
                    {((liveTime ? (liveTime - state.roundStartTime) : 0) / 1000).toFixed(1)}s
                  </span>
                )}
              </div>
            </>
          )}
        </div>

        {/* Choice buttons (identify/name) */}
        {state.mode === 'identify' && state.identifyPhase === 'name' && (
          <ChoiceButtons
            choices={state.choiceOptions}
            correctAnswer={state.identifyCorrectAnswer}
            answered={state.identifyAnswered}
            lastResult={state.identifyLastResult}
            roundKey={state.roundKey}
            onAnswer={onNameAnswer}
          />
        )}

        {/* Next button (game mode round complete) */}
        {state.roundComplete && state.mode === 'game' && (
          <div className="flex flex-col items-center gap-2 animate-fade-in">
            <button
              className="cursor-pointer border-none outline-none bg-transparent"
              style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 11, fontWeight: 600,
                letterSpacing: '0.25em',
                textTransform: 'uppercase' as const,
                padding: '12px 24px',
                color: 'hsl(32,70%,58%)',
                textShadow: '0 0 20px hsla(32,80%,50%,0.3)',
              }}
              onClick={() => startRound()}
            >
              tap to continue
            </button>
            {state.roundTime > 0 && (
              <div className="font-mono text-[10px] text-[hsl(32,50%,45%)]">
                {(state.roundTime / 1000).toFixed(1)}s
              </div>
            )}
          </div>
        )}

        {/* The fretboard */}
        <div className="w-full overflow-x-auto fretboard-scroll" style={{ paddingLeft: 8, paddingRight: 8 }}>
          <div className="min-w-[560px] mx-auto">
            <Fretboard
              activeStrings={state.activeStrings}
              maxFret={state.maxFret}
              cellStates={mergedCellStates}
              roundComplete={state.roundComplete}
              roundKey={state.roundKey}
              onCellClick={onCellClick}
              dimStrings={dimStrings}
            />
          </div>
        </div>

        {/* Keyboard hint */}
        {state.roundComplete && (
          <div className="font-mono text-[9px] text-[hsl(20,6%,28%)] tracking-wider hidden sm:block">
            press space for next
          </div>
        )}
      </div>

      {/* Misses counter */}
      {state.misses > 0 && (
        <div className="fixed bottom-4 right-4 font-mono text-[10px] text-[hsl(0,30%,30%)] tracking-wider z-10">
          {state.misses} miss{state.misses !== 1 ? 'es' : ''}
        </div>
      )}

      <Toast message={toast} />
    </div>
  );
}

export default App;
