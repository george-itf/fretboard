// Bass guitar sound engine
//
// Uses PeriodicWave to create a waveform modeled on real bass guitar
// harmonic content. A P-bass pickup's frequency spectrum has strong
// fundamental, strong 2nd harmonic, moderate 3rd, and rapidly falling
// higher partials. We recreate that exact harmonic profile.
//
// Combined with proper ADSR envelope and a sweeping low-pass filter
// (mimicking how string vibration loses highs over time), this gives
// a warm, round, convincingly bassy tone on any speaker.

const OPEN_STRING_FREQ: Record<string, number> = {
  'E': 41.20, 'A': 55.00, 'D': 73.42, 'G': 98.00,
};

const SEMITONE = Math.pow(2, 1 / 12);

function getFreq(stringName: string, fret: number): number {
  return (OPEN_STRING_FREQ[stringName] || 82.41) * Math.pow(SEMITONE, fret);
}

const NOTE_FREQ_FALLBACK: Record<string, number> = {
  'C': 65.41, 'C#': 69.30, 'D': 73.42, 'D#': 77.78,
  'E': 82.41, 'F': 87.31, 'F#': 92.50, 'G': 98.00,
  'G#': 103.83, 'A': 110.00, 'A#': 116.54, 'B': 123.47,
};

let ctx: AudioContext | null = null;
let bassWave: PeriodicWave | null = null;

function getCtx(): AudioContext {
  if (!ctx) {
    ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

/**
 * Build a PeriodicWave that matches the harmonic profile of a
 * Fender Precision Bass (neck pickup, fingerstyle).
 *
 * Harmonic amplitudes based on spectral analysis of bass recordings:
 * H1 (fundamental): 1.0
 * H2 (octave):      0.8   - very strong, gives the "body"
 * H3 (fifth):       0.4   - moderate, adds warmth
 * H4 (2nd octave):  0.25  - presence
 * H5:               0.12
 * H6:               0.06
 * H7+:              rapidly diminishing
 */
function getBassWave(ac: AudioContext): PeriodicWave {
  if (bassWave) return bassWave;

  const real = new Float32Array(16);
  const imag = new Float32Array(16);

  // DC offset = 0
  real[0] = 0; imag[0] = 0;

  // Harmonic amplitudes (imag = sine components)
  const harmonics = [
    1.0,    // H1: fundamental
    0.8,    // H2: octave - strong like a real bass
    0.4,    // H3: fifth above octave
    0.25,   // H4: two octaves up
    0.12,   // H5
    0.06,   // H6
    0.03,   // H7
    0.015,  // H8
    0.008,  // H9
    0.004,  // H10
    0.002,  // H11
    0.001,  // H12
    0.0005, // H13
    0.0003, // H14
    0.0001, // H15
  ];

  for (let i = 0; i < harmonics.length; i++) {
    real[i + 1] = 0;
    imag[i + 1] = harmonics[i];
  }

  bassWave = ac.createPeriodicWave(real, imag, { disableNormalization: false });
  return bassWave;
}

export function playCorrect(note?: string, stringName?: string, fret?: number) {
  try {
    const ac = getCtx();
    const t = ac.currentTime;

    let freq: number;
    if (stringName && fret !== undefined) {
      freq = getFreq(stringName, fret);
    } else {
      freq = note ? (NOTE_FREQ_FALLBACK[note] || 82.41) : 82.41;
    }

    // --- Oscillator with bass guitar harmonic profile ---
    const osc = ac.createOscillator();
    osc.setPeriodicWave(getBassWave(ac));
    osc.frequency.setValueAtTime(freq, t);
    // Slight pitch bend on attack (string stretch when plucked)
    osc.frequency.setValueAtTime(freq * 1.006, t);
    osc.frequency.exponentialRampToValueAtTime(freq, t + 0.04);

    // --- Filter: sweeps from bright to dark (string losing energy) ---
    const filter = ac.createBiquadFilter();
    filter.type = 'lowpass';
    // Attack is brighter, then darkens. Like a real plucked string.
    filter.frequency.setValueAtTime(1800, t);
    filter.frequency.exponentialRampToValueAtTime(600, t + 0.08);
    filter.frequency.exponentialRampToValueAtTime(280, t + 0.35);
    filter.Q.setValueAtTime(0.8, t);

    // --- Amp envelope: fast attack, medium sustain, controlled decay ---
    const amp = ac.createGain();
    amp.gain.setValueAtTime(0.0, t);
    amp.gain.linearRampToValueAtTime(0.75, t + 0.005);  // 5ms attack
    amp.gain.setValueAtTime(0.75, t + 0.02);
    amp.gain.exponentialRampToValueAtTime(0.35, t + 0.15);  // Quick initial drop
    amp.gain.exponentialRampToValueAtTime(0.08, t + 0.45);  // Sustain fades
    amp.gain.exponentialRampToValueAtTime(0.001, t + 0.7);  // Done

    // --- Chain ---
    osc.connect(filter);
    filter.connect(amp);
    amp.connect(ac.destination);

    osc.start(t);
    osc.stop(t + 0.75);

  } catch (e) {}
}

export function playWrong() {
  try {
    const ac = getCtx();
    const t = ac.currentTime;

    // Quick muted thump
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

  } catch (e) {}
}

export function playComplete() {
  try {
    const ac = getCtx();
    const t = ac.currentTime;

    const freqs = [41.20, 55.00, 73.42, 98.00]; // E-A-D-G

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

  } catch (e) {}
}
