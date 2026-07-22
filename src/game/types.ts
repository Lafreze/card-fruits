import type { GameMode, RelicId } from "./modes";

export type GameStatus = "playing" | "won" | "lost";

export type GameSnapshot = {
  status: GameStatus;
  score: number;
  combo: number;
  maxCombo: number;
  maxFruitTier: number;
  remainingCards: number;
  trayCount: number;
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
  shieldLeft: number;
  wave: number;
  mode: GameMode;
  relics: RelicId[];
  feverEnergy: number;
  feverActive: boolean;
  mutator: string;
  mutatorHint: string;
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
  pack?: number;
  fever?: number;
  danger?: number;
  sun?: number;
  magnet?: number;
  score?: number;
  combo?: number;
  sweetStart?: number;
};

export type GameOptions = {
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
  shield: () => void;
  pause: () => void;
  resume: () => void;
  destroy: () => void;
};
