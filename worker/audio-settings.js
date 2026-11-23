function audioResponse(row) {
  if (!row) return {...audioDefaults,revision:0,customRight:'',customRetry:''};
  return {
    musicEnabled:Boolean(row.music_enabled),
    musicVolume:row.music_volume,
    voiceEnabled:Boolean(row.voice_enabled),
    voiceVolume:row.voice_volume,
    voiceProfile:row.use_custom ? 'upload' : row.voice_profile,
    voiceTone:row.voice_tone,
    customRight:row.custom_right ?? '',
    customRetry:row.custom_retry ?? '',
    revision:row.revision
  };
}

async function readAudioSettings(env,forPlayer=false) {
  const row = await env.DB.prepare('SELECT * FROM game_audio_settings WHERE id = 1').first();
  const settings = audioResponse(row);
  if (!forPlayer) return json(settings);
  const {customRight,customRetry,...publicSettings} = settings;
  if (settings.voiceEnabled && settings.voiceProfile === 'upload') {
    const [right,retry] = await Promise.all([playerMediaUrl(env,customRight),playerMediaUrl(env,customRetry)]);
    publicSettings.customClips = {right,retry};
  }
  return json(publicSettings);
}

async function adminAudioSettings(request,env) {
  if (request.method === 'GET') return readAudioSettings(env);
  if (request.method !== 'PUT') return problem('Metode tidak didukung.',405);
  if (request.headers.get('origin') !== new URL(request.url).origin) return problem('Asal permintaan tidak diizinkan.',403);
  const db = env.DB;
  const settings = await readJson(request);
  const validVolume = value => Number.isInteger(value) && value >= 0 && value <= 100;
  if (!settings || !validVolume(settings.musicVolume) || !validVolume(settings.voiceVolume) ||
      typeof settings.musicEnabled !== 'boolean' || typeof settings.voiceEnabled !== 'boolean' ||
      !Number.isSafeInteger(settings.revision) || settings.revision < 0) {
    return problem('Volume harus antara 0 dan 100.',422);
  }
  const {voiceProfile,voiceTone} = settings;
  if ((voiceProfile !== undefined && voiceProfile !== 'upload' && !allowedVoiceProfiles.includes(voiceProfile)) ||
      (voiceTone !== undefined && !allowedVoiceTones.includes(voiceTone))) {
    return problem('Pilih suara dan tone yang tersedia.',422);
  }
  const prior = await db.prepare('SELECT * FROM game_audio_settings WHERE id = 1').first();
  if ((prior?.revision ?? 0) !== settings.revision) return audioConflict();
  const right = settings.customRight === undefined ? prior?.custom_right : settings.customRight;
  const retry = settings.customRetry === undefined ? prior?.custom_retry : settings.customRetry;
  for (const id of [right,retry]) {
    if (id && !await mediaRecord(db,id,'audio')) return problem('Pilih berkas audio yang sudah diunggah.',422);
  }
  const useCustom = voiceProfile === undefined ? Boolean(prior?.use_custom) : voiceProfile === 'upload';
  if (useCustom && !right && !retry) return problem('Unggah minimal satu rekaman untuk memakai suara unggahan.',422);
  const builtIn = voiceProfile && voiceProfile !== 'upload' ? voiceProfile : prior?.voice_profile ?? audioDefaults.voiceProfile;
  const values = [
    Number(settings.musicEnabled),settings.musicVolume,Number(settings.voiceEnabled),settings.voiceVolume,
    builtIn,voiceTone ?? prior?.voice_tone ?? audioDefaults.voiceTone,right || null,retry || null,Number(useCustom)
  ];
  const statement = settings.revision === 0
    ? db.prepare(`INSERT INTO game_audio_settings
        (id,music_enabled,music_volume,voice_enabled,voice_volume,voice_profile,voice_tone,custom_right,custom_retry,use_custom,revision)
        VALUES (1,?,?,?,?,?,?,?,?,?,1) ON CONFLICT(id) DO NOTHING RETURNING *`).bind(...values)
    : db.prepare(`UPDATE game_audio_settings SET music_enabled=?,music_volume=?,voice_enabled=?,voice_volume=?,
        voice_profile=?,voice_tone=?,custom_right=?,custom_retry=?,use_custom=?,revision=revision+1
        WHERE id=1 AND revision=? RETURNING *`).bind(...values,settings.revision);
  const saved = await statement.first();
  return saved ? json(audioResponse(saved)) : audioConflict();
}

function audioConflict() {
  return problem('Pengaturan berubah di sesi admin lain. Muat ulang sebelum menyimpan.',409);
}
