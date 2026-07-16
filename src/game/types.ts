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

export type GameControls = {
  undo: () => void;
  shuffle: () => void;
  juice: () => void;
  pause: () => void;
  resume: () => void;
  destroy: () => void;
};
