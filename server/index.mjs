import path from "node:path";
import { fileURLToPath } from "node:url";
import compression from "compression";
import express from "express";
import helmet from "helmet";
import { PlayerStore } from "./store.mjs";
export function createApp({
  directory = process.env.DATA_DIR ||
    process.env.RAILWAY_VOLUME_MOUNT_PATH ||
    path.resolve("server/data"),
  railwayEdge = Boolean(process.env.RAILWAY_ENVIRONMENT_ID),
  trustProxy = process.env.TRUST_PROXY || false,
} = {}) {
  const app = express();
  const store = new PlayerStore(directory);
  app.set(
    "trust proxy",
    typeof trustProxy === "string" && /^\d+$/.test(trustProxy)
      ? Number(trustProxy)
      : trustProxy,
  );
  app.use(express.json({ limit: "16kb" }));
  const dist = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
    "dist",
  );
  app.use(
    helmet({
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
    }),
  );
  app.use(compression());
  app.use("/api", (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });
  app.get("/api/health", (_req, res) =>
    res.json({ status: "ok", storage: "server-file" }),
  );
  const endpoint = (handler) => (req, res) => {
    try {
      res.json(
        handler(
          req,
          store.player(railwayEdge ? req.get("x-real-ip") || "" : req.ip),
        ),
      );
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  };
  app.get(
    "/api/player",
    endpoint((_req, p) => store.profile(p)),
  );
  app.patch(
    "/api/player",
    endpoint((req, p) => store.rename(p, req.body.username)),
  );
  app.post(
    "/api/runs",
    endpoint((req, p) => store.start(p, req.body)),
  );
  app.post(
    "/api/scores",
    endpoint((req, p) => store.finish(p, req.body)),
  );
  app.get("/api/leaderboard", (req, res) =>
    res.json({
      scores: store.leaderboard(
        req.query.mode || "story",
        req.query.difficulty,
      ),
      offline: false,
    }),
  );
  app.use("/api", (_req, res) => res.status(404).json({ error: "接口不存在" }));
  app.use(
    express.static(dist, {
      index: false,
      maxAge: "1h",
      setHeaders(res, file) {
        if (file.includes(`${path.sep}assets${path.sep}`))
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      },
    }),
  );
  app.get("/{*splat}", (_req, res) => {
    res.setHeader("Cache-Control", "no-cache");
    res.sendFile(path.join(dist, "index.html"));
  });
  return app;
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const app = createApp();
  app.listen(Number(process.env.PORT || 3000), "0.0.0.0", () =>
    console.log("Fruit Stack server ready"),
  );
}
