import { Icon } from "./Icon";
import {
  DIFFICULTIES,
  dailyChallenge,
  type Difficulty,
} from "./game/challenges";
import { storage, exportSave, importSave } from "./storage";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  getLeaderboard,
  saveScore,
  startRun,
  type LeaderboardEntry,
} from "./api";
import { sounds } from "./game/audio";
import { FRUITS, LEVELS, type FruitDefinition } from "./game/data";
import type { FruitGame } from "./game/FruitGame";
import { calculateCoinReward } from "./game/logic";
import {
  MODE_INFO,
  RELICS,
  TOOLS,
  UPGRADES,
  pickRelics,
  type GameMode,
  type RelicDefinition,
  type RelicId,
  type ToolId,
  type UpgradeId,
} from "./game/modes";
import type {
  GameControls,
  GameResult,
  GameSnapshot,
  GameUpgrades,
} from "./game/types";

type Screen = "home" | "game";
type GamePanel = "tools" | "help" | "menu" | null;
type ToastState = {
  id: number;
  message: string;
  tone: "gold" | "pink" | "cyan";
} | null;

const EMPTY_SNAPSHOT: GameSnapshot = {
  status: "playing",
  score: 0,
  combo: 0,
  maxCombo: 0,
  maxFruitTier: 0,
  remainingCards: 0,
  trayCount: 0,
  trayLimit: 7,
  dangerProgress: 0,
  undoLeft: 0,
  shuffleLeft: 1,
  juiceLeft: 0,
  hammerLeft: 1,
  magnetLeft: 0,
  wildLeft: 0,
  bubbleLeft: 0,
  sunLeft: 1,
  ripenLeft: 0,
  splitLeft: 0,
  bombLeft: 1,
  shieldLeft: 1,
  harvestLeft: 0,
  quakeLeft: 1,
  basketLeft: 0,
  syrupLeft: 0,
  insightLeft: 1,
  vortexLeft: 1,
  cushionLeft: 1,
  barometerLeft: 1,
  cushionSeconds: 0,
  insightSeconds: 0,
  vortexSeconds: 0,
  weather: null,
  wave: 1,
  mode: "story",
  relics: [],
  feverEnergy: 0,
  feverActive: false,
  mutator: "",
  mutatorHint: "",
  dropLane: 0,
  difficulty: "classic",
  timeLeft: null,
  challengeKey: "",
};

const GREENHOUSE_PLANTS = ["sprout", "leaf", "flower", "basket"];
const MODE_UNLOCK_LEVEL: Partial<Record<GameMode, number>> = {};
const DAILY_UPGRADES: GameUpgrades = {};
const STARTER_GIFT_KEY = "fruit-king-starter-gift-v1";
const CARD_BASE_TOOL_IDS = new Set<ToolId>([
  "shuffle",
  "hammer",
  "sun",
  "insight",
]);
const FRUIT_BASE_TOOL_IDS = new Set<ToolId>([
  "bomb",
  "shield",
  "quake",
  "vortex",
  "cushion",
  "barometer",
]);
const BASE_TOOL_IDS = new Set<ToolId>([
  ...CARD_BASE_TOOL_IDS,
  ...FRUIT_BASE_TOOL_IDS,
]);
const RELIC_RARITY_LABEL = {
  common: "普通",
  uncommon: "罕见",
  rare: "稀有",
} as const;

function readProgress() {
  const stored = Number(storage.getItem("fruit-king-unlocked") || 0);
  return Number.isFinite(stored)
    ? Math.max(0, Math.min(Math.floor(stored), LEVELS.length - 1))
    : 0;
}

type UpgradeLevels = Record<UpgradeId, number>;
type ToolLevels = Record<ToolId, number>;

function FruitIcon({
  fruit,
  className = "",
  decorative = false,
}: {
  fruit: FruitDefinition;
  className?: string;
  decorative?: boolean;
}) {
  return (
    <img
      className={`fruit-visual fruit-visual-image ${className}`}
      src={fruit.icon}
      alt={decorative ? "" : fruit.name}
      draggable={false}
    />
  );
}

function readCoins() {
  const stored = Number(storage.getItem("fruit-king-coins") || 0);
  return Number.isFinite(stored) ? Math.max(0, Math.floor(stored)) : 0;
}

function readUpgrades(): UpgradeLevels {
  const empty: UpgradeLevels = {
    pack: 0,
    fever: 0,
    danger: 0,
    coin: 0,
    sun: 0,
    magnet: 0,
    score: 0,
    combo: 0,
    sweet_start: 0,
    seed_start: 0,
    tray: 0,
    relic_start: 0,
  };

  try {
    const stored = JSON.parse(
      storage.getItem("fruit-king-upgrades") || "{}",
    ) as Partial<Record<UpgradeId, number>>;
    for (const definition of UPGRADES) {
      const level = Number(stored[definition.id] || 0);
      empty[definition.id] = Number.isFinite(level)
        ? Math.max(0, Math.min(definition.maxLevel, Math.floor(level)))
        : 0;
    }
  } catch {
    /* 损坏数据回退为全 0 */
  }
  return empty;
}

function readTools(): ToolLevels {
  const empty = Object.fromEntries(
    TOOLS.map((tool) => [tool.id, 0]),
  ) as ToolLevels;
  try {
    const stored = JSON.parse(
      storage.getItem("fruit-king-tools") || "{}",
    ) as Partial<Record<ToolId, number>>;
    TOOLS.forEach((tool) => {
      const level = Number(stored[tool.id] || 0);
      empty[tool.id] = Number.isFinite(level)
        ? Math.max(0, Math.min(tool.maxLevel, Math.floor(level)))
        : 0;
    });
  } catch {
    /* 损坏数据回退为全 0 */
  }
  return empty;
}

// 结算果币使用对数分数曲线，避免高阶水果的指数得分跳过长期养成。
function computeCoinReward(result: GameResult, upgrades: UpgradeLevels) {
  return calculateCoinReward({
    score: result.score,
    mode: result.mode,
    wave: result.wave,
    won: result.status === "won",
    coinLevel: upgrades.coin,
    goldRain: result.relics.includes("gold_rain"),
  });
}

function formatScore(value: number) {
  return new Intl.NumberFormat("zh-CN").format(value);
}

function GameCanvas({
  level,
  difficulty,
  challengeKey,
  seed,
  mode,
  wave,
  relics,
  startingScore,
  upgrades,
  session,
  onReady,
  onSnapshot,
  onFinish,
  onToast,
}: {
  level: number;
  difficulty: Difficulty;
  challengeKey: string;
  seed?: string;
  mode: GameMode;
  wave: number;
  relics: RelicId[];
  startingScore: number;
  upgrades: GameUpgrades;
  session: number;
  onReady: (controls: GameControls | null) => void;
  onSnapshot: (snapshot: GameSnapshot) => void;
  onFinish: (result: GameResult) => void;
  onToast: (message: string, tone?: "gold" | "pink" | "cyan") => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    let game: FruitGame | null = null;
    if (!canvasRef.current) return;
    void import("./game/FruitGame")
      .then(({ FruitGame: Game }) =>
        Game.create(
          canvasRef.current!,
          {
            level,
            mode,
            wave,
            relics,
            startingScore,
            upgrades,
            difficulty,
            challengeKey,
            seed,
          },
          { onSnapshot, onFinish, onToast },
        ),
      )
      .then((created) => {
        if (cancelled) created.destroy();
        else {
          game = created;
          onReady(created);
        }
      })
      .catch((error) => {
        console.error("game renderer failed to start", error);
        if (!cancelled) onToast("游戏画面启动失败，请刷新后重试", "pink");
      });
    return () => {
      cancelled = true;
      onReady(null);
      game?.destroy();
    };
  }, [
    level,
    difficulty,
    challengeKey,
    seed,
    mode,
    onFinish,
    onReady,
    onSnapshot,
    onToast,
    relics,
    session,
    upgrades,
    wave,
  ]);

  return (
    <canvas
      key={`${mode}-${level}-${wave}-${session}`}
      ref={canvasRef}
      className="game-canvas"
      aria-label="水果叠叠乐游戏画面"
    />
  );
}

function Leaderboard({
  entries,
  loading,
  offline,
  mode,
  onModeChange,
  onClose,
  onRefresh,
}: {
  entries: LeaderboardEntry[];
  loading: boolean;
  offline: boolean;
  mode: GameMode;
  onModeChange: (mode: GameMode) => void;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [filter, setFilter] = useState<Difficulty | "all">("all");
  const filteredEntries = entries.filter(
    (entry) => filter === "all" || entry.difficulty === filter,
  );
  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="本机战绩榜"
    >
      <section className="modal-card leaderboard-card">
        <div className="modal-kicker">YOUR ORCHARD RECORDS</div>
        <h2>我的收成记录</h2>
        <p className="modal-copy">
          {mode === "story"
            ? "此浏览器内的最佳战绩 · 按难度分别保存"
            : "本机历史最佳 · 每日挑战按日期分别记录"}
        </p>
        <div className="leaderboard-tabs">
          {(Object.keys(MODE_INFO) as GameMode[]).map((item) => (
            <button
              key={item}
              className={mode === item ? "active" : ""}
              onClick={() => onModeChange(item)}
            >
              {<Icon name={MODE_INFO[item].icon} />} {MODE_INFO[item].name}
            </button>
          ))}
        </div>
        <div className="rank-filters" aria-label="战绩难度筛选">
          <button
            aria-pressed={filter === "all"}
            onClick={() => setFilter("all")}
          >
            全部难度
          </button>
          {(Object.keys(DIFFICULTIES) as Difficulty[]).map((item) => (
            <button
              key={item}
              aria-pressed={filter === item}
              onClick={() => setFilter(item)}
            >
              {DIFFICULTIES[item].name}
            </button>
          ))}
        </div>
        <div className="rank-list">
          {loading ? (
            <div className="empty-state">正在采摘最新战绩…</div>
          ) : null}
          {!loading && offline ? (
            <div className="empty-state">
              浏览器未允许保存数据，可导出存档备份。
            </div>
          ) : null}
          {!loading && !offline && filteredEntries.length === 0 ? (
            <div className="empty-state">第一名正在等你来拿。</div>
          ) : null}
          {filteredEntries.map((entry, index) => (
            <div
              className={`rank-row rank-${index + 1}`}
              key={`${entry.username}-${entry.createdAt}`}
            >
              <span className="rank-number">
                {index < 3 ? (
                  <Icon name="trophy" />
                ) : (
                  String(index + 1).padStart(2, "0")
                )}
              </span>
              <span className="rank-player">
                <strong>{entry.username}</strong>
                <small>
                  {mode === "story"
                    ? `第 ${entry.level + 1} 关`
                    : mode === "endless"
                      ? `第 ${entry.level} 波`
                      : `远征路线 ${entry.level + 1}`}{" "}
                  · {DIFFICULTIES[entry.difficulty].name} {entry.challengeKey} ·
                  最高{" "}
                  <FruitIcon
                    fruit={FRUITS[Math.min(entry.fruitTier, FRUITS.length - 1)]}
                    decorative
                  />{" "}
                  · {entry.maxCombo} 连击
                </small>
              </span>
              <b>{formatScore(entry.score)}</b>
            </div>
          ))}
        </div>
        <div className="modal-actions split-actions">
          <button className="button button-ghost" onClick={onClose}>
            返回
          </button>
          <button className="button button-primary" onClick={onRefresh}>
            刷新战绩
          </button>
        </div>
      </section>
    </div>
  );
}

export default function App() {
  const [muted, setMuted] = useState(
    () => storage.getItem("fruit-king-muted") === "true",
  );
  const [screen, setScreen] = useState<Screen>("home");
  const [difficulty, setDifficulty] = useState<Difficulty>("classic");
  const [challenge, setChallenge] = useState(dailyChallenge);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveMessage, setArchiveMessage] = useState("");
  const [collectionOpen, setCollectionOpen] = useState(false);
  const [mode, setMode] = useState<GameMode>("story");
  const [level, setLevel] = useState(readProgress);
  const [unlocked, setUnlocked] = useState(readProgress);
  const [session, setSession] = useState(0);
  const [snapshot, setSnapshot] = useState<GameSnapshot>(EMPTY_SNAPSHOT);
  const [result, setResult] = useState<GameResult | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">(
    "idle",
  );
  const [saveError, setSaveError] = useState("");
  const [toast, setToast] = useState<ToastState>(null);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [leaderboardOffline, setLeaderboardOffline] = useState(false);
  const [leaderboardMode, setLeaderboardMode] = useState<GameMode>("story");
  const [wave, setWave] = useState(1);
  const [relics, setRelics] = useState<RelicId[]>([]);
  const [carryScore, setCarryScore] = useState(0);
  const [rewardOptions, setRewardOptions] = useState<RelicDefinition[]>([]);
  const [coins, setCoins] = useState(readCoins);
  const [upgrades, setUpgrades] = useState<UpgradeLevels>(readUpgrades);
  const [tools, setTools] = useState<ToolLevels>(readTools);
  const [shopOpen, setShopOpen] = useState(false);
  const [shopPulse, setShopPulse] = useState(0);
  const [lastCoinReward, setLastCoinReward] = useState(0);
  const [lastCoinStarterGift, setLastCoinStarterGift] = useState(false);
  const [gamePanel, setGamePanel] = useState<GamePanel>(null);
  const controlsRef = useRef<GameControls | null>(null);
  const [gameReady, setGameReady] = useState(false);
  const toastTimer = useRef<number | null>(null);
  const levelTrackRef = useRef<HTMLDivElement | null>(null);
  // 传给游戏内核的成长加成(对象引用保持稳定,避免重建游戏)
  const gameUpgrades = useRef<GameUpgrades>({
    fever: upgrades.fever,
    danger: upgrades.danger,
    launch: upgrades.sun,
    magnet: upgrades.magnet,
    score: upgrades.score,
    combo: upgrades.combo,
    fruitBatch: upgrades.sweet_start,
    seedStart: upgrades.seed_start,
    trayCapacity: upgrades.tray,
    tools,
  });

  const persistCoins = useCallback((next: number) => {
    storage.setItem("fruit-king-coins", String(next));
    setCoins(next);
  }, []);

  const buyUpgrade = (id: UpgradeId) => {
    const definition = UPGRADES.find((item) => item.id === id);
    if (!definition) return;
    const currentLevel = upgrades[id];
    if (currentLevel >= definition.maxLevel) return;
    const cost = definition.costs[currentLevel];
    if (coins < cost) return;
    const nextUpgrades = { ...upgrades, [id]: currentLevel + 1 };
    storage.setItem("fruit-king-upgrades", JSON.stringify(nextUpgrades));
    setUpgrades(nextUpgrades);
    persistCoins(coins - cost);
    setShopPulse((value) => value + 1);
    gameUpgrades.current = {
      fever: nextUpgrades.fever,
      danger: nextUpgrades.danger,
      launch: nextUpgrades.sun,
      magnet: nextUpgrades.magnet,
      score: nextUpgrades.score,
      combo: nextUpgrades.combo,
      fruitBatch: nextUpgrades.sweet_start,
      seedStart: nextUpgrades.seed_start,
      trayCapacity: nextUpgrades.tray,
      tools,
    };
  };

  const buyTool = (id: ToolId) => {
    const definition = TOOLS.find((item) => item.id === id);
    if (!definition) return;
    const currentLevel = tools[id];
    if (currentLevel >= definition.maxLevel) return;
    const discount = 1 - upgrades.pack * 0.06;
    const cost = Math.max(
      1,
      Math.round((definition.costs[currentLevel] * discount) / 5) * 5,
    );
    if (coins < cost) return;
    const nextTools = { ...tools, [id]: currentLevel + 1 };
    storage.setItem("fruit-king-tools", JSON.stringify(nextTools));
    setTools(nextTools);
    persistCoins(coins - cost);
    setShopPulse((value) => value + 1);
    gameUpgrades.current = { ...gameUpgrades.current, tools: nextTools };
  };

  const handleReady = useCallback((controls: GameControls | null) => {
    controlsRef.current = controls;
    setGameReady(Boolean(controls));
  }, []);
  const persistUnlocked = useCallback((nextLevel: number) => {
    const safeLevel = Math.max(0, Math.min(nextLevel, LEVELS.length - 1));
    const persisted = readProgress();
    const nextUnlocked = Math.max(persisted, safeLevel);
    storage.setItem("fruit-king-unlocked", String(nextUnlocked));
    setUnlocked((current) => Math.max(current, nextUnlocked));
    return nextUnlocked;
  }, []);
  const handleSnapshot = useCallback((next: GameSnapshot) => {
    setSnapshot(next);
  }, []);
  const handleFinish = useCallback(
    (next: GameResult) => {
      setGamePanel(null);
      setResult(next);
      const starterGift =
        next.mode === "story" &&
        next.status === "won" &&
        level === 0 &&
        storage.getItem(STARTER_GIFT_KEY) !== "claimed";
      const reward =
        computeCoinReward(next, readUpgrades()) + (starterGift ? 60 : 0);
      if (starterGift) storage.setItem(STARTER_GIFT_KEY, "claimed");
      setLastCoinStarterGift(starterGift);
      setLastCoinReward(reward);
      persistCoins(readCoins() + reward);
      if (next.status === "won") {
        if (mode === "story") persistUnlocked(level + 1);
        if (mode === "expedition" && next.wave < 8)
          setRewardOptions(
            pickRelics(
              relics,
              relics.includes("choice_branch") ? 4 : 3,
              next.wave,
            ),
          );
      }
    },
    [level, mode, persistCoins, persistUnlocked, relics],
  );
  useEffect(() => {
    if (!result || !runId) return;
    void saveScore({
      runId,
      username: storage.getItem("fruit-king-name") || "果园旅人",
      score: result.score,
      maxCombo: result.maxCombo,
      fruitTier: result.maxFruitTier,
      level: mode === "endless" || mode === "sprint" ? result.wave : level,
    })
      .then(() => setSaveState("saved"))
      .catch((error: Error) => setSaveError(error.message));
  }, [result, runId, mode, level]);

  const handleToast = useCallback(
    (message: string, tone: "gold" | "pink" | "cyan" = "pink") => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
      setToast({ id: Date.now(), message, tone });
      toastTimer.current = window.setTimeout(() => setToast(null), 1_200);
    },
    [],
  );
  const dismissToast = useCallback(() => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = null;
    setToast(null);
  }, []);

  const beginGame = useCallback(
    (
      targetLevel = level,
      targetMode = mode,
      run: { wave?: number; relics?: RelicId[]; score?: number } = {},
    ) => {
      setGameReady(false);
      if (targetMode === "daily") targetLevel = dailyChallenge().level;
      if (
        window.matchMedia("(pointer: coarse)").matches &&
        !document.fullscreenElement &&
        document.documentElement.requestFullscreen
      ) {
        void document.documentElement.requestFullscreen().catch(() => {});
      }
      sounds.prepare();
      gameUpgrades.current = {
        fever: upgrades.fever,
        danger: upgrades.danger,
        launch: upgrades.sun,
        magnet: upgrades.magnet,
        score: upgrades.score,
        combo: upgrades.combo,
        fruitBatch: upgrades.sweet_start,
        seedStart: upgrades.seed_start,
        trayCapacity: upgrades.tray,
        tools,
      };
      const nextWave = run.wave || 1;
      const nextRelics = run.relics || [];
      const nextScore = run.score || 0;
      setLevel(targetLevel);
      setMode(targetMode);
      setWave(nextWave);
      setRelics(nextRelics);
      setCarryScore(nextScore);
      setSnapshot(EMPTY_SNAPSHOT);
      setResult(null);
      setRewardOptions([]);
      setSaveState("idle");
      setSaveError("");
      setUsername("");
      setRunId(null);
      setGamePanel(null);
      setLastCoinStarterGift(false);
      setScreen("game");
      setSession((value) => value + 1);
      const day = targetMode === "daily" ? dailyChallenge() : challenge;
      if (targetMode === "daily") setChallenge(day);
      setRunId(
        startRun(
          targetMode,
          targetMode === "endless" || targetMode === "sprint"
            ? nextWave
            : targetLevel,
          targetMode === "daily" ? "expert" : difficulty,
          targetMode === "daily" ? day.key : "",
        ).runId,
      );
    },
    [level, mode, difficulty, challenge, upgrades, tools],
  );

  const startSelectedMode = () => {
    const requiredLevel = MODE_UNLOCK_LEVEL[mode] || 0;
    if (unlocked < requiredLevel) return;
    if (mode === "daily") {
      beginGame(dailyChallenge().level, "daily");
      return;
    }
    if (mode === "story") {
      beginGame(level, "story");
      return;
    }
    // 远征福袋:远征开局自带 1 件随机奇物
    const startingRelics =
      mode === "expedition" && upgrades.relic_start >= 1
        ? pickRelics([], 1).map((relic) => relic.id)
        : [];
    beginGame(mode === "sprint" ? 2 : 0, mode, {
      wave: 1,
      relics: startingRelics,
      score: 0,
    });
  };

  const backHome = () => {
    if (document.fullscreenElement)
      void document.exitFullscreen().catch(() => {});
    controlsRef.current?.destroy();
    controlsRef.current = null;
    setGamePanel(null);
    setResult(null);
    setScreen("home");
  };

  const openGamePanel = (panel: Exclude<GamePanel, null>) => {
    if (!controlsRef.current) return;
    controlsRef.current.pause();
    setGamePanel(panel);
  };

  useEffect(() => {
    if (screen !== "home") return;
    const selected = levelTrackRef.current?.querySelector(
      ".level-dot.selected",
    );
    selected?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [level, screen, unlocked]);

  useEffect(() => {
    const onHidden = () => {
      if (document.hidden && screen === "game" && !result) {
        controlsRef.current?.pause();
        setGamePanel("menu");
      }
    };
    document.addEventListener("visibilitychange", onHidden);
    return () => document.removeEventListener("visibilitychange", onHidden);
  }, [screen, result]);

  const closeGamePanel = () => {
    controlsRef.current?.resume();
    setGamePanel(null);
  };

  const useTool = (action: (controls: GameControls) => void) => {
    const controls = controlsRef.current;
    if (!controls) return;
    controls.resume();
    setGamePanel(null);
    action(controls);
  };

  const continueGame = () => {
    if (!result) return;
    if (mode === "story") {
      const nextLevel =
        result.status === "won"
          ? Math.min(level + 1, LEVELS.length - 1)
          : level;
      if (result.status === "won") persistUnlocked(nextLevel);
      beginGame(nextLevel, "story");
      return;
    }
    const startingRelics =
      mode === "expedition" && upgrades.relic_start >= 1
        ? pickRelics([], 1).map((relic) => relic.id)
        : [];
    beginGame(
      mode === "daily" ? dailyChallenge().level : mode === "sprint" ? 2 : 0,
      mode,
      { wave: 1, relics: startingRelics, score: 0 },
    );
  };

  const chooseRelic = (relic: RelicId) => {
    if (!result) return;
    const nextRelics = [...relics, relic];
    const nextWave = wave + 1;
    beginGame(Math.min(LEVELS.length - 1, nextWave - 1), "expedition", {
      wave: nextWave,
      relics: nextRelics,
      score: result.score,
    });
  };

  const loadLeaderboard = useCallback(
    (selectedMode = leaderboardMode) => {
      setLeaderboardLoading(true);
      setLeaderboardOffline(false);
      void getLeaderboard(selectedMode)
        .then((data) => {
          setLeaderboard(data.scores);
          setLeaderboardOffline(Boolean(data.offline));
        })
        .catch(() => setLeaderboardOffline(true))
        .finally(() => setLeaderboardLoading(false));
    },
    [leaderboardMode],
  );

  const openLeaderboard = () => {
    if (screen === "game") {
      controlsRef.current?.pause();
      setGamePanel("menu");
    }
    setLeaderboardMode(mode);
    setLeaderboardOpen(true);
    loadLeaderboard(mode);
  };

  const changeLeaderboardMode = (nextMode: GameMode) => {
    setLeaderboardMode(nextMode);
    loadLeaderboard(nextMode);
  };

  const submitScore = async () => {
    if (!result || !runId || !username.trim() || saveState === "saving") return;
    setSaveState("saving");
    setSaveError("");
    try {
      await saveScore({
        runId,
        username,
        score: result.score,
        maxCombo: result.maxCombo,
        fruitTier: result.maxFruitTier,
      });
      setSaveState("saved");
      loadLeaderboard(mode);
    } catch (error) {
      setSaveState("idle");
      setSaveError(error instanceof Error ? error.message : "分数保存失败");
    }
  };

  useEffect(
    () => () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    },
    [],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (archiveOpen) {
        setArchiveOpen(false);
      } else if (collectionOpen) {
        setCollectionOpen(false);
      } else if (leaderboardOpen) {
        setLeaderboardOpen(false);
      } else if (shopOpen) {
        setShopOpen(false);
      } else if (gamePanel) {
        closeGamePanel();
      } else if (screen === "game" && !result) {
        openGamePanel("menu");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    gamePanel,
    leaderboardOpen,
    shopOpen,
    archiveOpen,
    collectionOpen,
    screen,
    result,
  ]);

  useEffect(() => {
    const dialogs = document.querySelectorAll<HTMLElement>('[role="dialog"]');
    const dialog = dialogs[dialogs.length - 1];
    if (!dialog) return;
    const previous = document.activeElement as HTMLElement | null;
    const focusables = () =>
      Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), [href], [tabindex="0"]',
        ),
      ).filter((el) => el.getClientRects().length > 0);
    focusables()[0]?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const items = focusables(),
        first = items[0],
        last = items.at(-1);
      if (!first || !last) return;
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          !dialog.contains(document.activeElement))
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last ||
          !dialog.contains(document.activeElement))
      ) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", trap);
    return () => {
      document.removeEventListener("keydown", trap);
      if (previous?.isConnected) previous.focus();
    };
  }, [
    leaderboardOpen,
    shopOpen,
    archiveOpen,
    collectionOpen,
    gamePanel,
    result,
  ]);

  const target =
    FRUITS[
      LEVELS[
        mode === "daily" && screen === "home" ? dailyChallenge().level : level
      ].target
    ];
  const currentFruit =
    FRUITS[Math.min(snapshot.maxFruitTier, FRUITS.length - 1)];
  const activeRelics = relics
    .map((id) => RELICS.find((relic) => relic.id === id))
    .filter((relic): relic is RelicDefinition => Boolean(relic));
  const helpChainStart =
    mode === "endless"
      ? Math.max(0, snapshot.maxFruitTier - 1)
      : Math.min(...LEVELS[level].cards.map((card) => card.tier));
  const helpChainEnd =
    mode === "endless"
      ? Math.min(FRUITS.length - 1, snapshot.maxFruitTier + 5)
      : LEVELS[level].target;
  const helpChain = FRUITS.slice(helpChainStart, helpChainEnd + 1);
  const greenhouseGrowth =
    Object.values(upgrades).reduce((total, value) => total + value, 0) +
    Object.values(tools).reduce((total, value) => total + value, 0);
  const isRelicReward =
    mode === "expedition" &&
    result?.status === "won" &&
    rewardOptions.length > 0;
  const toolboxItems = [
    {
      id: "cushion",
      icon: "bubble",
      label: "弹力垫",
      description:
        snapshot.cushionSeconds > 0
          ? `弹跳中 · ${snapshot.cushionSeconds}s`
          : "弹跳增强 · 10 秒",
      category: "fruit",
      left: snapshot.cushionLeft,
    },
    {
      id: "barometer",
      icon: "cloud",
      label: "天气仪",
      description: "驱散当前或预警天气",
      category: "boost",
      left: snapshot.barometerLeft,
    },
    {
      id: "insight",
      icon: "compass",
      label: "透视镜",
      description: "标记同果 · 8 秒",
      category: "card",
      left: snapshot.insightLeft,
    },
    {
      id: "vortex",
      icon: "spiral",
      label: "聚果场",
      description: "磁力 ×2.6 · 10 秒",
      category: "fruit",
      left: snapshot.vortexLeft,
    },
    {
      id: "undo",
      icon: "clock",
      label: "撤回",
      description: "退回上一张普通卡",
      category: "card",
      left: snapshot.undoLeft,
    },
    {
      id: "shuffle",
      icon: "dice",
      label: "洗牌",
      description: "重排并优先露出三消路线",
      category: "card",
      left: snapshot.shuffleLeft,
    },
    {
      id: "hammer",
      icon: "hammer",
      label: "清顶",
      description: "自动收取最有用的顶层卡",
      category: "card",
      left: snapshot.hammerLeft,
    },
    {
      id: "wild",
      icon: "flower",
      label: "万能",
      description: "补齐卡槽里最接近的三消",
      category: "card",
      left: snapshot.wildLeft,
    },
    {
      id: "bubble",
      icon: "bubble",
      label: "清槽",
      description: "收起两张最难配对的散牌",
      category: "card",
      left: snapshot.bubbleLeft,
    },
    {
      id: "sun",
      icon: "sun",
      label: "净化",
      description: "清障；无障碍时转为狂热充能",
      category: "card",
      left: snapshot.sunLeft,
    },
    {
      id: "bomb",
      icon: "bomb",
      label: "炸弹",
      description: "清理警戒线附近的低阶水果",
      category: "fruit",
      left: snapshot.bombLeft,
    },
    {
      id: "shield",
      icon: "ice",
      label: "冰冻",
      description: "暂停物理和警戒线 6 秒",
      category: "fruit",
      left: snapshot.shieldLeft,
    },
    {
      id: "quake",
      icon: "gear",
      label: "搅拌",
      description: "重排果箱，解开堆叠死角",
      category: "fruit",
      left: snapshot.quakeLeft,
    },
    {
      id: "juice",
      icon: "juice",
      label: "榨汁",
      description: "最高阶水果降一级并减压",
      category: "fruit",
      left: snapshot.juiceLeft,
    },
    {
      id: "magnet",
      icon: "magnet",
      label: "合并",
      description: "立即合成一对落稳水果",
      category: "fruit",
      left: snapshot.magnetLeft,
    },
    {
      id: "ripen",
      icon: "sprout",
      label: "催熟",
      description: "最低阶水果直接升一级",
      category: "fruit",
      left: snapshot.ripenLeft,
    },
    {
      id: "split",
      icon: "scissors",
      label: "分果",
      description: "最高阶水果拆成两个低一级水果",
      category: "fruit",
      left: snapshot.splitLeft,
    },
    {
      id: "harvest",
      icon: "wheat",
      label: "丰收",
      description: "下一次三消额外生成水果",
      category: "boost",
      left: snapshot.harvestLeft,
    },
    {
      id: "basket",
      icon: "basket",
      label: "采摘",
      description: "穿层采收一组三张同果卡",
      category: "card",
      left: snapshot.basketLeft,
    },
    {
      id: "syrup",
      icon: "honey",
      label: "糖浆",
      description: "甜度 +45；狂热中延时",
      category: "boost",
      left: snapshot.syrupLeft,
    },
  ] satisfies Array<{
    id: ToolId;
    icon: string;
    label: string;
    description: string;
    category: "card" | "fruit" | "boost";
    left: number;
  }>;
  const toolSeconds = (id: ToolId) =>
    id === "cushion"
      ? snapshot.cushionSeconds
      : id === "vortex"
        ? snapshot.vortexSeconds
        : id === "insight"
          ? snapshot.insightSeconds
          : 0;
  const availableToolboxItems = toolboxItems.filter((item) => item.left > 0);
  const toolGroups = [
    {
      id: "card",
      title: "牌桌工具",
      hint: "处理牌堆与卡槽",
      items: toolboxItems.filter((item) => item.category === "card"),
    },
    {
      id: "fruit",
      title: "果箱工具",
      hint: "直接改变水果物理",
      items: toolboxItems.filter((item) => item.category === "fruit"),
    },
    {
      id: "boost",
      title: "增益工具",
      hint: "强化下一次三消",
      items: toolboxItems.filter((item) => item.category === "boost"),
    },
  ];
  const useToolById = (id: ToolId) =>
    useTool((controls) => {
      if (id === "sun") controls.sunshine();
      else controls[id]();
    });
  return (
    <main className={`app-shell ${screen === "game" ? "is-playing" : ""}`}>
      <div className="noise" />
      {!storage.persistent ? (
        <div className="storage-warning" role="status">
          浏览器暂时无法保存数据，请在离开前导出存档。
        </div>
      ) : null}
      {screen === "home" ? (
        <section className="home-screen">
          <nav className="home-nav" aria-label="果园导航">
            <a className="wordmark" href="#" aria-label="水果叠叠乐首页">
              <Icon name="sprout" />
              <span>
                水果叠叠乐<small>FRUIT STACK</small>
              </span>
            </a>
            <div className="nav-actions">
              <button
                aria-label="我的存档"
                onClick={() => setArchiveOpen(true)}
              >
                <Icon name="bag" />
                <span>我的存档</span>
              </button>
              <button onClick={() => setShopOpen(true)} className="wallet">
                <Icon name="coin" />
                {formatScore(coins)}
                <span>果币</span>
              </button>
            </div>
          </nav>
          <div className="home-content">
            <div className="orchard-intro">
              <div className="season-label">
                <span /> FRESH & PLAYFUL
              </div>
              <h1>
                水果<span>叠叠乐</span>
              </h1>
              <p className="tagline">叠三张，合一果。</p>
              <div
                className="hero-illustration"
                aria-label="手绘水果、卡片与丰收果篮"
              >
                <div className="art-orbit orbit-one" />
                <div className="art-orbit orbit-two" />
                <div className="hero-card card-one">
                  <span>01</span>
                  <FruitIcon fruit={FRUITS[4]} decorative />
                  <small>草莓</small>
                </div>
                <div className="hero-card card-two">
                  <span>02</span>
                  <FruitIcon fruit={FRUITS[4]} decorative />
                  <small>草莓</small>
                </div>
                <div className="hero-card card-three">
                  <span>03</span>
                  <FruitIcon fruit={FRUITS[4]} decorative />
                  <small>草莓</small>
                </div>
                <div className="hero-harvest">
                  <FruitIcon fruit={FRUITS[21]} decorative />
                  <FruitIcon fruit={FRUITS[9]} decorative />
                  <FruitIcon fruit={FRUITS[12]} decorative />
                  <FruitIcon fruit={FRUITS[2]} decorative />
                  <FruitIcon fruit={FRUITS[49]} decorative />
                </div>
                <div className="harvest-bowl">
                  <Icon name="leaf" />
                </div>
                <Icon className="art-spark spark-one" name="spark" />
                <Icon className="art-spark spark-two" name="spark" />
                <Icon className="art-leaf" name="leaf" />
              </div>
              <div className="intro-bottom">
                <span>
                  <b>50</b> 种卡通水果
                </span>
                <span>
                  <b>47</b> 个关卡
                </span>
                <span>
                  <b>5</b> 种玩法
                </span>
              </div>
            </div>
            <section className="start-panel" aria-label="开始游戏">
              <div className="panel-heading">
                <div>
                  <h2>选一局</h2>
                </div>
                <Icon name="sun" />
              </div>
              <div className="mode-switch" aria-label="选择游戏模式">
                {(
                  [
                    "story",
                    "endless",
                    "expedition",
                    "sprint",
                    "daily",
                  ] as GameMode[]
                ).map((item) => (
                  <button
                    key={item}
                    className={mode === item ? "active" : ""}
                    aria-pressed={mode === item}
                    onClick={() => setMode(item)}
                  >
                    <i>
                      <Icon name={MODE_INFO[item].icon} />
                    </i>
                    <span>
                      <strong>{MODE_INFO[item].name}</strong>
                      <small>
                        {
                          {
                            story: "47 关",
                            endless: "不限时",
                            expedition: "8 关远征",
                            sprint: "120 秒",
                            daily: "每日更新",
                          }[item]
                        }
                      </small>
                    </span>
                    <b className="mode-radio" />
                  </button>
                ))}
              </div>
              <div className="difficulty-section">
                <div className="section-line">
                  <b>{mode === "daily" ? "今日统一规则" : "选择难度"}</b>
                  <small>
                    {mode === "daily" ? `${dailyChallenge().key} · UTC` : ""}
                  </small>
                </div>
                <div className="difficulty-switch" aria-label="选择难度">
                  {(Object.keys(DIFFICULTIES) as Difficulty[]).map((item) => (
                    <button
                      key={item}
                      aria-pressed={
                        (mode === "daily" ? "expert" : difficulty) === item
                      }
                      disabled={mode === "daily"}
                      className={
                        (mode === "daily" ? "expert" : difficulty) === item
                          ? "active"
                          : ""
                      }
                      onClick={() => setDifficulty(item)}
                    >
                      {DIFFICULTIES[item].name}
                    </button>
                  ))}
                </div>
                <p>
                  {mode === "daily"
                    ? "固定牌阵 · 困难"
                    : DIFFICULTIES[difficulty].hint}
                </p>
              </div>
              {mode === "story" ? (
                <div className="level-section">
                  <div className="section-line">
                    <b>选择关卡</b>
                    <small>
                      已解锁 {unlocked + 1} / {LEVELS.length}
                    </small>
                  </div>
                  <div className="level-track" ref={levelTrackRef}>
                    {LEVELS.map((item, index) => (
                      <button
                        key={item.name}
                        className={`level-dot ${index <= unlocked ? "unlocked" : ""} ${index === level ? "selected" : ""}`}
                        disabled={index > unlocked}
                        aria-label={`${item.name}${index > unlocked ? "，未解锁" : ""}`}
                        onClick={() => setLevel(index)}
                      >
                        {index < unlocked
                          ? "✓"
                          : String(index + 1).padStart(2, "0")}
                      </button>
                    ))}
                  </div>
                  <div className="mission-preview">
                    <FruitIcon fruit={target} decorative />
                    <span>
                      <small>
                        第 {level + 1} 关 · {LEVELS[level].name}
                      </small>
                      <strong>合成{target.name}</strong>
                    </span>
                  </div>
                </div>
              ) : (
                <div className="mode-note">
                  <Icon name={MODE_INFO[mode].icon} />
                  <span>
                    {mode === "daily"
                      ? `今日目标：${target.name}`
                      : mode === "sprint"
                        ? "120 秒 · 清牌续波"
                        : mode === "expedition"
                          ? "8 关 · 奇物三选一"
                          : "无限波次 · 随机变异"}
                  </span>
                </div>
              )}
              <button
                className="button button-play"
                onClick={startSelectedMode}
              >
                <span>
                  {mode === "story"
                    ? "开始采摘"
                    : `开始${MODE_INFO[mode].name}`}
                </span>
                <Icon name="arrow" />
              </button>
            </section>
          </div>
          <div className="orchard-shelf">
            <button
              className="shelf-link"
              onClick={() => setCollectionOpen(true)}
            >
              <Icon name="book" />
              <span>
                <b>水果图鉴</b>
              </span>
              <span className="shelf-arrow">↗</span>
            </button>
            <button className="shelf-link" onClick={openLeaderboard}>
              <Icon name="trophy" />
              <span>
                <b>我的收成</b>
              </span>
              <span className="shelf-arrow">↗</span>
            </button>
            <button className="shelf-link" onClick={() => setShopOpen(true)}>
              <Icon name="home" />
              <span>
                <b>果园温室</b>
              </span>
              <span className="shelf-arrow">↗</span>
            </button>
          </div>
        </section>
      ) : (
        <section className="play-layout">
          <aside className="desktop-brief">
            <button className="brand-button" onClick={backHome}>
              水果<span>叠叠乐</span>
            </button>
            <div className="brief-chain">
              {FRUITS.slice(
                Math.max(0, LEVELS[level].target - 3),
                LEVELS[level].target + 1,
              ).map((fruit, index) => (
                <span key={fruit.name}>
                  <FruitIcon fruit={fruit} decorative />
                  {index < 3 ? <i>›</i> : null}
                </span>
              ))}
            </div>
            <button className="leaderboard-link" onClick={openLeaderboard}>
              <Icon name="trophy" /> 查看排行榜
            </button>
          </aside>
          <div className="play-board">
            <div
              className="game-phone"
              aria-busy={!gameReady}
              onPointerDown={() => {
                if (toast) dismissToast();
              }}
            >
              <GameCanvas
                level={level}
                mode={mode}
                difficulty={mode === "daily" ? "expert" : difficulty}
                challengeKey={mode === "daily" ? challenge.key : ""}
                seed={mode === "daily" ? challenge.seed : undefined}
                wave={wave}
                relics={relics}
                startingScore={carryScore}
                upgrades={
                  mode === "daily" ? DAILY_UPGRADES : gameUpgrades.current
                }
                session={session}
                onReady={handleReady}
                onSnapshot={handleSnapshot}
                onFinish={handleFinish}
                onToast={handleToast}
              />
              <header className="game-hud">
                <div className="score-chip">
                  <small>分数</small>
                  <b>{formatScore(snapshot.score)}</b>
                </div>
                <div className="target-chip">
                  <small>
                    {mode === "endless"
                      ? "最高水果"
                      : mode === "expedition"
                        ? `远征 ${wave}/8`
                        : mode !== "sprint" &&
                            snapshot.maxFruitTier >= LEVELS[level].target
                          ? "目标达成"
                          : `${snapshot.remainingCards} 张 · ${snapshot.trayCount}/${snapshot.trayLimit} 格`}
                  </small>
                  <strong>
                    {mode === "sprint" ? (
                      <span
                        className={`clock-remaining ${(snapshot.timeLeft ?? 120) <= 20 ? "urgent" : ""}`}
                        aria-label={`剩余 ${snapshot.timeLeft ?? 120} 秒`}
                      >
                        <Icon name="clock" /> {snapshot.timeLeft ?? 120}
                        <small>秒</small>
                      </span>
                    ) : mode === "endless" ? (
                      <>
                        <FruitIcon fruit={currentFruit} decorative />{" "}
                        {currentFruit.name}
                      </>
                    ) : currentFruit !== target ? (
                      <>
                        <FruitIcon fruit={currentFruit} decorative />
                        <i className="fruit-path-arrow">→</i>
                        <FruitIcon fruit={target} decorative />
                      </>
                    ) : (
                      <>
                        <FruitIcon fruit={target} decorative /> ×1
                      </>
                    )}
                  </strong>
                </div>
                <button
                  className="top-action tool-action"
                  disabled={!gameReady}
                  onClick={() => openGamePanel("tools")}
                  aria-label={`打开道具栏，${availableToolboxItems.length} 种可用`}
                >
                  <i>
                    <Icon name="bag" />
                    <em>{availableToolboxItems.length}</em>
                  </i>
                  <span>道具</span>
                </button>
                <button
                  className="top-action"
                  disabled={!gameReady}
                  onClick={() => openGamePanel("menu")}
                  aria-label="打开游戏菜单"
                >
                  <i>
                    <Icon name="gear" />
                  </i>
                  <span>菜单</span>
                </button>
              </header>
              <div
                className={`challenge-status ${snapshot.timeLeft !== null && snapshot.timeLeft <= 20 ? "urgent" : ""}`}
              >
                <span>
                  {DIFFICULTIES[mode === "daily" ? "expert" : difficulty].name}{" "}
                  · {MODE_INFO[mode].name}
                </span>
                <b>
                  {mode === "sprint"
                    ? `${snapshot.timeLeft ?? 120}s`
                    : mode === "daily"
                      ? challenge.key
                      : `第 ${mode === "endless" ? snapshot.wave : level + 1} ${mode === "endless" ? "波" : "关"}`}
                </b>
              </div>
              <div className="drop-lane-control" aria-label="选择下次落果位置">
                {([-1, 0, 1] as const).map((lane) => (
                  <button
                    key={lane}
                    className={snapshot.dropLane === lane ? "active" : ""}
                    aria-label={
                      lane < 0 ? "落在左侧" : lane > 0 ? "落在右侧" : "落在中央"
                    }
                    disabled={!gameReady}
                    onClick={() => controlsRef.current?.setDropLane(lane)}
                  >
                    {lane < 0 ? "左" : lane > 0 ? "右" : "中"}
                  </button>
                ))}
              </div>
              <div
                className={`combo-pill ${snapshot.combo >= 3 ? "hot" : ""}`}
                aria-hidden={snapshot.combo < 2}
              >
                COMBO <b>×{snapshot.combo}</b>
              </div>
              {toast ? (
                <div
                  key={toast.id}
                  className={`game-toast toast-${toast.tone}`}
                  role="status"
                >
                  {toast.message}
                </div>
              ) : null}
              {gamePanel && !result ? (
                <div
                  className="game-panel-layer"
                  role="dialog"
                  aria-modal="true"
                >
                  <section className={`game-panel-card panel-${gamePanel}`}>
                    <button
                      className="panel-close"
                      onClick={closeGamePanel}
                      aria-label="关闭"
                    >
                      ×
                    </button>
                    {gamePanel === "tools" ? (
                      <>
                        <h2>技能与道具</h2>
                        <p className="toolbox-summary">
                          <b>{availableToolboxItems.length}</b> 种可用
                        </p>
                        <div className="tool-groups" aria-label="本局道具栏">
                          {toolGroups.map((group) => (
                            <section className="tool-group" key={group.id}>
                              <header>
                                <span>
                                  <b>{group.title}</b>
                                </span>
                                <em>
                                  {
                                    group.items.filter((item) => item.left > 0)
                                      .length
                                  }
                                  /{group.items.length}
                                </em>
                              </header>
                              <div className="toolbox-grid">
                                {group.items.map((item) => (
                                  <button
                                    key={item.id}
                                    disabled={
                                      item.left <= 0 || toolSeconds(item.id) > 0
                                    }
                                    onClick={() => useToolById(item.id)}
                                    aria-label={`${item.label}，${item.description}，剩余 ${item.left} 次`}
                                  >
                                    <i>{<Icon name={item.icon} />}</i>
                                    <span>
                                      <b>{item.label}</b>
                                      <small>{item.description}</small>
                                    </span>
                                    <em>
                                      {toolSeconds(item.id) > 0
                                        ? `${toolSeconds(item.id)}s`
                                        : item.left > 0
                                          ? `×${item.left}`
                                          : "—"}
                                    </em>
                                  </button>
                                ))}
                              </div>
                            </section>
                          ))}
                        </div>
                      </>
                    ) : null}
                    {gamePanel === "help" ? (
                      <>
                        <small>HOW TO PLAY</small>
                        <h2>玩法说明</h2>
                        <div className="help-flow" aria-label="玩法流程">
                          <span>点亮卡</span>
                          <i>›</i>
                          <span>三张入槽</span>
                          <i>›</i>
                          <span>选择落点</span>
                          <i>›</i>
                          <span>同果合成</span>
                        </div>
                        <div className="help-rules">
                          <span>默认每次生成 1 果</span>
                          <span>温室培育最高 3 果</span>
                          <span>水果落稳后才会合成</span>
                          <span>点击水果会弹向同级伙伴</span>
                        </div>
                        <h3>区域道具</h3>
                        <div className="zone-tool-legend">
                          <span>
                            牌桌 · <Icon name="dice" /> 洗牌 /{" "}
                            <Icon name="hammer" /> 清顶 / <Icon name="sun" />{" "}
                            净化
                          </span>
                          <span>
                            果箱 · <Icon name="bomb" /> 炸弹 /{" "}
                            <Icon name="ice" /> 冰冻 / <Icon name="gear" /> 搅拌
                          </span>
                        </div>
                        <h3>特殊牌角标</h3>
                        <div className="special-legend">
                          <span>
                            <Icon name="ice" /> 冰冻
                          </span>
                          <span>
                            <Icon name="bomb" /> 炸弹
                          </span>
                          <span>
                            <Icon name="leaf" /> 藤蔓
                          </span>
                          <span>
                            <Icon name="candy" /> 甜度
                          </span>
                          <span>
                            <Icon name="wheat" /> 丰收
                          </span>
                          <span>
                            <Icon name="gem" /> 棱镜
                          </span>
                          <span>
                            <Icon name="wind" /> 季风
                          </span>
                        </div>
                        <h3>合成路径</h3>
                        <div className="help-chain">
                          {helpChain.map((fruit, index) => (
                            <span key={fruit.name}>
                              <b>
                                <FruitIcon fruit={fruit} decorative />
                              </b>
                              <small>{fruit.name}</small>
                              {index < helpChain.length - 1 ? <i>›</i> : null}
                            </span>
                          ))}
                        </div>
                      </>
                    ) : null}
                    {gamePanel === "menu" ? (
                      <>
                        <small>MENU</small>
                        <h2>游戏菜单</h2>
                        {snapshot.weather ? (
                          <div className="run-mutator">
                            <small>
                              {snapshot.weather.name} ·{" "}
                              {snapshot.weather.seconds}s
                            </small>
                            <span>{snapshot.weather.hint}</span>
                          </div>
                        ) : null}
                        {mode === "expedition" ? (
                          <div className="run-build">
                            <div className="run-build-head">
                              <b>当前构筑</b>
                              <span>{activeRelics.length} 件奇物</span>
                            </div>
                            {snapshot.mutator ? (
                              <div className="run-mutator">
                                <small>本关变异 · {snapshot.mutator}</small>
                                <span>{snapshot.mutatorHint}</span>
                              </div>
                            ) : null}
                            <div className="run-relics">
                              {activeRelics.length ? (
                                activeRelics.map((relic) => (
                                  <span
                                    key={relic.id}
                                    title={relic.description}
                                  >
                                    <i>{<Icon name={relic.icon} />}</i>
                                    <small>{relic.name}</small>
                                  </span>
                                ))
                              ) : (
                                <em>完成本关后选择第一件奇物</em>
                              )}
                            </div>
                          </div>
                        ) : null}
                        <button
                          className="panel-primary"
                          onClick={closeGamePanel}
                        >
                          继续游戏
                        </button>
                        <div className="panel-actions">
                          <button
                            aria-pressed={!muted}
                            onClick={() => {
                              sounds.setMuted(!muted);
                              setMuted(!muted);
                            }}
                          >
                            <Icon name="volume" />{" "}
                            {muted ? "开启音效" : "关闭音效"}
                          </button>
                          <button onClick={() => setGamePanel("help")}>
                            <Icon name="book" /> 玩法说明
                          </button>
                          <button
                            onClick={() => {
                              setGamePanel(null);
                              beginGame(level, mode, {
                                wave,
                                relics,
                                score: carryScore,
                              });
                            }}
                          >
                            <Icon name="spiral" /> 重新开始
                          </button>
                          <button onClick={backHome}>
                            <Icon name="home" /> 返回首页
                          </button>
                        </div>
                      </>
                    ) : null}
                  </section>
                </div>
              ) : null}
              {result ? (
                <div className="result-layer" role="dialog" aria-modal="true">
                  <div className={`result-card result-${result.status}`}>
                    <div className="result-rays" />
                    <div className="result-emoji">
                      {result.status === "won" ? (
                        <FruitIcon
                          fruit={mode === "sprint" ? currentFruit : target}
                          decorative
                        />
                      ) : mode === "endless" ? (
                        "∞"
                      ) : (
                        <Icon name="juice" />
                      )}
                    </div>
                    <div className="result-kicker">
                      {isRelicReward
                        ? `Rogue 第 ${result.wave} 关`
                        : mode === "expedition" && result.status === "won"
                          ? "Rogue 完成"
                          : mode === "daily"
                            ? `每日鲜摘 · ${result.challengeKey}`
                            : mode === "sprint"
                              ? `限时榨汁 · ${DIFFICULTIES[result.difficulty].name}`
                              : mode === "endless"
                                ? `无尽第 ${result.wave} 波`
                                : result.status === "won"
                                  ? `第 ${level + 1} 关完成`
                                  : "本局结束"}
                    </div>
                    <h2>
                      {isRelicReward
                        ? "选择一项构筑强化"
                        : mode === "expedition" && result.status === "won"
                          ? "Rogue 通关！"
                          : mode === "sprint"
                            ? result.status === "won"
                              ? "鲜榨时间到"
                              : "鲜榨挑战结束"
                            : mode === "daily"
                              ? result.status === "won"
                                ? "今日鲜摘完成"
                                : "今日鲜摘结算"
                              : mode === "endless"
                                ? "无尽模式结算"
                                : result.status === "won"
                                  ? "甜度通关！"
                                  : "差一点就合成了"}
                    </h2>
                    <p>{result.reason}</p>
                    <div className="score-total">
                      <small>本局得分</small>
                      <strong>{formatScore(result.score)}</strong>
                    </div>
                    <div className="result-stats">
                      <span>
                        <small>最高连击</small>
                        <b>×{result.maxCombo}</b>
                      </span>
                      <span>
                        <small>最大水果</small>
                        <b>
                          <FruitIcon
                            fruit={
                              FRUITS[
                                Math.min(result.maxFruitTier, FRUITS.length - 1)
                              ]
                            }
                            decorative
                          />
                        </b>
                      </span>
                      <span>
                        <small>用时</small>
                        <b>
                          {Math.max(1, Math.round(result.durationMs / 1000))}s
                        </b>
                      </span>
                    </div>
                    <div className="coin-reward">
                      <Icon name="coin" /> +{formatScore(lastCoinReward)}{" "}
                      果币已存入温室
                      {lastCoinStarterGift ? (
                        <small> · 含新手礼 60</small>
                      ) : null}
                    </div>
                    {isRelicReward ? (
                      <div className="relic-choices">
                        {rewardOptions.map((relic) => (
                          <button
                            key={relic.id}
                            className={`relic-choice relic-${relic.tone} rarity-${relic.rarity}`}
                            onClick={() => chooseRelic(relic.id)}
                          >
                            <i>{<Icon name={relic.icon} />}</i>
                            <span className="relic-copy">
                              <span className="relic-meta">
                                <em>{RELIC_RARITY_LABEL[relic.rarity]}</em>
                                <small>{relic.archetype}</small>
                              </span>
                              <b>{relic.name}</b>
                              <small>{relic.description}</small>
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div
                        className={`save-box ${!runId ? "save-offline" : ""}`}
                      >
                        {saveState === "saved" ? (
                          <div className="saved-message">
                            {storage.persistent
                              ? "✓ 战绩已自动保存到本机"
                              : "已记入本次会话，请导出存档"}
                          </div>
                        ) : !runId ? (
                          <div className="offline-score-note">
                            <b>战绩保存在本机</b>
                            <small>
                              浏览器存储不可用，请导出存档保留战绩。
                            </small>
                          </div>
                        ) : (
                          <>
                            <label htmlFor="username">
                              留下果王名号，保存本局分数
                            </label>
                            <div className="name-row">
                              <input
                                id="username"
                                value={username}
                                maxLength={20}
                                placeholder="输入用户名"
                                autoComplete="nickname"
                                onChange={(event) =>
                                  setUsername(event.target.value)
                                }
                                onKeyDown={(event) => {
                                  if (event.key === "Enter") void submitScore();
                                }}
                              />
                              <button
                                disabled={
                                  !username.trim() ||
                                  saveState === "saving" ||
                                  !runId
                                }
                                onClick={() => void submitScore()}
                              >
                                {saveState === "saving" ? "保存中" : "保存"}
                              </button>
                            </div>
                            {saveError ? (
                              <small className="save-error">{saveError}</small>
                            ) : null}
                          </>
                        )}
                      </div>
                    )}
                    {isRelicReward ? (
                      <button
                        className="button button-ghost result-home"
                        onClick={backHome}
                      >
                        结束远征并返回
                      </button>
                    ) : (
                      <div className="result-actions">
                        <button
                          className="button button-ghost"
                          onClick={backHome}
                        >
                          返回果园
                        </button>
                        <button
                          className="button button-primary"
                          onClick={continueGame}
                        >
                          {mode === "story" &&
                          result.status === "won" &&
                          level < LEVELS.length - 1
                            ? "下一关"
                            : mode === "expedition"
                              ? "重新远征"
                              : mode === "endless"
                                ? "再战无尽"
                                : "再来一局"}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
            <div className="skill-dock" aria-label="快捷技能">
              <div
                className={`weather-status ${snapshot.weather?.phase ?? "calm"}`}
                role="status"
                title={snapshot.weather?.hint ?? "暂无天气事件"}
                aria-label={
                  snapshot.weather
                    ? `${snapshot.weather.phase === "warning" ? "即将到来：" : ""}${snapshot.weather.name}，${snapshot.weather.hint}，${snapshot.weather.seconds} 秒`
                    : "天气平静"
                }
              >
                <Icon name={snapshot.weather?.icon ?? "leaf"} />
                <span>
                  {snapshot.weather?.name ?? "晴好"}
                  <small>
                    {snapshot.weather
                      ? `${snapshot.weather.phase === "warning" ? "即将 " : ""}${snapshot.weather.seconds}s`
                      : ""}
                  </small>
                </span>
              </div>
              <button
                onClick={() => controlsRef.current?.insight()}
                disabled={
                  !gameReady ||
                  Boolean(result || gamePanel) ||
                  snapshot.insightLeft <= 0 ||
                  snapshot.insightSeconds > 0
                }
                title="标记最易凑齐的同果卡，持续 8 秒"
                aria-label={`透视镜，剩余 ${snapshot.insightLeft} 次`}
              >
                <Icon name="compass" />
                <span>
                  透视
                  <small>
                    {snapshot.insightSeconds > 0
                      ? `${snapshot.insightSeconds}s`
                      : `×${snapshot.insightLeft}`}
                  </small>
                </span>
              </button>
              <button
                onClick={() => controlsRef.current?.vortex()}
                disabled={
                  !gameReady ||
                  Boolean(result || gamePanel) ||
                  snapshot.vortexLeft <= 0 ||
                  snapshot.vortexSeconds > 0
                }
                title="同果吸引增强，持续 10 秒"
                aria-label={`聚果场，剩余 ${snapshot.vortexLeft} 次`}
              >
                <Icon name="spiral" />
                <span>
                  聚果
                  <small>
                    {snapshot.vortexSeconds > 0
                      ? `${snapshot.vortexSeconds}s`
                      : `×${snapshot.vortexLeft}`}
                  </small>
                </span>
              </button>
            </div>
          </div>
        </section>
      )}
      {archiveOpen ? (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="我的存档"
        >
          <section className="modal-card archive-card">
            <button
              className="panel-close"
              onClick={() => setArchiveOpen(false)}
              aria-label="关闭"
            >
              ×
            </button>
            <span className="modal-kicker">TAKE YOUR ORCHARD WITH YOU</span>
            <h2>把果园装进口袋</h2>
            <p className="modal-copy">
              关卡、果币、温室和最高分保存在当前浏览器。换设备或清理浏览器前，记得导出一份存档。
            </p>
            <label className="profile-name">
              你的果园名号
              <input
                maxLength={20}
                defaultValue={storage.getItem("fruit-king-name") || "果园旅人"}
                onChange={(e) =>
                  storage.setItem(
                    "fruit-king-name",
                    e.target.value.trim().slice(0, 20) || "果园旅人",
                  )
                }
              />
            </label>
            <button
              className="button button-primary"
              onClick={() => {
                const url = URL.createObjectURL(
                  new Blob([exportSave()], { type: "application/json" }),
                );
                const link = document.createElement("a");
                link.href = url;
                link.download = `orchard-${new Date().toISOString().slice(0, 10)}.json`;
                link.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
              }}
            >
              导出存档
            </button>
            <label className="import-save">
              导入存档
              <input
                type="file"
                accept=".json,application/json"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    if (file.size > 2_000_000) throw new Error("存档文件过大");
                    const saved = importSave(await file.text());
                    setCoins(readCoins());
                    setUpgrades(readUpgrades());
                    setTools(readTools());
                    setUnlocked(readProgress());
                    setLevel(readProgress());
                    const nextMuted =
                      storage.getItem("fruit-king-muted") === "true";
                    sounds.setMuted(nextMuted);
                    setMuted(nextMuted);
                    setArchiveMessage(
                      saved
                        ? "存档已恢复，欢迎回到果园。"
                        : "已恢复到本次会话；浏览器无法持久保存，请保留导出文件。",
                    );
                  } catch (err) {
                    setArchiveMessage(
                      err instanceof Error
                        ? err.message
                        : "导入失败，原存档未改变",
                    );
                  }
                  e.target.value = "";
                }}
              />
            </label>
            <small className="storage-note">
              导入会覆盖文件中的同名进度。建议先导出当前存档。
            </small>
            <p role="status">{archiveMessage}</p>
          </section>
        </div>
      ) : null}
      {collectionOpen ? (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="水果图鉴"
        >
          <section className="modal-card collection-card">
            <button
              className="panel-close"
              onClick={() => setCollectionOpen(false)}
              aria-label="关闭"
            >
              ×
            </button>
            <span className="modal-kicker">MEET THE WHOLE ORCHARD</span>
            <h2>从蓝莓，到果王</h2>
            <p className="modal-copy">
              两颗相同水果落稳后相遇，会变成下一种。点击果箱里的水果，可以帮它找到伙伴。
            </p>
            <div className="collection-grid">
              {FRUITS.map((fruit, index) => (
                <div key={fruit.name}>
                  <small>{String(index + 1).padStart(2, "0")}</small>
                  <FruitIcon fruit={fruit} />
                  <b>{fruit.name}</b>
                </div>
              ))}
            </div>
            <button
              className="button button-primary"
              onClick={() => setCollectionOpen(false)}
            >
              回到果园
            </button>
          </section>
        </div>
      ) : null}
      {shopOpen ? (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="果园温室"
        >
          <section className="modal-card shop-card">
            <button
              className="panel-close"
              onClick={() => setShopOpen(false)}
              aria-label="关闭"
            >
              ×
            </button>
            <div className="modal-kicker">ORCHARD GREENHOUSE</div>
            <h2>果园温室</h2>
            <p className="modal-copy">
              每局结算都会攒下果币，在这里兑换跨局永久成长。
            </p>
            <div className="coin-balance">
              <Icon name="coin" /> {formatScore(coins)}
            </div>
            <div
              className={`greenhouse-stage growth-${Math.min(6, greenhouseGrowth)}`}
              aria-label={`温室成长等级 ${greenhouseGrowth}`}
            >
              <span className="greenhouse-sun">
                <Icon name="sun" />
              </span>
              <span className="greenhouse-cloud cloud-a">
                <Icon name="cloud" />
              </span>
              <span className="greenhouse-cloud cloud-b">
                <Icon name="cloud" />
              </span>
              <div className="greenhouse-vines" aria-hidden="true">
                〰 <Icon name="leaf" /> 〰 <Icon name="leaf" /> 〰
              </div>
              <div className="greenhouse-plants">
                {UPGRADES.map((item) => {
                  const plantLevel = Math.min(3, upgrades[item.id]);
                  return (
                    <span
                      className={`greenhouse-plant plant-level-${plantLevel}`}
                      key={item.id}
                      title={`${item.name} ${upgrades[item.id]}/${item.maxLevel}`}
                    >
                      <b>{<Icon name={GREENHOUSE_PLANTS[plantLevel]} />}</b>
                      {plantLevel > 0 ? (
                        <i>{<Icon name={item.icon} />}</i>
                      ) : null}
                    </span>
                  );
                })}
              </div>
              {shopPulse > 0 ? (
                <div className="greenhouse-burst" key={shopPulse}>
                  <span>
                    <Icon name="spark" />
                  </span>
                  <span>
                    <Icon name="leaf" />
                  </span>
                  <span>
                    <Icon name="coin" />
                  </span>
                  <span>
                    <Icon name="spark" />
                  </span>
                  <span>
                    <Icon name="leaf" />
                  </span>
                </div>
              ) : null}
            </div>
            <div className="shop-section-head greenhouse-section-head">
              <span>长期培育</span>
              <small>收益放缓 · 每级更有分量</small>
            </div>
            <div className="upgrade-list">
              {UPGRADES.map((item) => {
                const levelNow = upgrades[item.id];
                const maxed = levelNow >= item.maxLevel;
                const cost = maxed ? 0 : item.costs[levelNow];
                return (
                  <div
                    className={`upgrade-row ${item.id === "sweet_start" ? "upgrade-featured" : ""}`}
                    key={item.id}
                  >
                    <i>{<Icon name={item.icon} />}</i>
                    <span className="upgrade-info">
                      <b>
                        {item.name}
                        <small>
                          Lv. {levelNow}/{item.maxLevel}
                        </small>
                      </b>
                      <small>
                        {maxed
                          ? item.describe(levelNow)
                          : `下一级：${item.describe(levelNow + 1)}`}
                      </small>
                    </span>
                    <button
                      disabled={maxed || coins < cost}
                      onClick={() => buyUpgrade(item.id)}
                    >
                      {maxed ? "已满级" : `${cost} 果币`}
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="shop-section-head">
              <span>道具补给</span>
              <small>升级每局次数</small>
            </div>
            <div className="supply-grid">
              {TOOLS.map((item) => {
                const levelNow = tools[item.id];
                const baseUses = BASE_TOOL_IDS.has(item.id) ? 1 : 0;
                const maxed = levelNow >= item.maxLevel;
                const rawCost = maxed ? 0 : item.costs[levelNow];
                const cost = Math.max(
                  1,
                  Math.round((rawCost * (1 - upgrades.pack * 0.06)) / 5) * 5,
                );
                return (
                  <div className="supply-card" key={item.id}>
                    <i>{<Icon name={item.icon} />}</i>
                    <span>
                      <b>{item.name}</b>
                      <small>{item.description}</small>
                      <em>
                        每局 ×{levelNow + baseUses}
                        {baseUses ? ` · 含基础 ${baseUses} 次` : ""}
                      </em>
                    </span>
                    <button
                      disabled={maxed || coins < cost}
                      onClick={() => buyTool(item.id)}
                    >
                      {maxed ? "已配满" : `${cost} 果币`}
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="modal-actions split-actions">
              <button
                className="button button-primary"
                onClick={() => setShopOpen(false)}
              >
                返回果园
              </button>
            </div>
          </section>
        </div>
      ) : null}
      {leaderboardOpen ? (
        <Leaderboard
          entries={leaderboard}
          loading={leaderboardLoading}
          offline={leaderboardOffline}
          mode={leaderboardMode}
          onModeChange={changeLeaderboardMode}
          onClose={() => setLeaderboardOpen(false)}
          onRefresh={() => loadLeaderboard(leaderboardMode)}
        />
      ) : null}
    </main>
  );
}
