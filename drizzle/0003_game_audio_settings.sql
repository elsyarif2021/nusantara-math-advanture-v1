CREATE TABLE game_audio_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  music_enabled INTEGER NOT NULL CHECK (music_enabled IN (0, 1)),
  music_volume INTEGER NOT NULL CHECK (music_volume BETWEEN 0 AND 100),
  voice_enabled INTEGER NOT NULL CHECK (voice_enabled IN (0, 1)),
  voice_volume INTEGER NOT NULL CHECK (voice_volume BETWEEN 0 AND 100),
  revision INTEGER NOT NULL CHECK (revision > 0)
);
