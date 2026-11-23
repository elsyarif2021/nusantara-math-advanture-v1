import {mediaField} from './admin-media.js';
import { createAudioMixer } from './audio-mixer.js';
import { audioDefaults } from './audio-defaults.js';
import { commentatorClip, voiceProfiles, voiceTones } from './commentator-voices.js';

const byId = id => document.getElementById(id);
const form = byId('audio-settings-form');
const fields = byId('audio-settings-fields');
const status = byId('audio-status');
const reload = byId('audio-reload');
const stop = byId('audio-stop');
const music = new Audio('/adventure-music.mp3');
const voice = new Audio();
const mixer = createAudioMixer();
const controls = {
  music:{enabled:byId('music-enabled'),volume:byId('music-volume'),output:byId('music-value'),audio:music},
  voice:{enabled:byId('voice-enabled'),volume:byId('voice-volume'),output:byId('voice-value'),audio:voice}
};
const profile = byId('voice-profile');
const tone = byId('voice-tone');
for (const [select,choices] of [[profile,[...voiceProfiles,{value:'upload',label:'Suara unggahan'}]],[tone,voiceTones]]) {
  select.append(...choices.map(item => new Option(item.label,item.value)));
}
const rightUpload = mediaField('voice-right-upload');
const retryUpload = mediaField('voice-retry-upload');
let releasePreview;
let revision;

async function request(settings) {
  const response = await fetch('/api/admin/audio-settings',settings ? {
    method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(settings)
  } : {cache:'no-store'});
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || 'Pengaturan audio belum tersedia. Coba lagi.');
    error.status = response.status;
    throw error;
  }
  return payload;
}

function updatePreview() {
  const voicePlaying = !voice.paused && !voice.ended;
  for (const [name,{enabled,volume,output,audio}] of Object.entries(controls)) {
    output.value = volume.value+'%';
    mixer.volume(audio,Number(volume.value)/100*(name === 'music' && voicePlaying ? .28 : 1));
    if (!enabled.checked || Number(volume.value) === 0) audio.pause();
  }
  stop.disabled = [music,voice].every(audio => audio.paused || audio.ended);
}

function apply(settings) {
  revision = settings.revision;
  controls.music.enabled.checked = settings.musicEnabled;
  controls.music.volume.value = settings.musicVolume;
  controls.voice.enabled.checked = settings.voiceEnabled;
  controls.voice.volume.value = settings.voiceVolume;
  profile.value = settings.voiceProfile ?? audioDefaults.voiceProfile;
  tone.value = settings.voiceTone ?? audioDefaults.voiceTone;
  rightUpload.set(settings.customRight);
  retryUpload.set(settings.customRetry);
  updatePreview();
}

async function load() {
  fields.disabled = true;
  reload.hidden = true;
  status.textContent = 'Memuat pengaturan audio…';
  try {
    apply(await request());
    status.textContent = 'Pengaturan audio siap diubah.';
    fields.disabled = false;
  } catch (error) {
    status.textContent = error.message;
    reload.hidden = false;
  }
}

function preview(control,clip) {
  if (!control.enabled.checked || Number(control.volume.value) === 0) {
    status.textContent = 'Aktifkan suara ini dan naikkan volumenya untuk mendengarkan contoh.';
    return;
  }
  const audio = control.audio;
  mixer.prepare(music,voice);
  if (clip) {
    const {source,rate} = commentatorClip(clip,profile.value,tone.value);
    let uploaded;
    try {
      uploaded = profile.value === 'upload' ? (clip === 'retry' ? retryUpload : rightUpload).preview() : null;
    } catch (error) {
      status.textContent = error.message;
      return;
    }
    voice.pause();
    releasePreview?.();
    releasePreview = uploaded?.release;
    audio.src = uploaded?.url ?? source;
    audio.preservesPitch = true;
    audio.playbackRate = rate;
  } else {
    audio.currentTime = 0;
  }
  audio.play().then(updatePreview).catch(() => {
    status.textContent = 'Pratinjau audio tidak dapat diputar.';
    updatePreview();
  });
}

byId('preview-music').addEventListener('click',() => preview(controls.music));
byId('preview-correct').addEventListener('click',() => preview(controls.voice,'right'));
byId('preview-retry').addEventListener('click',() => preview(controls.voice,'retry'));
stop.addEventListener('click',() => {
  music.pause();
  voice.pause();
  updatePreview();
});
for (const audio of [music,voice]) {
  audio.addEventListener('ended',updatePreview);
  audio.addEventListener('pause',updatePreview);
}
form.addEventListener('input',event => {
  if (['voice-right-upload','voice-retry-upload'].includes(event.target.id) && event.target.files.length) profile.value = 'upload';
  if (event.target === profile || event.target === tone || event.target.type === 'file') voice.pause();
  updatePreview();
});
reload.addEventListener('click',load);
form.addEventListener('submit',async event => {
  event.preventDefault();
  if (fields.disabled) return;
  const settings = {
    revision,
    musicEnabled:controls.music.enabled.checked,
    musicVolume:Number(controls.music.volume.value),
    voiceEnabled:controls.voice.enabled.checked,
    voiceVolume:Number(controls.voice.volume.value),
    voiceProfile:profile.value,
    voiceTone:tone.value
  };
  fields.disabled = true;
  status.textContent = 'Menyimpan pengaturan…';
  try {
    rightUpload.validate();
    retryUpload.validate();
    settings.customRight = await rightUpload.value();
    settings.customRetry = await retryUpload.value();
    apply(await request(settings));
    status.textContent = 'Pengaturan audio berhasil disimpan.';
  } catch (error) {
    status.textContent = error.message;
    if (error.status === 409) reload.hidden = false;
  } finally {
    fields.disabled = false;
  }
});
load();
