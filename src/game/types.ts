import type { WeatherSnapshot } from "./events";
import type { Difficulty } from "./challenges";
import type { GameMode, RelicId, ToolId } from "./modes";

export type GameStatus = "playing" | "won" | "lost";

export type GameSnapshot = {
  status: GameStatus;
  score: number;
  combo: number;
  maxCombo: number;
  maxFruitTier: number;
  remainingCards: number;
  trayCount: number;
  trayLimit: number;
  dangerProgress: number;
  undoLeft: number;
  shuffleLeft: number;
  juiceLeft: number;
  hammerLeft: number;
  magnetLeft: number;
  wildLeft: number;
  bubbleLeft: number;
  sunLeft: number;
  ripenLeft: number;
  splitLeft: number;
  bombLeft: number;
  shieldLeft: number;
  harvestLeft: number;
  quakeLeft: number;
  basketLeft: number;
  syrupLeft: number;
  insightLeft: number;
  vortexLeft: number;
  cushionLeft: number;
  barometerLeft: number;
  cushionSeconds: number;
  insightSeconds: number;
  vortexSeconds: number;
  weather: WeatherSnapshot;
  wave: number;
  mode: GameMode;
  relics: RelicId[];
  feverEnergy: number;
  feverActive: boolean;
  mutator: string;
  mutatorHint: string;
  dropLane: -1 | 0 | 1;
  difficulty: Difficulty;
  timeLeft: number | null;
  challengeKey: string;
};

export type GameResult = GameSnapshot & {
  reason: string;
  durationMs: number;
};

export type GameCallbacks = {
  onSnapshot: (snapshot: GameSnapshot) => void;
  onFinish: (result: GameResult) => void;
  onToast: (message: string, tone?: "gold" | "pink" | "cyan") => void;
};

export type GameUpgrades = {
  fever?: number;
  danger?: number;
  launch?: number;
  magnet?: number;
  score?: number;
  combo?: number;
  fruitBatch?: number;
  seedStart?: number;
  trayCapacity?: number;
  tools?: Partial<Record<ToolId, number>>;
};

export type GameOptions = {
  difficulty?: Difficulty;
  seed?: string;
  challengeKey?: string;
  level: number;
  mode: GameMode;
  wave?: number;
  relics?: RelicId[];
  startingScore?: number;
  upgrades?: GameUpgrades;
};

export type GameControls = {
  undo: () => void;
  shuffle: () => void;
  juice: () => void;
  hammer: () => void;
  magnet: () => void;
  wild: () => void;
  bubble: () => void;
  sunshine: () => void;
  ripen: () => void;
  split: () => void;
  bomb: () => void;
  shield: () => void;
  harvest: () => void;
  quake: () => void;
  basket: () => void;
  syrup: () => void;
  insight: () => void;
  vortex: () => void;
  cushion: () => void;
  barometer: () => void;
  setDropLane: (lane: -1 | 0 | 1) => void;
  pause: () => void;
  resume: () => void;
  destroy: () => void;
};
