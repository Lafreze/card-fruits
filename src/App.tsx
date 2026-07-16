import { useCallback, useEffect, useRef, useState } from "react";
import {
  getLeaderboard,
  saveScore,
  startRun,
  type LeaderboardEntry,
} from "./api";
import { FRUITS, LEVELS } from "./game/data";
import type { FruitGame } from "./game/FruitGame";
import {
  MODE_INFO,
  RELICS,
  pickRelics,
  type GameMode,
  type RelicDefinition,
  type RelicId,
} from "./game/modes";
import type {
  GameControls,
  GameResult,
  GameSnapshot,
} from "./game/types";

type Screen = "home" | "game";
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
  dangerProgress: 0,
  undoLeft: 1,
  shuffleLeft: 3,
  juiceLeft: 1,
  hammerLeft: 1,
  magnetLeft: 1,
  wave: 1,
  mode: "story",
  relics: [],
};

function readProgress() {
  const stored = Number(localStorage.getItem("fruit-king-unlocked") || 0);
  return Number.isFinite(stored)
    ? Math.max(0, Math.min(stored, LEVELS.length - 1))
    : 0;
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
  session,
  onReady,
  onSnapshot,
  onFinish,
  onToast,
}: {
  level: number;
  mode: GameMode;
  wave: number;
  relics: RelicId[];
  startingScore: number;
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
          { level, mode, wave, relics, startingScore },
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
  }, [level, mode, onFinish, onReady, onSnapshot, onToast, relics, session, startingScore, wave]);

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
        <p className="modal-copy">每一分都来自真实完成的果园挑战。</p>
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
                      : `远征路线 ${entry.level + 1}`} · 最高{" "}
                  {FRUITS[Math.min(entry.fruitTier, FRUITS.length - 1)].emoji} ·{" "}
                  {entry.maxCombo} 连击
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
  const controlsRef = useRef<GameControls | null>(null);
  const toastTimer = useRef<number | null>(null);

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
  const handleSnapshot = useCallback(
    (next: GameSnapshot) => setSnapshot(next),
    [],
  );
  const handleFinish = useCallback(
    (next: GameResult) => {
      setResult(next);
      if (next.status === "won") {
        if (mode === "story") persistUnlocked(level + 1);
        if (mode === "expedition" && relics.length < 7)
          setRewardOptions(pickRelics(relics));
      }
    },
    [level, mode, persistUnlocked, relics],
  );
  const handleToast = useCallback(
    (message: string, tone: "gold" | "pink" | "cyan" = "pink") => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
      setToast({ id: Date.now(), message, tone });
      toastTimer.current = window.setTimeout(() => setToast(null), 1_750);
    },
    [],
  );

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
      setScreen("game");
      setSession((value) => value + 1);
      void startRun(targetMode, targetMode === "endless" ? nextWave : targetLevel)
        .then(({ runId: id }) => setRunId(id))
        .catch(() => setRunId(null));
    },
    [level, mode],
  );

  const startSelectedMode = () => {
    if (mode === "story") beginGame(level, "story");
    else beginGame(0, mode, { wave: 1, relics: [], score: 0 });
  };

  const backHome = () => {
    controlsRef.current?.destroy();
    controlsRef.current = null;
    setResult(null);
    setScreen("home");
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
    beginGame(0, mode, { wave: 1, relics: [], score: 0 });
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

  const loadLeaderboard = useCallback((selectedMode = leaderboardMode) => {
    setLeaderboardLoading(true);
    setLeaderboardOffline(false);
    void getLeaderboard(selectedMode)
      .then((data) => {
        setLeaderboard(data.scores);
        setLeaderboardOffline(Boolean(data.offline));
      })
      .catch(() => setLeaderboardOffline(true))
      .finally(() => setLeaderboardLoading(false));
  }, [leaderboardMode]);

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

  const target = FRUITS[LEVELS[level].target];
  const isRelicReward =
    mode === "expedition" &&
    result?.status === "won" &&
    rewardOptions.length > 0;

  return (
    <main className="app-shell">
      <div className="noise" />
      {screen === "home" ? (
        <section className="home-screen">
          <div className="hero-orbit" aria-hidden="true">
            <span className="orbit-fruit fruit-a">🍓</span>
            <span className="orbit-fruit fruit-b">🍋</span>
            <span className="orbit-fruit fruit-c">🍉</span>
            <span className="orbit-fruit fruit-d">🍇</span>
            <div className="crown-core">👑</div>
          </div>
          <div className="eyebrow">
            <i /> NEON ORCHARD <i />
          </div>
          <h1>
            叠个<span>果王</span>
          </h1>
          <p className="tagline">点三张，掉一颗，碰两颗，合成果王！</p>
          <div className="mode-switch" aria-label="选择游戏模式">
            {(Object.keys(MODE_INFO) as GameMode[]).map((item) => (
              <button
                key={item}
                className={mode === item ? "active" : ""}
                onClick={() => setMode(item)}
              >
                <i>{MODE_INFO[item].icon}</i>
                <span>{MODE_INFO[item].name}</span>
              </button>
            ))}
          </div>
          <div className="mode-card">
            <div className="mode-topline">
              <span>{MODE_INFO[mode].name}</span>
              <b>
                {mode === "story" ? unlocked + 1 : mode === "endless" ? "∞" : "ROGUE"}
                {mode === "story" ? <small> / {LEVELS.length}</small> : null}
              </b>
            </div>
            {mode === "story" ? (
              <div className="level-track">
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
                {mode === "story" ? target.emoji : MODE_INFO[mode].icon}
              </span>
              <span>
                <small>
                  {mode === "story" ? `第 ${level + 1} 关` : mode === "endless" ? "无限波次" : "随机远征"}
                </small>
                <strong>
                  {mode === "story"
                    ? LEVELS[level].name
                    : mode === "endless"
                      ? "双果王 · 彩虹清场"
                      : "每关三选一奇物"}
                </strong>
              </span>
              <span className="mission-target">
                {mode === "story" ? "目标" : mode === "endless" ? "生存" : "构筑"}
                <br />
                <b>{mode === "story" ? target.name : mode === "endless" ? "最高分" : "8 种奇物"}</b>
              </span>
            </div>
          </div>
          <button className="button button-play" onClick={startSelectedMode}>
            <span>{mode === "story" ? "开始挑战" : mode === "endless" ? "进入无尽" : "开始远征"}</span>
            <i>▶</i>
          </button>
          <div className="special-legend">
            <span>❄ 邻卡解冻</span>
            <span>💣 爆炸连取</span>
            <span>🌿 点击剪藤</span>
          </div>
          <button className="leaderboard-link" onClick={openLeaderboard}>
            <span>🏆</span> 全球排行榜
          </button>
          <div className="how-to">
            <div>
              <b>01</b>
              <span>
                挑出三张
                <br />
                同类果卡
              </span>
            </div>
            <i>›</i>
            <div>
              <b>02</b>
              <span>
                水果落入
                <br />
                物理果箱
              </span>
            </div>
            <i>›</i>
            <div>
              <b>03</b>
              <span>
                同级碰撞
                <br />
                华丽升级
              </span>
            </div>
          </div>
        </section>
      ) : (
        <section className="play-layout">
          <aside className="desktop-brief">
            <button className="brand-button" onClick={backHome}>
              叠个<span>果王</span>
            </button>
            <p>在卡槽爆满之前完成三消，让同级水果在果箱中相撞升级。</p>
            <div className="brief-chain">
              {FRUITS.slice(
                Math.max(0, LEVELS[level].target - 3),
                LEVELS[level].target + 1,
              ).map((fruit, index) => (
                <span key={fruit.name}>
                  {fruit.emoji}
                  {index < 3 ? <i>›</i> : null}
                </span>
              ))}
            </div>
            <button className="leaderboard-link" onClick={openLeaderboard}>
              🏆 查看排行榜
            </button>
          </aside>
          <div className="game-phone">
            <GameCanvas
              level={level}
              mode={mode}
              wave={wave}
              relics={relics}
              startingScore={carryScore}
              session={session}
              onReady={handleReady}
              onSnapshot={handleSnapshot}
              onFinish={handleFinish}
              onToast={handleToast}
            />
            <header className="game-hud">
              <button
                className="icon-button"
                onClick={backHome}
                aria-label="返回主菜单"
              >
                ‹
              </button>
              <div className="level-chip">
                <small>
                  {mode === "story" ? `LEVEL ${level + 1}` : mode === "endless" ? `WAVE ${snapshot.wave}` : `ROUTE ${wave}`}
                </small>
                <strong>{mode === "story" ? LEVELS[level].name : MODE_INFO[mode].name}</strong>
              </div>
              <div className="score-chip">
                <small>SCORE</small>
                <b>{formatScore(snapshot.score)}</b>
              </div>
              <div className="target-chip">
                <small>{mode === "endless" ? "最大" : "目标"}</small>
                <b>
                  {mode === "endless"
                    ? FRUITS[Math.min(snapshot.maxFruitTier, FRUITS.length - 1)].emoji
                    : target.emoji}
                </b>
              </div>
            </header>
            {relics.length > 0 ? (
              <div className="relic-strip">
                {relics.map((id) => {
                  const relic = RELICS.find((item) => item.id === id);
                  return relic ? <span key={id} title={relic.name}>{relic.icon}</span> : null;
                })}
              </div>
            ) : null}
            <div className="power-dock">
              <button
                disabled={!snapshot.undoLeft}
                onClick={() => controlsRef.current?.undo()}
              >
                <i>↶</i>
                <span>撤回</span>
                <em>{snapshot.undoLeft}</em>
              </button>
              <button
                disabled={!snapshot.shuffleLeft}
                onClick={() => controlsRef.current?.shuffle()}
              >
                <i>⤨</i>
                <span>洗牌</span>
                <em>{snapshot.shuffleLeft}</em>
              </button>
              <button
                disabled={!snapshot.juiceLeft}
                onClick={() => controlsRef.current?.juice()}
              >
                <i>🥤</i>
                <span>榨汁</span>
                <em>{snapshot.juiceLeft}</em>
              </button>
              <button
                disabled={!snapshot.hammerLeft}
                onClick={() => controlsRef.current?.hammer()}
              >
                <i>🔨</i>
                <span>清顶</span>
                <em>{snapshot.hammerLeft}</em>
              </button>
              <button
                disabled={!snapshot.magnetLeft}
                onClick={() => controlsRef.current?.magnet()}
              >
                <i>🧲</i>
                <span>合并</span>
                <em>{snapshot.magnetLeft}</em>
              </button>
              <button onClick={() => beginGame(level, mode, { wave, relics, score: carryScore })}>
                <i>↻</i>
                <span>重开</span>
              </button>
            </div>
            <div
              className={`combo-pill ${snapshot.combo >= 3 ? "hot" : ""}`}
              aria-hidden={snapshot.combo < 2}
            >
              COMBO <b>×{snapshot.combo}</b>
            </div>
            {toast ? (
              <div key={toast.id} className={`game-toast toast-${toast.tone}`}>
                {toast.message}
              </div>
            ) : null}
            {result ? (
              <div className="result-layer" role="dialog" aria-modal="true">
                <div className={`result-card result-${result.status}`}>
                  <div className="result-rays" />
                  <div className="result-emoji">
                    {result.status === "won" ? target.emoji : mode === "endless" ? "∞" : "🍹"}
                  </div>
                  <div className="result-kicker">
                    {isRelicReward
                      ? "ROUTE CLEAR"
                      : mode === "expedition" && result.status === "won"
                        ? "EXPEDITION CLEAR"
                      : mode === "endless"
                        ? `ENDLESS WAVE ${result.wave}`
                        : result.status === "won"
                          ? "LEVEL CLEAR"
                          : "JUICE BREAK"}
                  </div>
                  <h2>
                    {isRelicReward
                      ? "选择一件奇物"
                      : mode === "expedition" && result.status === "won"
                        ? "远征完成！"
                      : mode === "endless"
                        ? "无尽狂欢结算"
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
                        {
                          FRUITS[
                            Math.min(result.maxFruitTier, FRUITS.length - 1)
                          ].emoji
                        }
                      </b>
                    </span>
                    <span>
                      <small>用时</small>
                      <b>
                        {Math.max(1, Math.round(result.durationMs / 1000))}s
                      </b>
                    </span>
                  </div>
                  {isRelicReward ? (
                    <div className="relic-choices">
                      {rewardOptions.map((relic) => (
                        <button
                          key={relic.id}
                          className={`relic-choice relic-${relic.tone}`}
                          onClick={() => chooseRelic(relic.id)}
                        >
                          <i>{relic.icon}</i>
                          <span><b>{relic.name}</b><small>{relic.description}</small></span>
                        </button>
                      ))}
                    </div>
                  ) : (
                  <div className="save-box">
                    {saveState === "saved" ? (
                      <div className="saved-message">
                        ✓ 战绩已进入全球排行榜
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
                        {!runId ? (
                          <small className="save-note">
                            排行榜连接中断，本局仍可继续挑战。
                          </small>
                        ) : null}
                        {saveError ? (
                          <small className="save-error">{saveError}</small>
                        ) : null}
                      </>
                    )}
                  </div>
                  )}
                  {isRelicReward ? (
                    <button className="button button-ghost result-home" onClick={backHome}>
                      暂停远征并返回
                    </button>
                  ) : (
                  <div className="result-actions">
                    <button className="button button-ghost" onClick={backHome}>
                      返回果园
                    </button>
                    <button
                      className="button button-primary"
                      onClick={continueGame}
                    >
                      {mode === "story" && result.status === "won" && level < LEVELS.length - 1
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
      {leaderboardOpen ? (
        <Leaderboard
          entries={leaderboard}
          loading={leaderboardLoading}
          offline={leaderboardOffline}
          mode={leaderboardMode}
          onModeChange={changeLeaderboardMode}
          onClose={() => setLeaderboardOpen(false)}
          onRefresh={loadLeaderboard}
        />
      ) : null}
    </main>
  );
}
