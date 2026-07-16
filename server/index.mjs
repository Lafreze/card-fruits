import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import compression from "compression";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { hashIp, initializeDatabase, isDatabaseHealthy, pool } from "./db.mjs";
import { cleanUsername, finishRunSchema, startRunSchema } from "./validation.mjs";

const app = express();
const port = Number(process.env.PORT || 3000);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.resolve(__dirname, "..", "dist");

if (process.env.TRUST_PROXY) app.set("trust proxy", Number(process.env.TRUST_PROXY));

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", "data:"],
      workerSrc: ["'self'", "blob:"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));
app.use(compression());
app.use(cors({ origin: process.env.NODE_ENV === "production" ? false : true }));
app.use(express.json({ limit: "16kb" }));

const apiLimiter = rateLimit({
  windowMs: 60_000,
  limit: 60,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});
const submitLimiter = rateLimit({
  windowMs: 10 * 60_000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});

app.use("/api", apiLimiter);

app.get("/api/health", async (_req, res) => {
  const database = await isDatabaseHealthy();
  res.status(database || !process.env.DATABASE_URL ? 200 : 503).json({
    status: database || !process.env.DATABASE_URL ? "ok" : "degraded",
    database: database ? "connected" : "not_connected",
  });
});

app.post("/api/runs", async (req, res) => {
  const parsed = startRunSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "无效的游戏参数" });
  if (!pool) return res.status(503).json({ error: "排行榜暂时离线" });

  const id = crypto.randomUUID();
  const { mode, level } = parsed.data;
  await pool.query(
    "INSERT INTO game_runs (id, mode, level, client_ip_hash) VALUES ($1, $2, $3, $4)",
    [id, mode, level, hashIp(req.ip)],
  );
  return res.status(201).json({ runId: id, startedAt: new Date().toISOString() });
});

app.post("/api/scores", submitLimiter, async (req, res) => {
  const parsed = finishRunSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || "提交内容无效" });
  }
  if (!pool) return res.status(503).json({ error: "排行榜暂时离线" });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const runResult = await client.query(
      "SELECT id, mode, level, started_at, completed_at FROM game_runs WHERE id = $1 FOR UPDATE",
      [parsed.data.runId],
    );
    const run = runResult.rows[0];
    if (!run) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "本局记录不存在，请重新开始一局" });
    }
    if (run.completed_at) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "本局分数已经保存" });
    }

    const durationMs = Math.max(0, Date.now() - new Date(run.started_at).getTime());
    if (durationMs < 2_000) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "本局时间过短，无法保存" });
    }

    const username = cleanUsername(parsed.data.username);
    const inserted = await client.query(
      `INSERT INTO scores
        (run_id, username, score, level, mode, max_combo, fruit_tier, duration_ms)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, username, score, level, mode, max_combo AS "maxCombo",
                 fruit_tier AS "fruitTier", created_at AS "createdAt"`,
      [
        run.id,
        username,
        parsed.data.score,
        run.level,
        run.mode,
        parsed.data.maxCombo,
        parsed.data.fruitTier,
        durationMs,
      ],
    );
    await client.query("UPDATE game_runs SET completed_at = NOW() WHERE id = $1", [run.id]);
    await client.query("COMMIT");
    return res.status(201).json({ score: inserted.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("score submission failed", error);
    return res.status(500).json({ error: "分数保存失败，请稍后重试" });
  } finally {
    client.release();
  }
});

app.get("/api/leaderboard", async (req, res) => {
  if (!pool) return res.json({ scores: [], offline: true });
  const mode = req.query.mode === "endless" ? "endless" : "story";
  const result = await pool.query(
    `SELECT username, score, level, max_combo AS "maxCombo",
            fruit_tier AS "fruitTier", created_at AS "createdAt"
     FROM scores
     WHERE mode = $1
     ORDER BY score DESC, created_at ASC
     LIMIT 20`,
    [mode],
  );
  return res.json({ scores: result.rows });
});

app.use(express.static(distPath, { maxAge: process.env.NODE_ENV === "production" ? "1y" : 0, index: false }));
app.get("*splat", (_req, res) => res.sendFile(path.join(distPath, "index.html")));

let databaseReady = false;
try {
  databaseReady = await initializeDatabase();
} catch (error) {
  console.error("database initialization failed", error);
}

app.listen(port, "0.0.0.0", () => {
  console.log(`Fruit Kingdom listening on ${port}; database ${databaseReady ? "ready" : "offline"}`);
});
