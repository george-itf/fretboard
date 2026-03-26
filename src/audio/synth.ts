// ─── Bass Guitar Sound Engine ───
//
// Web Audio API synthesis modeled on a Fender P-Bass (neck pickup, fingerstyle).
// No samples needed. PeriodicWave recreates the harmonic profile:
//   H1 (fundamental): 1.0
//   H2 (octave):      0.8  — gives the "body"
//   H3 (fifth):       0.4  — warmth
//   H4 (2nd octave):  0.25 — presence
//   H5–H15:           rapid decay
//
// Combined with ADSR envelope + sweeping low-pass filter (string losing
// high-frequency energy after pluck), this gives a warm, round, convincingly
// bassy tone on any speaker.

const OPEN_STRING_FREQ: Record<string, number> = {
  E: 41.20, A: 55.00, D: 73.42, G: 98.00,
};

const SEMITONE = Math.pow(2, 1 / 12);

function getFreq(stringName: string, fret: number): number {
  return (OPEN_STRING_FREQ[stringName] || 82.41) * Math.pow(SEMITONE, fret);
}

const NOTE_FREQ_FALLBACK: Record<string, number> = {
  C: 65.41, 'C#': 69.30, D: 73.42, 'D#': 77.78,
  E: 82.41, F: 87.31, 'F#': 92.50, G: 98.00,
  'G#': 103.83, A: 110.00, 'A#': 116.54, B: 123.47,
};

let ctx: AudioContext | null = null;
let bassWave: PeriodicWave | null = null;

function getCtx(): AudioContext {
  if (!ctx) {
    ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function getBassWave(ac: AudioContext): PeriodicWave {
  if (bassWave) return bassWave;

  const real = new Float32Array(16);
  const imag = new Float32Array(16);
  real[0] = 0; imag[0] = 0;

  const harmonics = [
    1.0, 0.8, 0.4, 0.25, 0.12, 0.06, 0.03, 0.015,
    0.008, 0.004, 0.002, 0.001, 0.0005, 0.0003, 0.0001,
  ];

  for (let i = 0; i < harmonics.length; i++) {
    real[i + 1] = 0;
    imag[i + 1] = harmonics[i];
  }

  bassWave = ac.createPeriodicWave(real, imag, { disableNormalization: false });
  return bassWave;
}

/**
 * Play a correct-answer bass note.
 * 750ms total: fast pluck attack, filter sweep from bright to dark,
 * subtle pitch bend on attack (string stretch).
 */
export function playCorrect(note?: string, stringName?: string, fret?: number): void {
  try {
    const ac = getCtx();
    const t = ac.currentTime;

    let freq: number;
    if (stringName && fret !== undefined) {
      freq = getFreq(stringName, fret);
    } else {
      freq = note ? (NOTE_FREQ_FALLBACK[note] || 82.41) : 82.41;
    }

    const osc = ac.createOscillator();
    osc.setPeriodicWave(getBassWave(ac));
    osc.frequency.setValueAtTime(freq * 1.006, t);
    osc.frequency.exponentialRampToValueAtTime(freq, t + 0.04);

    const filter = ac.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1800, t);
    filter.frequency.exponentialRampToValueAtTime(600, t + 0.08);
    filter.frequency.exponentialRampToValueAtTime(280, t + 0.35);
    filter.Q.setValueAtTime(0.8, t);

    const amp = ac.createGain();
    amp.gain.setValueAtTime(0.0, t);
    amp.gain.linearRampToValueAtTime(0.75, t + 0.005);
    amp.gain.setValueAtTime(0.75, t + 0.02);
    amp.gain.exponentialRampToValueAtTime(0.35, t + 0.15);
    amp.gain.exponentialRampToValueAtTime(0.08, t + 0.45);
    amp.gain.exponentialRampToValueAtTime(0.001, t + 0.7);

    osc.connect(filter);
    filter.connect(amp);
    amp.connect(ac.destination);
    osc.start(t);
    osc.stop(t + 0.75);
  } catch (_) { /* Audio not available */ }
}

/** Wrong answer: 120ms muted thump at 65Hz. Intentionally unsatisfying. */
export function playWrong(): void {
  try {
    const ac = getCtx();
    const t = ac.currentTime;

    const osc = ac.createOscillator();
    osc.setPeriodicWave(getBassWave(ac));
    osc.frequency.setValueAtTime(65, t);

    const filter = ac.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(300, t);
    filter.frequency.exponentialRampToValueAtTime(80, t + 0.06);

    const amp = ac.createGain();
    amp.gain.setValueAtTime(0.0, t);
    amp.gain.linearRampToValueAtTime(0.35, t + 0.004);
    amp.gain.exponentialRampToValueAtTime(0.001, t + 0.1);

    osc.connect(filter);
    filter.connect(amp);
    amp.connect(ac.destination);
    osc.start(t);
    osc.stop(t + 0.12);
  } catch (_) { /* Audio not available */ }
}

/** Round complete: ascending arpeggio E-A-D-G, staggered 100ms apart. */
export function playComplete(): void {
  try {
    const ac = getCtx();
    const t = ac.currentTime;
    const freqs = [41.20, 55.00, 73.42, 98.00];

    freqs.forEach((freq, i) => {
      const offset = i * 0.1;

      const osc = ac.createOscillator();
      osc.setPeriodicWave(getBassWave(ac));
      osc.frequency.setValueAtTime(freq * 1.005, t + offset);
      osc.frequency.exponentialRampToValueAtTime(freq, t + offset + 0.03);

      const filter = ac.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1400, t + offset);
      filter.frequency.exponentialRampToValueAtTime(300, t + offset + 0.25);

      const amp = ac.createGain();
      amp.gain.setValueAtTime(0.0, t + offset);
      amp.gain.linearRampToValueAtTime(0.5, t + offset + 0.005);
      amp.gain.setValueAtTime(0.5, t + offset + 0.02);
      amp.gain.exponentialRampToValueAtTime(0.2, t + offset + 0.12);
      amp.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.5);

      osc.connect(filter);
      filter.connect(amp);
      amp.connect(ac.destination);
      osc.start(t + offset);
      osc.stop(t + offset + 0.55);
    });
  } catch (_) { /* Audio not available */ }
}
