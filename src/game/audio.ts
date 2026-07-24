let context: AudioContext | null = null;
let master: GainNode | null = null;

function getContext() {
  if (!context) {
    context = new AudioContext();
    const compressor = context.createDynamicsCompressor();
    compressor.threshold.value = -22;
    compressor.knee.value = 18;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.004;
    compressor.release.value = 0.16;
    master = context.createGain();
    master.gain.value = 0.78;
    master.connect(compressor).connect(context.destination);
  }
  if (context.state === "suspended") void context.resume();
  return context;
}

function getOutput() {
  getContext();
  return master!;
}

function tone({
  from,
  to = from,
  duration,
  type = "sine",
  gain = 0.04,
  delay = 0,
  attack = 0.004,
}: {
  from: number;
  to?: number;
  duration: number;
  type?: OscillatorType;
  gain?: number;
  delay?: number;
  attack?: number;
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
    volume.gain.exponentialRampToValueAtTime(
      gain,
      start + Math.min(attack, duration * 0.25),
    );
    volume.gain.exponentialRampToValueAtTime(
      0.0001,
      start + Math.max(0.018, duration),
    );
    oscillator.connect(volume).connect(getOutput());
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
  q = type === "bandpass" ? 0.9 : 0.62,
}: {
  duration?: number;
  frequency?: number;
  gain?: number;
  delay?: number;
  type?: BiquadFilterType;
  q?: number;
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
    filter.Q.setValueAtTime(q, start);
    volume.gain.setValueAtTime(0.0001, start);
    volume.gain.exponentialRampToValueAtTime(
      gain,
      start + Math.min(0.003, duration * 0.2),
    );
    volume.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(filter).connect(volume).connect(getOutput());
    source.start(start);
  } catch {
    // Keep gameplay silent instead of failing when audio is unavailable.
  }
}

function softPluck(frequency: number, delay = 0, gain = 0.032) {
  tone({
    from: frequency * 1.025,
    to: frequency,
    duration: 0.082,
    type: "sine",
    gain,
    delay,
    attack: 0.006,
  });
  tone({
    from: frequency * 1.5,
    to: frequency * 1.46,
    duration: 0.046,
    type: "triangle",
    gain: gain * 0.16,
    delay: delay + 0.004,
    attack: 0.003,
  });
}

function softImpact(strength: number, delay = 0) {
  const weight = Math.max(0, Math.min(1, strength));
  tone({
    from: 154 - weight * 34,
    to: 82 - weight * 16,
    duration: 0.075 + weight * 0.045,
    type: "sine",
    gain: 0.018 + weight * 0.033,
    delay,
    attack: 0.002,
  });
  tone({
    from: 292 - weight * 42,
    to: 205 - weight * 35,
    duration: 0.038 + weight * 0.018,
    type: "triangle",
    gain: 0.004 + weight * 0.009,
    delay,
    attack: 0.0015,
  });
  juiceNoise({
    duration: 0.026 + weight * 0.03,
    frequency: 1050 + weight * 420,
    gain: 0.004 + weight * 0.012,
    delay,
    type: "lowpass",
    q: 0.48,
  });
}

export const sounds = {
  tap: () => {
    softPluck(520, 0, 0.018);
    juiceNoise({
      duration: 0.016,
      frequency: 2200,
      gain: 0.0045,
      type: "lowpass",
    });
  },
  match: () => {
    softImpact(0.42);
    [420, 525, 630].forEach((frequency, index) =>
      softPluck(frequency, 0.018 + index * 0.052, 0.031 - index * 0.003),
    );
  },
  rain: (count: number) => {
    for (let index = 0; index < count; index += 1) {
      const delay = index * 0.064;
      softImpact(0.26 + index * 0.08, delay);
      softPluck(360 + index * 70, delay + 0.012, 0.017);
      juiceNoise({
        duration: 0.018,
        frequency: 1800 + index * 170,
        gain: 0.0035,
        delay,
        type: "lowpass",
      });
    }
  },
  launch: () => {
    juiceNoise({
      duration: 0.105,
      frequency: 1250,
      gain: 0.011,
      type: "lowpass",
      q: 0.45,
    });
    tone({
      from: 205,
      to: 355,
      duration: 0.105,
      type: "sine",
      gain: 0.024,
      attack: 0.012,
    });
    softImpact(0.24, 0.07);
  },
  impact: (strength: number) => {
    softImpact(strength);
  },
  merge: (tier: number) => {
    const weight = Math.min(1, 0.5 + tier * 0.025);
    const root = Math.min(420, 310 + tier * 5);
    softImpact(weight);
    juiceNoise({
      duration: 0.052,
      frequency: 1750 + Math.min(520, tier * 24),
      gain: 0.009 + weight * 0.005,
      type: "lowpass",
      q: 0.55,
    });
    softPluck(root, 0.026, 0.034);
    softPluck(root * 1.25, 0.078, 0.027);
    softPluck(root * 1.5, 0.13, 0.021);
  },
  win: () => {
    softImpact(0.72);
    juiceNoise({
      duration: 0.06,
      frequency: 2100,
      gain: 0.008,
      type: "lowpass",
    });
    [392, 494, 587, 784].forEach((frequency, index) =>
      softPluck(frequency, 0.035 + index * 0.09, 0.032 - index * 0.003),
    );
  },
  lose: () => {
    softImpact(0.38);
    tone({
      from: 260,
      to: 190,
      duration: 0.24,
      type: "sine",
      gain: 0.024,
      delay: 0.035,
      attack: 0.012,
    });
    juiceNoise({
      duration: 0.055,
      frequency: 720,
      gain: 0.006,
      type: "lowpass",
      delay: 0.035,
    });
  },
};

export function haptic(pattern: number | number[] = 12) {
  if ("vibrate" in navigator) navigator.vibrate(pattern);
}
