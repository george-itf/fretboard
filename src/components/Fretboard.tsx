import { useCallback, useMemo, useState, type FC } from 'react';
import { noteAt, displayNote, type NoteState } from '@/hooks/useGame';
import { cn } from '@/lib/utils';

const DOT_FRETS = new Set([3, 5, 7, 9]);
const DOUBLE_DOT_FRETS = new Set([12]);
const ROW_H = 82;

/**
 * Real fret spacing: on a fretted instrument, the width of fret space N
 * is proportional to 1 / 2^((N-1)/12).
 * Fret 1 is widest, fret 12 is ~53% of fret 1's width.
 */
function computeFretWidths(maxFret: number): number[] {
  const raw: number[] = [];
  for (let f = 1; f <= maxFret; f++) {
    raw.push(1 / Math.pow(2, (f - 1) / 12));
  }
  const total = raw.reduce((a, b) => a + b, 0);
  return raw.map(w => (w / total) * 100); // percentages
}

interface FretboardProps {
  activeStrings: string[];
  maxFret: number;
  targetNote: string;
  cellStates: Map<string, NoteState>;
  roundComplete: boolean;
  roundKey: number;
  onCellClick: (s: string, f: number) => { correct: boolean; note: string } | undefined;
}

const Fretboard: FC<FretboardProps> = ({
  activeStrings, maxFret, cellStates, roundComplete, roundKey, onCellClick,
}) => {
  const frets = Array.from({ length: maxFret }, (_, i) => i + 1);
  const widths = useMemo(() => computeFretWidths(maxFret), [maxFret]);

  return (
    <div className="w-full mx-auto no-select">
      {/* Fret numbers */}
      <div className="flex ml-[52px] mb-2.5" aria-hidden="true">
        {frets.map((f, i) => (
          <div
            key={f}
            className={cn(
              "text-center font-mono text-[13px] font-semibold tracking-widest",
              DOUBLE_DOT_FRETS.has(f)
                ? "text-[hsl(32,70%,65%)] font-bold"
                : DOT_FRETS.has(f)
                  ? "text-[hsl(32,65%,60%)]"
                  : "text-[hsl(20,8%,50%)]"
            )}
            style={{ width: `${widths[i]}%` }}
          >
            {f}
          </div>
        ))}
      </div>

      {/* ═══ THE NECK ═══ */}
      <div
        className={cn(
          "fretboard-wood relative overflow-hidden",
          roundComplete && "round-sweep-overlay"
        )}
        style={{
          borderRadius: '2px 8px 8px 2px',
          boxShadow: `
            0 1px 0 hsla(35,22%,35%,0.2) inset,
            0 -1px 0 hsla(0,0%,0%,0.3) inset,
            0 8px 40px rgba(0,0,0,0.5),
            0 2px 8px rgba(0,0,0,0.3)
          `,
          border: '1px solid hsla(25,14%,28%,0.7)',
        }}
        key={roundKey}
      >
        {activeStrings.map((s, si) => (
          <StringRow
            key={`${s}-${roundKey}`}
            stringName={s}
            stringIndex={si}
            maxFret={maxFret}
            fretWidths={widths}
            cellStates={cellStates}
            onClick={onCellClick}
          />
        ))}
      </div>

      {/* Inlay dots below */}
      <div className="flex ml-[52px] mt-3" aria-hidden="true">
        {frets.map((f, i) => (
          <div
            key={f}
            className="flex justify-center"
            style={{ width: `${widths[i]}%` }}
          >
            {DOT_FRETS.has(f) && <InlayDot />}
            {DOUBLE_DOT_FRETS.has(f) && (
              <div className="flex gap-2"><InlayDot /><InlayDot /></div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

/* ─────────── STRING ROW ─────────── */

interface StringRowProps {
  stringName: string;
  stringIndex: number;
  maxFret: number;
  fretWidths: number[];
  cellStates: Map<string, NoteState>;
  onClick: (s: string, f: number) => { correct: boolean; note: string } | undefined;
}

const StringRow: FC<StringRowProps> = ({
  stringName, stringIndex, maxFret, fretWidths, cellStates, onClick,
}) => {
  const [vibrating, setVibrating] = useState(false);
  const thickness = [1.8, 2.5, 3.5, 5][stringIndex] ?? 2.5;
  const isWound = stringIndex >= 2;
  const frets = Array.from({ length: maxFret }, (_, i) => i + 1);
  const openState = cellStates.get(`${stringName}:0`);

  const handleClick = useCallback((fret: number) => {
    const result = onClick(stringName, fret);
    if (result?.correct) {
      setVibrating(true);
      setTimeout(() => setVibrating(false), 400);
    }
    return result;
  }, [onClick, stringName]);

  const stringGrad = isWound
    ? `linear-gradient(to bottom,
        rgba(160,142,100,0.25) 0%,
        rgba(200,182,140,0.9) 25%,
        rgba(225,210,175,1) 50%,
        rgba(200,182,140,0.9) 75%,
        rgba(160,142,100,0.25) 100%)`
    : `linear-gradient(to bottom,
        rgba(195,190,172,0.2) 0%,
        rgba(232,226,210,0.92) 25%,
        rgba(252,248,238,1) 50%,
        rgba(232,226,210,0.92) 75%,
        rgba(195,190,172,0.2) 100%)`;

  return (
    <div
      className={cn("flex items-center relative", stringIndex > 0 && "border-t border-[hsla(15,10%,12%,0.6)]")}
      style={{ height: ROW_H }}
    >
      {/* String shadow */}
      <div
        className="absolute pointer-events-none z-[1]"
        style={{
          left: 52, right: 0, top: '50%',
          height: thickness + 4,
          marginTop: -(thickness + 4) / 2 + 1.5,
          background: isWound ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.25)',
          filter: 'blur(2.5px)',
        }}
      />

      {/* String wire */}
      <div
        className={cn("absolute pointer-events-none z-[2]", vibrating && "animate-vibrate")}
        style={{
          left: 52, right: 0, top: '50%',
          height: thickness,
          marginTop: -thickness / 2,
          background: stringGrad,
          borderRadius: thickness,
        }}
      />

      {/* Open string / Nut label */}
      <button
        className={cn(
          "w-[52px] flex-shrink-0 h-full flex items-center justify-center relative z-[5]",
          "text-[17px] font-bold tracking-[0.15em] cursor-pointer",
          "border-none bg-transparent transition-all duration-200 rounded-sm",
          "hover:bg-[hsla(32,40%,50%,0.12)] active:bg-[hsla(32,40%,50%,0.2)]",
        )}
        style={{
          fontFamily: 'inherit',
          color: openState === 'correct' ? 'hsl(32,95%,62%)' : 'hsl(30,16%,68%)',
          textShadow: openState === 'correct' ? '0 0 14px hsla(32,95%,54%,0.6)' : 'none',
          borderRight: '2px solid hsla(42,30%,60%,0.3)',
        }}
        onClick={() => handleClick(0)}
      >
        {stringName}
      </button>

      {/* Fret cells */}
      <div className="flex flex-1">
        {frets.map((f, i) => (
          <FretCell
            key={f}
            stringName={stringName}
            fret={f}
            widthPct={fretWidths[i]}
            state={cellStates.get(`${stringName}:${f}`)}
            onClick={() => handleClick(f)}
          />
        ))}
      </div>
    </div>
  );
};

/* ─────────── FRET CELL ─────────── */

interface FretCellProps {
  stringName: string;
  fret: number;
  widthPct: number;
  state: NoteState | undefined;
  onClick: () => void;
}

const FretCell: FC<FretCellProps> = ({ stringName, fret, widthPct, state, onClick }) => {
  const note = noteAt(stringName, fret);
  const isDot = DOT_FRETS.has(fret);
  const isDouble = DOUBLE_DOT_FRETS.has(fret);
  const isNut = fret === 1;
  const isOctave = fret === 12;

  return (
    <button
      className={cn(
        "flex items-center justify-center relative z-[3] cursor-pointer",
        "border-none bg-transparent transition-all duration-75 outline-none",
        !state && "hover:bg-[hsla(35,30%,60%,0.15)] active:bg-[hsla(35,30%,60%,0.22)]",
      )}
      style={{ height: ROW_H, width: `${widthPct}%` }}
      onClick={onClick}
    >
      {/* Fret wire - bright chrome */}
      <div
        className="absolute left-0 top-[2px] bottom-[2px] z-[4]"
        style={{
          width: isNut ? 7 : 3,
          background: isNut
            ? `linear-gradient(180deg,
                hsl(42,30%,76%) 0%, hsl(42,38%,90%) 30%,
                hsl(44,42%,94%) 50%,
                hsl(42,38%,90%) 70%, hsl(42,30%,76%) 100%)`
            : isOctave
              ? `linear-gradient(180deg,
                  hsla(40,30%,45%,0.5) 0%,
                  hsla(42,35%,68%,0.95) 20%,
                  hsla(45,40%,82%,1) 50%,
                  hsla(42,35%,68%,0.95) 80%,
                  hsla(40,30%,45%,0.5) 100%)`
              : `linear-gradient(180deg,
                  hsla(38,10%,38%,0.5) 0%,
                  hsla(40,14%,62%,0.95) 20%,
                  hsla(42,18%,78%,1) 50%,
                  hsla(40,14%,62%,0.95) 80%,
                  hsla(38,10%,38%,0.5) 100%)`,
          boxShadow: isNut
            ? '1px 0 5px rgba(0,0,0,0.4), 2px 0 2px rgba(0,0,0,0.15)'
            : '0 0 4px rgba(200,190,170,0.08), 1px 0 3px rgba(0,0,0,0.2)',
        }}
      />

      {/* Pearl inlay */}
      {(isDot || isDouble) && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[0]">
          {isDot && <PearlInlay />}
          {isDouble && (
            <div className="flex flex-col gap-4">
              <PearlInlay size={9} />
              <PearlInlay size={9} />
            </div>
          )}
        </div>
      )}

      {/* Note circle - scales down on narrow frets */}
      {state && <NoteCircle state={state} note={note} compact={widthPct < 7} />}
    </button>
  );
};

/* ─────────── PEARL INLAY ─────────── */

const PearlInlay: FC<{ size?: number }> = ({ size = 14 }) => (
  <div
    className="rounded-full"
    style={{
      width: size, height: size,
      background: `radial-gradient(circle at 35% 30%,
        hsla(48,30%,88%,0.7), hsla(42,20%,72%,0.55) 50%, hsla(35,15%,58%,0.4))`,
    }}
  />
);

const InlayDot: FC = () => (
  <div
    className="w-[9px] h-[9px] rounded-full"
    style={{
      background: 'radial-gradient(circle at 40% 35%, hsl(38,18%,58%), hsl(30,12%,42%))',
    }}
  />
);

/* ─────────── NOTE CIRCLE ─────────── */

const NoteCircle: FC<{ state: NoteState; note: string; compact?: boolean }> = ({ state, note, compact }) => (
  <div
    className={cn(
      "rounded-full flex items-center justify-center",
      "font-mono font-bold relative z-[6] select-none",
      state === 'hint'
        ? (compact ? "w-[32px] h-[32px] text-[10px]" : "w-[38px] h-[38px] text-[11px]")
        : (compact ? "w-[38px] h-[38px] text-[11px]" : "w-[48px] h-[48px] text-[13px]"),
      state === 'correct' && "animate-bloom",
      state === 'wrong' && "animate-shake",
      state === 'revealed' && "animate-reveal",
    )}
    style={{
      ...(state === 'correct' ? {
        background: 'radial-gradient(circle at 38% 32%, hsl(42,100%,72%), hsl(34,92%,56%) 55%, hsl(28,85%,45%))',
        color: 'hsl(20,40%,8%)',
      } : state === 'wrong' ? {
        background: 'radial-gradient(circle at 40% 35%, hsl(0,72%,60%), hsl(0,65%,42%))',
        color: 'hsla(0,0%,100%,0.95)',
      } : state === 'hint' ? {
        background: 'hsla(25,20%,15%,0.6)',
        border: '1px solid hsla(25,15%,35%,0.4)',
        color: 'hsl(25,12%,52%)',
      } : {
        background: 'hsla(25,30%,18%,0.85)',
        border: '2px solid hsla(32,40%,55%,0.6)',
        color: 'hsl(38,30%,82%)',
      }),
    }}
  >
    <span className="leading-none">{displayNote(note)}</span>
  </div>
);

export default Fretboard;
