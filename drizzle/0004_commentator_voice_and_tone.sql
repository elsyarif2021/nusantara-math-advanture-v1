ALTER TABLE game_audio_settings ADD COLUMN voice_profile TEXT NOT NULL DEFAULT 'original' CHECK (voice_profile IN ('original', 'warm', 'bright'));
--> statement-breakpoint
ALTER TABLE game_audio_settings ADD COLUMN voice_tone TEXT NOT NULL DEFAULT 'natural' CHECK (voice_tone IN ('calm', 'natural', 'energetic'));
