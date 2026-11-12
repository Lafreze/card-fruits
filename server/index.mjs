import path from "node:path";
import { fileURLToPath } from "node:url";
import compression from "compression";
import express from "express";
import helmet from "helmet";
const app = express();
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
app.get("/api/health", (_req, res) =>
  res.json({ status: "ok", storage: "browser-local" }),
);
app.use("/api", (_req, res) =>
  res.status(404).json({ error: "Scores are saved on your device." }),
);
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
app.listen(Number(process.env.PORT || 3000), "0.0.0.0", () =>
  console.log("Orchard Club is ready; no database required."),
);
