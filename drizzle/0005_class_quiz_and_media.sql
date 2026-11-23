ALTER TABLE custom_quizzes ADD COLUMN grade INTEGER CHECK (grade BETWEEN 1 AND 6);
--> statement-breakpoint
ALTER TABLE custom_quizzes ADD COLUMN story TEXT NOT NULL DEFAULT '{}';
--> statement-breakpoint
CREATE INDEX custom_quizzes_by_grade ON custom_quizzes (grade, published, updated_at DESC, id);
--> statement-breakpoint
CREATE TABLE uploaded_media (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('image','video','audio')),
  mime TEXT NOT NULL,
  name TEXT NOT NULL,
  size INTEGER NOT NULL
);
--> statement-breakpoint
ALTER TABLE game_audio_settings ADD COLUMN custom_right TEXT REFERENCES uploaded_media(id);
--> statement-breakpoint
ALTER TABLE game_audio_settings ADD COLUMN custom_retry TEXT REFERENCES uploaded_media(id);
--> statement-breakpoint
ALTER TABLE game_audio_settings ADD COLUMN use_custom INTEGER NOT NULL DEFAULT 0 CHECK (use_custom IN (0,1));
