import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useGame, noteAt, type NoteState } from '@/hooks/useGame';
import Fretboard from '@/components/Fretboard';
import Toast, { useToast } from '@/components/Toast';
import { playCorrect, playWrong, playComplete } from '@/lib/sounds';
import { cn } from '@/lib/utils';

/* ═══════════════════════════════════════════════════
   Settings as inline text toggles - no buttons, no chrome
   ═══════════════════════════════════════════════════ */

const STRING_OPTIONS = [
  { val: 1, label: 'E' },
  { val: 2, label: 'E A' },
  { val: 3, label: 'E A D' },
  { val: 4, label: 'All' },
];
const FRET_OPTIONS = [
  { val: 5, label: '0–5' },
  { val: 7, label: '0–7' },
  { val: 12, label: '0–12' },
];

function App() {
  const {
    state, cellStates, handleClick, nextRound,
    changeStrings, changeFrets, changeSharps, startRound,
    toggleMode,
  } = useGame();

  const { toast, showToast } = useToast();
  const [targetKey, setTargetKey] = useState(0);
  const [showSettingsHint, setShowSettingsHint] = useState(true);
  const [muted, setMuted] = useState(false);
  const [timerOn, setTimerOn] = useState(false);
  const [liveTime, setLiveTime] = useState(0);
  const [hintPct, setHintPct] = useState(0); // 0-50%
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      startRound();
    }
  }, [startRound]);

  useEffect(() => { setTargetKey(p => p + 1); }, [state.targetNote]);

  useEffect(() => {
    if (showSettingsHint) {
      const timer = setTimeout(() => setShowSettingsHint(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [showSettingsHint]);

  // Live timer tick
  useEffect(() => {
    if (!timerOn || state.roundComplete || state.mode === 'learn') {
      return;
    }
    const iv = setInterval(() => {
      if (state.roundKey > 0) {
        setLiveTime(Date.now());
      }
    }, 100);
    return () => clearInterval(iv);
  }, [timerOn, state.roundComplete, state.mode, state.roundKey]);

  const onCellClick = useCallback((s: string, f: number) => {
    const result = handleClick(s, f);
    if (result) {
      if ((result as any).learnMode) {
        // Learn mode: play the note at its actual string/fret position
        if (!muted) playCorrect((result as any).rawNote, (result as any).string, (result as any).fret);
        showToast(result.note, 'good');
      } else if (result.correct) {
        if (!muted) playCorrect(state.targetNote, (result as any).string, (result as any).fret);
        if (state.found + 1 >= state.total) {
          showToast('All found!', 'good');
          if (!muted) setTimeout(() => playComplete(), 120);
        }
      } else {
        if (!muted) playWrong();
        showToast(`That's ${result.note}`, 'bad');
      }
    }
    return result;
  }, [handleClick, showToast, state.found, state.total, state.targetNote, muted]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.key === ' ' || e.key === 'Enter') && state.roundComplete) {
        e.preventDefault();
        nextRound();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [state.roundComplete, nextRound]);

  const found = state.found;

  // Generate random hint positions based on hintPct and roundKey
  const mergedCellStates = useMemo(() => {
    if (hintPct === 0 || state.mode === 'learn') return cellStates;

    // Simple seeded pseudo-random from roundKey
    let seed = state.roundKey * 2654435761;
    const nextRand = () => {
      seed = (seed ^ (seed << 13)) >>> 0;
      seed = (seed ^ (seed >> 17)) >>> 0;
      seed = (seed ^ (seed << 5)) >>> 0;
      return (seed >>> 0) / 4294967296;
    };

    const merged = new Map(cellStates);

    // Collect all non-target positions that aren't already showing something
    const candidates: string[] = [];
    for (const s of state.activeStrings) {
      for (let f = 0; f <= state.maxFret; f++) {
        const key = `${s}:${f}`;
        const note = noteAt(s, f);
        if (note !== state.targetNote && !merged.has(key)) {
          candidates.push(key);
        }
      }
    }

    // Randomly select hintPct% of them
    const numHints = Math.round(candidates.length * hintPct / 100);
    // Fisher-Yates partial shuffle
    for (let i = 0; i < numHints && i < candidates.length; i++) {
      const j = i + Math.floor(nextRand() * (candidates.length - i));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
      merged.set(candidates[i], 'hint' as NoteState);
    }

    return merged;
  }, [cellStates, hintPct, state.roundKey, state.mode, state.activeStrings, state.maxFret, state.targetNote]);

  return (
    <div className="vignette grain min-h-[100dvh] flex flex-col relative">
      {/* Ambient stage glow */}
      <div className="stage-glow" />

      {/* ═══ TOP BAR: score + settings ═══ */}
      <div className="relative z-10 w-full px-3 sm:px-4 pt-3 sm:pt-5 flex flex-col sm:flex-row items-center sm:justify-between gap-1.5 sm:gap-4">
        {/* Score cluster (hidden in learn mode) */}
        {state.mode !== 'learn' && (
          <div className="flex items-baseline gap-2 sm:gap-3 font-mono text-[12px] sm:text-[14px] tracking-wider whitespace-nowrap">
            <span className="text-[hsl(35,18%,55%)]">
              <span className="text-[hsl(35,22%,78%)] font-bold">{state.score}</span>
              <span className="text-[hsl(20,8%,50%)] ml-1">pts</span>
            </span>
            <span className="text-[hsl(32,70%,52%)]">
              <span className="font-bold">{state.streak}</span>
              <span className="text-[hsl(20,8%,50%)] ml-1">streak</span>
            </span>
            {state.bestStreak > 0 && (
              <span className="text-[hsl(20,8%,50%)]">
                best <span className="text-[hsl(32,50%,45%)] font-bold">{state.bestStreak}</span>
              </span>
            )}
            {state.highScore > 0 && <span className="text-[hsl(20,8%,50%)]">hi <span className="text-[hsl(32,50%,45%)] font-bold">{state.highScore}</span></span>}
          </div>
        )}

        {/* Settings cluster - wraps on mobile */}
        <div className="relative flex items-center justify-center flex-wrap gap-1 sm:gap-3 font-mono text-[12px] sm:text-[14px] tracking-wider">
          {/* String picker */}
          <div className="flex gap-0">
            {STRING_OPTIONS.map((opt, i) => (
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

          <span className="text-[hsl(20,8%,30%)] text-[10px]">·</span>

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

          <span className="text-[hsl(20,8%,30%)] text-[10px]">·</span>

          {/* Sharps toggle */}
          <button
            className={cn(
              "px-1 py-1 cursor-pointer bg-transparent border-none outline-none transition-all duration-150",
              state.includeSharps
                ? "text-[hsl(32,90%,56%)]"
                : "text-[hsl(20,8%,48%)] hover:text-[hsl(20,8%,50%)]"
            )}
            style={{ fontFamily: 'inherit', fontSize: 'inherit', letterSpacing: 'inherit' }}
            onClick={() => changeSharps(!state.includeSharps)}
          >
            #
          </button>

          <span className="text-[hsl(20,8%,30%)] text-[10px]">·</span>

          {/* Mute toggle */}
          <button
            className={cn(
              "px-1 py-1 cursor-pointer bg-transparent border-none outline-none transition-all duration-150",
              !muted ? "text-[hsl(32,90%,56%)]" : "text-[hsl(20,8%,48%)] hover:text-[hsl(20,8%,50%)]"
            )}
            style={{ fontFamily: 'inherit', fontSize: 'inherit', letterSpacing: 'inherit' }}
            onClick={() => setMuted(m => !m)}
          >
            {muted ? '♪̸' : '♪'}
          </button>

          <span className="text-[hsl(20,8%,30%)] text-[10px]">·</span>

          {/* Timer toggle */}
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

          <span className="text-[hsl(20,8%,30%)] text-[10px]">·</span>

          {/* Learn/Quiz toggle */}
          {toggleMode && (
            <button
              className={cn(
                "px-1 py-1 cursor-pointer bg-transparent border-none outline-none transition-all duration-150",
                state.mode === 'learn'
                  ? "text-[hsl(32,90%,56%)]"
                  : "text-[hsl(20,8%,48%)] hover:text-[hsl(20,8%,50%)]"
              )}
              style={{ fontFamily: 'inherit', fontSize: 'inherit', letterSpacing: 'inherit' }}
              onClick={() => toggleMode()}
            >
              learn
            </button>
          )}

          <span className="text-[hsl(20,8%,30%)] text-[10px]">·</span>

          {/* Hints slider */}
          <div className="flex items-center gap-1.5">
            <span className={cn(
              "text-[11px]",
              hintPct > 0 ? "text-[hsl(32,90%,56%)]" : "text-[hsl(20,8%,48%)]"
            )}>
              hints
            </span>
            <input
              type="range"
              min={0}
              max={50}
              step={5}
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

          {showSettingsHint && (
            <div className="absolute -bottom-4 right-0 font-mono text-[8px] text-[hsl(32,50%,45%)] tracking-wider animate-fade-in"
              style={{ opacity: showSettingsHint ? 0.7 : 0 }}>
              settings
            </div>
          )}
        </div>
      </div>

      {/* ═══ CENTER: target note + fretboard ═══ */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-2 sm:px-3 py-2 sm:py-4 gap-2 sm:gap-5">

        {/* Target note - THE HERO */}
        <div className="text-center relative">
          {/* Atmospheric glow behind the note */}
          <div
            className="absolute left-1/2 top-1/2 pointer-events-none"
            style={{
              width: 280,
              height: 200,
              transform: 'translate(-50%, -50%)',
              background: 'radial-gradient(ellipse at center, hsla(32, 75%, 45%, 0.1) 0%, transparent 65%)',
              filter: 'blur(20px)',
              animation: 'target-glow-pulse 3s ease-in-out infinite',
            }}
          />

          {state.mode === 'learn' ? (
            <div className="text-[11px] sm:text-[12px] font-semibold tracking-[0.35em] uppercase text-[hsl(20,10%,58%)] mb-1 relative">
              LEARN MODE
            </div>
          ) : (
            <div className="text-[11px] sm:text-[12px] font-semibold tracking-[0.35em] uppercase text-[hsl(20,10%,58%)] mb-1 relative">
              Find all the
            </div>
          )}

          {state.mode !== 'learn' && (
            <div key={targetKey} className="animate-target-enter relative">
              <span
                className="font-display text-6xl sm:text-[110px] font-normal leading-none"
                style={{
                  color: 'hsl(38, 28%, 92%)',
                  textShadow: `
                    0 0 80px hsla(32, 60%, 50%, 0.12),
                    0 0 30px hsla(32, 60%, 50%, 0.06),
                    0 4px 8px rgba(0,0,0,0.4)
                  `,
                }}
              >
                {state.targetDisplay}
              </span>
            </div>
          )}

          {/* Progress + count (hidden in learn mode) */}
          {state.mode !== 'learn' && (
            <>
              <div className="mt-3 flex items-center justify-center gap-2 relative">
                {Array.from({ length: state.total }).map((_, i) => (
                  <div
                    key={`${state.roundKey}-${i}`}
                    className={cn("rounded-full transition-all", i < found ? "w-3.5 h-3.5" : "w-3 h-3")}
                    style={i < found ? {
                      background: 'radial-gradient(circle at 35% 30%, hsl(40,100%,68%), hsl(30,85%,48%))',
                      boxShadow: '0 0 8px hsla(32,90%,54%,0.45)',
                      animation: `progress-pop 0.28s cubic-bezier(0.34, 1.56, 0.64, 1) forwards`,
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
                  {state.total}
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

        {/* Next button (appears on round complete, hidden in learn mode) */}
        {state.roundComplete && state.mode !== 'learn' && (
          <div className="flex flex-col items-center gap-2 animate-fade-in">
            <button
              className="cursor-pointer border-none outline-none bg-transparent"
              style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '0.25em',
                textTransform: 'uppercase' as const,
                padding: '12px 24px',
                color: 'hsl(32,70%,58%)',
                textShadow: '0 0 20px hsla(32,80%,50%,0.3)',
              }}
              onClick={nextRound}
            >
              tap to continue
            </button>
            {state.roundTime !== undefined && state.roundTime > 0 && (
              <div className="font-mono text-[10px] text-[hsl(32,50%,45%)]">
                {(state.roundTime / 1000).toFixed(1)}s
              </div>
            )}
          </div>
        )}

        {/* ═══ THE FRETBOARD ═══ */}
        <div className="w-full overflow-x-auto fretboard-scroll" style={{ paddingLeft: 8, paddingRight: 8 }}>
          <div className="min-w-[560px] mx-auto">
            <Fretboard
              activeStrings={state.activeStrings}
              maxFret={state.maxFret}
              targetNote={state.targetNote}
              cellStates={mergedCellStates}
              roundComplete={state.roundComplete}
              roundKey={state.roundKey}
              onCellClick={onCellClick}
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

      {/* Misses - subtle, bottom right */}
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
