let context: AudioContext | null = null;

function getContext() {
  if (!context) context = new AudioContext();
  if (context.state === "suspended") void context.resume();
  return context;
}

function note(frequency: number, duration: number, type: OscillatorType, gain = 0.06, delay = 0) {
  try {
    const ctx = getContext();
    const oscillator = ctx.createOscillator();
    const volume = ctx.createGain();
    const start = ctx.currentTime + delay;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    oscillator.frequency.exponentialRampToValueAtTime(frequency * 1.18, start + duration);
    volume.gain.setValueAtTime(0.0001, start);
    volume.gain.exponentialRampToValueAtTime(gain, start + 0.012);
    volume.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(volume).connect(ctx.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.03);
  } catch {
    // Sound is an enhancement; game input should never fail if audio is blocked.
  }
}

export const sounds = {
  tap: () => note(420, 0.07, "sine", 0.035),
  match: () => {
    note(520, 0.13, "triangle", 0.065);
    note(780, 0.16, "triangle", 0.05, 0.055);
  },
  rain: (count: number) => {
    for (let index = 0; index < count; index += 1)
      note(360 + index * 95, 0.11, "sine", 0.035, index * 0.045);
  },
  launch: () => {
    note(250, 0.12, "triangle", 0.045);
    note(510, 0.16, "sine", 0.035, 0.025);
  },
  merge: (tier: number) => {
    const root = 210 + tier * 28;
    note(root, 0.2, "sine", 0.075);
    note(root * 1.5, 0.24, "triangle", 0.05, 0.035);
  },
  win: () => {
    [523, 659, 784, 1047].forEach((frequency, index) => note(frequency, 0.34, "triangle", 0.06, index * 0.09));
  },
  lose: () => {
    note(210, 0.35, "sawtooth", 0.04);
    note(130, 0.45, "sine", 0.06, 0.15);
  },
};

export function haptic(pattern: number | number[] = 12) {
  if ("vibrate" in navigator) navigator.vibrate(pattern);
}
