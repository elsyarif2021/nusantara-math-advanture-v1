CREATE TABLE players (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  school_class TEXT NOT NULL,
  profile_key TEXT NOT NULL UNIQUE,
  pin_salt TEXT NOT NULL,
  pin_hash TEXT NOT NULL,
  cleared INTEGER NOT NULL DEFAULT 0 CHECK (cleared BETWEEN 0 AND 7),
  boss INTEGER NOT NULL DEFAULT 0 CHECK (boss IN (0, 1)),
  certificate_name TEXT NOT NULL DEFAULT '',
  completed_date TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX players_last_activity ON players (updated_at DESC, id DESC);
--> statement-breakpoint
CREATE TABLE player_sessions (
  token_hash TEXT PRIMARY KEY NOT NULL,
  player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX player_sessions_expires ON player_sessions (expires_at);
--> statement-breakpoint
CREATE TABLE sign_in_limits (
  bucket TEXT PRIMARY KEY NOT NULL,
  hits INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX sign_in_limits_expires ON sign_in_limits (expires_at);
--> statement-breakpoint
CREATE TABLE game_activity (
  id TEXT PRIMARY KEY NOT NULL,
  player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('login', 'mission', 'boss')),
  mission_index INTEGER,
  occurred_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX game_activity_latest ON game_activity (occurred_at DESC, id DESC);
