CREATE TABLE custom_quizzes (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  questions TEXT NOT NULL,
  published INTEGER NOT NULL CHECK (published IN (0, 1)),
  version INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX custom_quizzes_catalog ON custom_quizzes (published, updated_at DESC, id);
