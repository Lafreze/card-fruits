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
  wave: number;
  mode: GameMode;
  relics: RelicId[];
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

export type GameOptions = {
  level: number;
  mode: GameMode;
  wave?: number;
  relics?: RelicId[];
  startingScore?: number;
};

export type GameControls = {
  undo: () => void;
  shuffle: () => void;
  juice: () => void;
  hammer: () => void;
  magnet: () => void;
  pause: () => void;
  resume: () => void;
  destroy: () => void;
};
