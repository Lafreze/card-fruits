CREATE TABLE IF NOT EXISTS game_runs (
  id UUID PRIMARY KEY,
  mode VARCHAR(16) NOT NULL CHECK (mode IN ('story', 'endless')),
  level INTEGER NOT NULL CHECK (level BETWEEN 0 AND 99),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  client_ip_hash VARCHAR(64)
);

CREATE TABLE IF NOT EXISTS scores (
  id BIGSERIAL PRIMARY KEY,
  run_id UUID NOT NULL UNIQUE REFERENCES game_runs(id) ON DELETE CASCADE,
  username VARCHAR(20) NOT NULL,
  score INTEGER NOT NULL CHECK (score >= 0),
  level INTEGER NOT NULL CHECK (level BETWEEN 0 AND 99),
  mode VARCHAR(16) NOT NULL CHECK (mode IN ('story', 'endless')),
  max_combo INTEGER NOT NULL DEFAULT 0 CHECK (max_combo BETWEEN 0 AND 999),
  fruit_tier INTEGER NOT NULL DEFAULT 0 CHECK (fruit_tier BETWEEN 0 AND 20),
  duration_ms INTEGER NOT NULL CHECK (duration_ms >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS scores_rank_idx
  ON scores (mode, score DESC, created_at ASC);

CREATE INDEX IF NOT EXISTS scores_recent_idx
  ON scores (created_at DESC);
