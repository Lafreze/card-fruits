let context: AudioContext | null = null;

function getContext() {
  if (!context) context = new AudioContext();
  if (context.state === "suspended") void context.resume();
  return context;
}

function tone({
  from,
  to = from,
  duration,
  type = "sine",
  gain = 0.04,
  delay = 0,
}: {
  from: number;
  to?: number;
  duration: number;
  type?: OscillatorType;
  gain?: number;
  delay?: number;
}) {
  try {
    const ctx = getContext();
    const oscillator = ctx.createOscillator();
    const volume = ctx.createGain();
    const start = ctx.currentTime + delay;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(Math.max(20, from), start);
    oscillator.frequency.exponentialRampToValueAtTime(
      Math.max(20, to),
      start + duration,
    );
    volume.gain.setValueAtTime(0.0001, start);
    volume.gain.exponentialRampToValueAtTime(gain, start + 0.004);
    volume.gain.exponentialRampToValueAtTime(
      0.0001,
      start + Math.max(0.018, duration),
    );
    oscillator.connect(volume).connect(ctx.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  } catch {
    // Audio is an enhancement; game input must still work if Web Audio is blocked.
  }
}

function juiceNoise({
  duration = 0.035,
  frequency = 2400,
  gain = 0.02,
  delay = 0,
  type = "bandpass",
}: {
  duration?: number;
  frequency?: number;
  gain?: number;
  delay?: number;
  type?: BiquadFilterType;
} = {}) {
  try {
    const ctx = getContext();
    const frameCount = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, frameCount, ctx.sampleRate);
    const channel = buffer.getChannelData(0);
    for (let index = 0; index < frameCount; index += 1) {
      const fade = 1 - index / frameCount;
      channel[index] = (Math.random() * 2 - 1) * fade ** 1.7;
    }
    const source = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const volume = ctx.createGain();
    const start = ctx.currentTime + delay;
    source.buffer = buffer;
    filter.type = type;
    filter.frequency.setValueAtTime(frequency, start);
    filter.Q.setValueAtTime(type === "bandpass" ? 1.2 : 0.7, start);
    volume.gain.setValueAtTime(gain, start);
    volume.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(filter).connect(volume).connect(ctx.destination);
    source.start(start);
  } catch {
    // Keep gameplay silent instead of failing when audio is unavailable.
  }
}

function fruitPluck(frequency: number, delay = 0, gain = 0.04) {
  tone({
    from: frequency * 1.08,
    to: frequency,
    duration: 0.055,
    type: "sine",
    gain,
    delay,
  });
  tone({
    from: frequency * 2.02,
    to: frequency * 1.72,
    duration: 0.034,
    type: "triangle",
    gain: gain * 0.38,
    delay,
  });
}

export const sounds = {
  tap: () => {
    fruitPluck(960, 0, 0.026);
    juiceNoise({ duration: 0.018, frequency: 3600, gain: 0.009 });
  },
  match: () => {
    juiceNoise({ duration: 0.045, frequency: 2900, gain: 0.028 });
    [720, 940, 1220].forEach((frequency, index) =>
      fruitPluck(frequency, index * 0.042, 0.045 - index * 0.005),
    );
  },
  rain: (count: number) => {
    for (let index = 0; index < count; index += 1) {
      fruitPluck(650 + index * 125, index * 0.052, 0.028);
      juiceNoise({
        duration: 0.022,
        frequency: 2500 + index * 260,
        gain: 0.008,
        delay: index * 0.052,
      });
    }
  },
  launch: () => {
    juiceNoise({
      duration: 0.09,
      frequency: 1800,
      gain: 0.018,
      type: "highpass",
    });
    tone({
      from: 480,
      to: 820,
      duration: 0.11,
      type: "sine",
      gain: 0.027,
    });
  },
  impact: (strength: number) => {
    const weight = Math.max(0, Math.min(1, strength));
    const pitch = 520 - weight * 135;
    fruitPluck(pitch, 0, 0.012 + weight * 0.018);
    juiceNoise({
      duration: 0.018 + weight * 0.018,
      frequency: 3200 - weight * 900,
      gain: 0.004 + weight * 0.01,
    });
  },
  merge: (tier: number) => {
    const root = Math.min(1060, 560 + tier * 26);
    juiceNoise({
      duration: 0.07,
      frequency: 2600 + Math.min(900, tier * 55),
      gain: 0.032,
    });
    fruitPluck(root, 0, 0.052);
    fruitPluck(root * 1.26, 0.055, 0.042);
    fruitPluck(root * 1.5, 0.105, 0.035);
  },
  win: () => {
    juiceNoise({ duration: 0.08, frequency: 3400, gain: 0.025 });
    [659, 784, 988, 1318].forEach((frequency, index) =>
      fruitPluck(frequency, index * 0.085, 0.05),
    );
  },
  lose: () => {
    tone({
      from: 390,
      to: 250,
      duration: 0.28,
      type: "sine",
      gain: 0.038,
    });
    juiceNoise({
      duration: 0.07,
      frequency: 900,
      gain: 0.012,
      type: "lowpass",
    });
  },
};

export function haptic(pattern: number | number[] = 12) {
  if ("vibrate" in navigator) navigator.vibrate(pattern);
}
