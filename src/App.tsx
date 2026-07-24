import { useCallback, useEffect, useRef, useState } from "react";
import {
  getLeaderboard,
  saveScore,
  startRun,
  type LeaderboardEntry,
} from "./api";
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
type TutorialStep = "pick" | "tray" | "lane" | null;
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
  wave: 1,
  mode: "story",
  relics: [],
  feverEnergy: 0,
  feverActive: false,
  mutator: "",
  mutatorHint: "",
  dropLane: 0,
};

const GREENHOUSE_PLANTS = ["🌱", "🌿", "🌸", "🍓"];
const MODE_UNLOCK_LEVEL: Partial<Record<GameMode, number>> = {
  endless: 2,
  expedition: 4,
};
const TUTORIAL_KEY = "fruit-king-tutorial-v2";
const STARTER_GIFT_KEY = "fruit-king-starter-gift-v1";
const CARD_BASE_TOOL_IDS = new Set<ToolId>(["shuffle", "hammer", "sun"]);
const FRUIT_BASE_TOOL_IDS = new Set<ToolId>(["bomb", "shield", "quake"]);
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
  const stored = Number(localStorage.getItem("fruit-king-unlocked") || 0);
  return Number.isFinite(stored)
    ? Math.max(0, Math.min(stored, LEVELS.length - 1))
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
  const classes =
    `fruit-visual ${fruit.icon ? "fruit-visual-image" : "fruit-visual-emoji"} ${className}`.trim();
  if (fruit.icon) {
    return (
      <img
        className={classes}
        src={fruit.icon}
        alt={decorative ? "" : fruit.name}
        draggable={false}
      />
    );
  }
  return (
    <span
      className={classes}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : fruit.name}
      aria-hidden={decorative ? true : undefined}
    >
      {fruit.emoji}
    </span>
  );
}

function readCoins() {
  const stored = Number(localStorage.getItem("fruit-king-coins") || 0);
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
      localStorage.getItem("fruit-king-upgrades") || "{}",
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
      localStorage.getItem("fruit-king-tools") || "{}",
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
  onDropLaneChange,
}: {
  level: number;
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
  onDropLaneChange: () => void;
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
          { level, mode, wave, relics, startingScore, upgrades },
          { onSnapshot, onFinish, onToast, onDropLaneChange },
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
    mode,
    onFinish,
    onReady,
    onSnapshot,
    onToast,
    onDropLaneChange,
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
      aria-label="叠个果王游戏画面"
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
  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="全球排行榜"
    >
      <section className="modal-card leaderboard-card">
        <div className="modal-kicker">GLOBAL JUICE LEAGUE</div>
        <h2>果王排行榜</h2>
        <p className="modal-copy">
          {mode === "story"
            ? "全关卡玩家进度排行 · 每位玩家展示最佳战绩"
            : "每位玩家展示最佳战绩，不再被重复记录挤满。"}
        </p>
        <div className="leaderboard-tabs">
          {(Object.keys(MODE_INFO) as GameMode[]).map((item) => (
            <button
              key={item}
              className={mode === item ? "active" : ""}
              onClick={() => onModeChange(item)}
            >
              {MODE_INFO[item].icon} {MODE_INFO[item].name}
            </button>
          ))}
        </div>
        <div className="rank-list">
          {loading ? (
            <div className="empty-state">正在采摘最新战绩…</div>
          ) : null}
          {!loading && offline ? (
            <div className="empty-state">
              排行榜暂时离线，游戏仍可正常进行。
            </div>
          ) : null}
          {!loading && !offline && entries.length === 0 ? (
            <div className="empty-state">第一名正在等你来拿。</div>
          ) : null}
          {entries.map((entry, index) => (
            <div
              className={`rank-row rank-${index + 1}`}
              key={`${entry.username}-${entry.createdAt}`}
            >
              <span className="rank-number">
                {index < 3
                  ? ["🥇", "🥈", "🥉"][index]
                  : String(index + 1).padStart(2, "0")}
              </span>
              <span className="rank-player">
                <strong>{entry.username}</strong>
                <small>
                  {mode === "story"
                    ? `第 ${entry.level + 1} 关`
                    : mode === "endless"
                      ? `第 ${entry.level} 波`
                      : `远征路线 ${entry.level + 1}`}{" "}
                  · 最高{" "}
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
  const [screen, setScreen] = useState<Screen>("home");
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
  const [tutorialStep, setTutorialStep] = useState<TutorialStep>(null);
  const controlsRef = useRef<GameControls | null>(null);
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
    localStorage.setItem("fruit-king-coins", String(next));
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
    localStorage.setItem("fruit-king-upgrades", JSON.stringify(nextUpgrades));
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
    localStorage.setItem("fruit-king-tools", JSON.stringify(nextTools));
    setTools(nextTools);
    persistCoins(coins - cost);
    setShopPulse((value) => value + 1);
    gameUpgrades.current = { ...gameUpgrades.current, tools: nextTools };
  };

  const handleReady = useCallback((controls: GameControls | null) => {
    controlsRef.current = controls;
  }, []);
  const persistUnlocked = useCallback((nextLevel: number) => {
    const safeLevel = Math.max(0, Math.min(nextLevel, LEVELS.length - 1));
    const persisted = readProgress();
    const nextUnlocked = Math.max(persisted, safeLevel);
    localStorage.setItem("fruit-king-unlocked", String(nextUnlocked));
    setUnlocked((current) => Math.max(current, nextUnlocked));
    return nextUnlocked;
  }, []);
  const handleSnapshot = useCallback((next: GameSnapshot) => {
    setSnapshot(next);
    setTutorialStep((current) => {
      if (current === "pick" && next.trayCount > 0) return "tray";
      if (current === "tray" && next.score > 0) return "lane";
      return current;
    });
  }, []);

  const finishTutorial = useCallback(() => {
    localStorage.setItem(TUTORIAL_KEY, "done");
    setTutorialStep(null);
  }, []);

  const handleDropLaneChange = useCallback(() => {
    setTutorialStep((current) => {
      if (current !== "lane") return current;
      localStorage.setItem(TUTORIAL_KEY, "done");
      return null;
    });
  }, []);
  const handleFinish = useCallback(
    (next: GameResult) => {
      setGamePanel(null);
      setResult(next);
      const starterGift =
        next.mode === "story" &&
        next.status === "won" &&
        level === 0 &&
        localStorage.getItem(STARTER_GIFT_KEY) !== "claimed";
      const reward =
        computeCoinReward(next, readUpgrades()) + (starterGift ? 60 : 0);
      if (starterGift) localStorage.setItem(STARTER_GIFT_KEY, "claimed");
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
      setTutorialStep(
        targetMode === "story" &&
          targetLevel === 0 &&
          localStorage.getItem(TUTORIAL_KEY) !== "done"
          ? "pick"
          : null,
      );
      setScreen("game");
      setSession((value) => value + 1);
      void startRun(
        targetMode,
        targetMode === "endless" ? nextWave : targetLevel,
      )
        .then(({ runId: id }) => setRunId(id))
        .catch(() => setRunId(null));
    },
    [level, mode],
  );

  const startSelectedMode = () => {
    const requiredLevel = MODE_UNLOCK_LEVEL[mode] || 0;
    if (unlocked < requiredLevel) return;
    if (mode === "story") {
      beginGame(level, "story");
      return;
    }
    // 远征福袋:远征开局自带 1 件随机奇物
    const startingRelics =
      mode === "expedition" && upgrades.relic_start >= 1
        ? pickRelics([], 1).map((relic) => relic.id)
        : [];
    beginGame(0, mode, { wave: 1, relics: startingRelics, score: 0 });
  };

  const backHome = () => {
    controlsRef.current?.destroy();
    controlsRef.current = null;
    setGamePanel(null);
    setTutorialStep(null);
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
    beginGame(0, mode, { wave: 1, relics: startingRelics, score: 0 });
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
      if (leaderboardOpen) {
        setLeaderboardOpen(false);
      } else if (shopOpen) {
        setShopOpen(false);
      } else if (gamePanel) {
        closeGamePanel();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [gamePanel, leaderboardOpen, shopOpen]);

  const target = FRUITS[LEVELS[level].target];
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
      id: "undo",
      icon: "🕰️",
      label: "撤回",
      description: "退回上一张普通卡",
      category: "card",
      left: snapshot.undoLeft,
    },
    {
      id: "shuffle",
      icon: "🎲",
      label: "洗牌",
      description: "重排并优先露出三消路线",
      category: "card",
      left: snapshot.shuffleLeft,
    },
    {
      id: "hammer",
      icon: "🔨",
      label: "清顶",
      description: "自动收取最有用的顶层卡",
      category: "card",
      left: snapshot.hammerLeft,
    },
    {
      id: "wild",
      icon: "🍀",
      label: "万能",
      description: "补齐卡槽里最接近的三消",
      category: "card",
      left: snapshot.wildLeft,
    },
    {
      id: "bubble",
      icon: "🫧",
      label: "清槽",
      description: "收起两张最难配对的散牌",
      category: "card",
      left: snapshot.bubbleLeft,
    },
    {
      id: "sun",
      icon: "☀️",
      label: "净化",
      description: "清障；无障碍时转为狂热充能",
      category: "card",
      left: snapshot.sunLeft,
    },
    {
      id: "bomb",
      icon: "💣",
      label: "炸弹",
      description: "清理警戒线附近的低阶水果",
      category: "fruit",
      left: snapshot.bombLeft,
    },
    {
      id: "shield",
      icon: "🧊",
      label: "冰冻",
      description: "暂停物理和警戒线 6 秒",
      category: "fruit",
      left: snapshot.shieldLeft,
    },
    {
      id: "quake",
      icon: "⚙️",
      label: "搅拌",
      description: "重排果箱，解开堆叠死角",
      category: "fruit",
      left: snapshot.quakeLeft,
    },
    {
      id: "juice",
      icon: "🥤",
      label: "榨汁",
      description: "最高阶水果降一级并减压",
      category: "fruit",
      left: snapshot.juiceLeft,
    },
    {
      id: "magnet",
      icon: "🧲",
      label: "合并",
      description: "立即合成一对落稳水果",
      category: "fruit",
      left: snapshot.magnetLeft,
    },
    {
      id: "ripen",
      icon: "🌱",
      label: "催熟",
      description: "最低阶水果直接升一级",
      category: "fruit",
      left: snapshot.ripenLeft,
    },
    {
      id: "split",
      icon: "✂️",
      label: "分果",
      description: "最高阶水果拆成两个低一级水果",
      category: "fruit",
      left: snapshot.splitLeft,
    },
    {
      id: "harvest",
      icon: "🌾",
      label: "丰收",
      description: "下一次三消额外生成水果",
      category: "boost",
      left: snapshot.harvestLeft,
    },
    {
      id: "basket",
      icon: "🧺",
      label: "采摘",
      description: "穿层采收一组三张同果卡",
      category: "card",
      left: snapshot.basketLeft,
    },
    {
      id: "syrup",
      icon: "🍯",
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
    <main className="app-shell">
      <div className="noise" />
      {screen === "home" ? (
        <section className="home-screen">
          <div className="hero-orbit" aria-hidden="true">
            <span className="orbit-fruit fruit-a">🍓</span>
            <span className="orbit-fruit fruit-b">🍋</span>
            <span className="orbit-fruit fruit-c">
              <FruitIcon
                fruit={FRUITS.find((fruit) => fruit.name === "西瓜")!}
                decorative
              />
            </span>
            <span className="orbit-fruit fruit-d">🍇</span>
            <div className="crown-core">
              <FruitIcon
                fruit={FRUITS[FRUITS.length - 1]}
                className="hero-fruit-icon"
                decorative
              />
            </div>
          </div>
          <div className="eyebrow">
            <i /> NEON ORCHARD <i />
          </div>
          <h1>
            叠个<span>果王</span>
          </h1>
          <p className="tagline">点三张，自选落点，弹射合成果王！</p>
          <div className="mode-switch" aria-label="选择游戏模式">
            {(Object.keys(MODE_INFO) as GameMode[]).map((item) => {
              const requiredLevel = MODE_UNLOCK_LEVEL[item] || 0;
              const locked = unlocked < requiredLevel;
              return (
                <button
                  key={item}
                  className={mode === item ? "active" : ""}
                  disabled={locked}
                  title={
                    locked ? `完成第 ${requiredLevel} 关后解锁` : undefined
                  }
                  onClick={() => setMode(item)}
                >
                  <i>{locked ? "🔒" : MODE_INFO[item].icon}</i>
                  <span>
                    {MODE_INFO[item].name}
                    {locked ? <small>第 {requiredLevel} 关解锁</small> : null}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="mode-card">
            <div className="mode-topline">
              <span>{MODE_INFO[mode].name}</span>
              <b>
                {mode === "story"
                  ? unlocked + 1
                  : mode === "endless"
                    ? "∞"
                    : "ROGUE"}
                {mode === "story" ? <small> / {LEVELS.length}</small> : null}
              </b>
            </div>
            {mode === "story" ? (
              <div className="level-track" ref={levelTrackRef}>
                {LEVELS.map((item, index) => (
                  <button
                    key={item.name}
                    className={`level-dot ${index <= unlocked ? "unlocked" : ""} ${index === level ? "selected" : ""}`}
                    disabled={index > unlocked}
                    aria-label={`${item.name}${index > unlocked ? "，未解锁" : ""}`}
                    onClick={() => setLevel(index)}
                  >
                    {index < unlocked ? "✓" : index + 1}
                  </button>
                ))}
              </div>
            ) : (
              <p className="mode-description">{MODE_INFO[mode].tagline}</p>
            )}
            <div className="mission-preview">
              <span className="mission-icon">
                {mode === "story" ? (
                  <FruitIcon fruit={target} decorative />
                ) : (
                  MODE_INFO[mode].icon
                )}
              </span>
              <span>
                <small>
                  {mode === "story"
                    ? `第 ${level + 1} 关`
                    : mode === "endless"
                      ? "一直玩"
                      : "8 关"}
                </small>
                <strong>
                  {mode === "story"
                    ? LEVELS[level].name
                    : mode === "endless"
                      ? "冲最高分"
                      : "过关选奇物"}
                </strong>
              </span>
              <span className="mission-target">
                {mode === "story"
                  ? "目标"
                  : mode === "endless"
                    ? "记录"
                    : "奇物"}
                <br />
                <b>
                  {mode === "story"
                    ? target.name
                    : mode === "endless"
                      ? "最高分"
                      : `${RELICS.length} 种`}
                </b>
              </span>
            </div>
          </div>
          <button className="button button-play" onClick={startSelectedMode}>
            <span>
              {mode === "story"
                ? "开始挑战"
                : mode === "endless"
                  ? "开始无尽"
                  : "开始 Rogue"}
            </span>
            <i>▶</i>
          </button>
          <div className="home-links">
            <button className="leaderboard-link" onClick={openLeaderboard}>
              <span>🏆</span> 全球排行榜
            </button>
            <button
              className="leaderboard-link"
              onClick={() => setShopOpen(true)}
            >
              <span>🏡</span> 果园温室 · 🪙{formatScore(coins)}
            </button>
          </div>
        </section>
      ) : (
        <section className="play-layout">
          <aside className="desktop-brief">
            <button className="brand-button" onClick={backHome}>
              叠个<span>果王</span>
            </button>
            <p>三张消除，自选落点。</p>
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
              🏆 查看排行榜
            </button>
          </aside>
          <div
            className="game-phone"
            onPointerDown={() => {
              if (toast) dismissToast();
            }}
          >
            <GameCanvas
              level={level}
              mode={mode}
              wave={wave}
              relics={relics}
              startingScore={carryScore}
              upgrades={gameUpgrades.current}
              session={session}
              onReady={handleReady}
              onSnapshot={handleSnapshot}
              onFinish={handleFinish}
              onToast={handleToast}
              onDropLaneChange={handleDropLaneChange}
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
                      : snapshot.maxFruitTier >= LEVELS[level].target
                        ? "目标达成 · 清牌或满槽过关"
                        : `剩余 ${snapshot.remainingCards} 张 · 槽 ${snapshot.trayCount}/${snapshot.trayLimit}`}
                </small>
                <strong>
                  {mode === "endless" ? (
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
                onClick={() => openGamePanel("tools")}
                aria-label={`打开道具栏，${availableToolboxItems.length} 种可用`}
              >
                <i>
                  🧰
                  <em>{availableToolboxItems.length}</em>
                </i>
                <span>道具</span>
              </button>
              <button
                className="top-action"
                onClick={() => openGamePanel("menu")}
                aria-label="打开游戏菜单"
              >
                <i>⚙️</i>
                <span>菜单</span>
              </button>
            </header>
            <div className="drop-lane-control" aria-label="选择下次落果位置">
              <span>下次落点</span>
              {([-1, 0, 1] as const).map((lane) => (
                <button
                  key={lane}
                  className={snapshot.dropLane === lane ? "active" : ""}
                  aria-label={
                    lane < 0 ? "落在左侧" : lane > 0 ? "落在右侧" : "落在中央"
                  }
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
              <button
                type="button"
                key={toast.id}
                className={`game-toast toast-${toast.tone}`}
                onClick={dismissToast}
                aria-label="关闭提示"
              >
                {toast.message}
              </button>
            ) : null}
            {tutorialStep ? (
              <div
                className={`tutorial-coach tutorial-${tutorialStep}`}
                role="status"
              >
                <span>
                  {tutorialStep === "pick"
                    ? "① 点有金边的亮牌，先收集相同水果"
                    : tutorialStep === "tray"
                      ? "② 凑齐三张，卡槽会自动消除并落果"
                      : "③ 选择左、中、右，决定下一颗水果落点"}
                </span>
                <button onClick={finishTutorial}>跳过</button>
              </div>
            ) : null}
            {gamePanel && !result ? (
              <div className="game-panel-layer" role="dialog" aria-modal="true">
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
                      <small>ORCHARD TOOL BAR</small>
                      <h2>道具栏</h2>
                      <p className="toolbox-summary">
                        <b>{availableToolboxItems.length}</b> 种可用
                        <span>点击后立即生效</span>
                      </p>
                      <div className="tool-groups" aria-label="本局道具栏">
                        {toolGroups.map((group) => (
                          <section className="tool-group" key={group.id}>
                            <header>
                              <span>
                                <b>{group.title}</b>
                                <small>{group.hint}</small>
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
                                  disabled={item.left <= 0}
                                  onClick={() => useToolById(item.id)}
                                  aria-label={`${item.label}，${item.description}，剩余 ${item.left} 次`}
                                >
                                  <i>{item.icon}</i>
                                  <span>
                                    <b>{item.label}</b>
                                    <small>{item.description}</small>
                                  </span>
                                  <em>
                                    {item.left > 0 ? `×${item.left}` : "未配置"}
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
                        <span>牌桌 · 🎲 洗牌 / 🔨 清顶 / ☀️ 净化</span>
                        <span>果箱 · 💣 炸弹 / 🧊 冰冻 / ⚙️ 搅拌</span>
                      </div>
                      <h3>特殊牌角标</h3>
                      <div className="special-legend">
                        <span>🧊 冰冻</span>
                        <span>💣 炸弹</span>
                        <span>🌿 藤蔓</span>
                        <span>🍬 甜度</span>
                        <span>🌾 丰收</span>
                        <span>🔮 棱镜</span>
                        <span>🌪️ 季风</span>
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
                                <span key={relic.id} title={relic.description}>
                                  <i>{relic.icon}</i>
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
                        <button onClick={() => setGamePanel("help")}>
                          ? 玩法说明
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
                          ↻ 重新开始
                        </button>
                        <button onClick={backHome}>⌂ 返回首页</button>
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
                      <FruitIcon fruit={target} decorative />
                    ) : mode === "endless" ? (
                      "∞"
                    ) : (
                      "🍹"
                    )}
                  </div>
                  <div className="result-kicker">
                    {isRelicReward
                      ? `Rogue 第 ${result.wave} 关`
                      : mode === "expedition" && result.status === "won"
                        ? "Rogue 完成"
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
                    🪙 +{formatScore(lastCoinReward)} 果币已存入温室
                    {lastCoinStarterGift ? <small> · 含新手礼 60</small> : null}
                  </div>
                  {isRelicReward ? (
                    <div className="relic-choices">
                      {rewardOptions.map((relic) => (
                        <button
                          key={relic.id}
                          className={`relic-choice relic-${relic.tone} rarity-${relic.rarity}`}
                          onClick={() => chooseRelic(relic.id)}
                        >
                          <i>{relic.icon}</i>
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
                    <div className={`save-box ${!runId ? "save-offline" : ""}`}>
                      {saveState === "saved" ? (
                        <div className="saved-message">
                          ✓ 战绩已进入全球排行榜
                        </div>
                      ) : !runId ? (
                        <div className="offline-score-note">
                          <b>战绩保存在本机</b>
                          <small>排行榜暂时离线，不影响继续闯关。</small>
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
                      暂停远征并返回
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
        </section>
      )}
      {shopOpen ? (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="果园温室"
        >
          <section className="modal-card shop-card">
            <div className="modal-kicker">ORCHARD GREENHOUSE</div>
            <h2>果园温室</h2>
            <p className="modal-copy">
              每局结算都会攒下果币，在这里兑换跨局永久成长。
            </p>
            <div className="coin-balance">🪙 {formatScore(coins)}</div>
            <div
              className={`greenhouse-stage growth-${Math.min(6, greenhouseGrowth)}`}
              aria-label={`温室成长等级 ${greenhouseGrowth}`}
            >
              <span className="greenhouse-sun">☀️</span>
              <span className="greenhouse-cloud cloud-a">☁️</span>
              <span className="greenhouse-cloud cloud-b">☁️</span>
              <div className="greenhouse-vines" aria-hidden="true">
                〰 🌿 〰 🌿 〰
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
                      <b>{GREENHOUSE_PLANTS[plantLevel]}</b>
                      {plantLevel > 0 ? <i>{item.icon}</i> : null}
                    </span>
                  );
                })}
              </div>
              {shopPulse > 0 ? (
                <div className="greenhouse-burst" key={shopPulse}>
                  <span>✨</span>
                  <span>🍃</span>
                  <span>🪙</span>
                  <span>✨</span>
                  <span>🍓</span>
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
                    <i>{item.icon}</i>
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
                      {maxed ? "已满级" : `🪙 ${cost}`}
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="shop-section-head">
              <span>道具补给</span>
              <small>购买后每局携带 · 未购买不出现</small>
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
                    <i>{item.icon}</i>
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
                      {maxed ? "已配满" : `🪙 ${cost}`}
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
