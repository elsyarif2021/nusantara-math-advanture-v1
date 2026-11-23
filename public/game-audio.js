import { audioDefaults } from './audio-defaults.js';
import { createAudioMixer } from './audio-mixer.js';
import { commentatorClip } from './commentator-voices.js';

const intro = document.getElementById('entry-sound');
const music = document.getElementById('adventure-music');
const voice = document.getElementById('answer-voice');
const toggles = document.querySelectorAll('[data-sound-toggle]');
const mixer = createAudioMixer();
const encouragement = [
  ['right','Kamu benar!'],
  ['great','Kamu hebat!'],
  ['smart','Kamu pintar!']
];
let settings;
let enabled = true;
let inGame = false;
let storyAudioActive = false;
let correctCount = 0;
let voicePlay = 0;
let activeSource = '';
let refreshSequence = 0;

function updateButtons() {
  for (const toggle of toggles) {
    toggle.textContent = enabled ? 'Suara aktif' : 'Suara mati';
    toggle.setAttribute('aria-pressed',String(enabled));
  }
}

function musicVolume(ducked=false) {
  const base = (settings ?? audioDefaults).musicVolume/100;
  mixer.volume(music,ducked || storyAudioActive ? base*.28 : base);
}

function startMusic() {
  if (!enabled || !inGame || document.hidden || !settings?.musicEnabled || !settings.musicVolume) return;
  musicVolume(!voice.paused);
  music.play().catch(() => {});
}

function stopVoice() {
  voicePlay++;
  voice.pause();
  musicVolume();
}

function applySettings(next) {
  settings = next;
  mixer.volume(voice,settings.voiceVolume/100);
  if (!settings.voiceEnabled || !settings.voiceVolume) stopVoice();
  if (!settings.musicEnabled || !settings.musicVolume) music.pause();
  else startMusic();
}

async function refreshSettings() {
  const sequence = ++refreshSequence;
  try {
    const response = await fetch('/api/audio-settings',{cache:'no-store',signal:AbortSignal.timeout(5000)});
    if (!response.ok) throw new Error();
    const next = await response.json();
    if (sequence === refreshSequence) applySettings(next);
  } catch {
    if (sequence === refreshSequence && !settings) applySettings(audioDefaults);
  }
}

function toggleSound() {
  enabled = !enabled;
  updateButtons();
  if (enabled) {
    mixer.prepare(music,voice);
    startMusic();
    return;
  }
  intro.pause();
  music.pause();
  stopVoice();
}

for (const toggle of toggles) toggle.addEventListener('click',toggleSound);
voice.addEventListener('ended',() => musicVolume());
voice.addEventListener('error',() => musicVolume());
document.addEventListener('visibilitychange',() => {
  if (document.hidden) {
    music.pause();
    stopVoice();
  } else {
    startMusic();
    refreshSettings();
  }
});
refreshSettings();

export function setStoryAudioActive(active) {
  storyAudioActive = active;
  musicVolume(!voice.paused);
}

export function beginGameSound() {
  inGame = true;
  if (enabled) mixer.prepare(music,voice);
  startMusic();
  refreshSettings();
}

export function playEntrySound() {
  if (!enabled) return;
  intro.currentTime = 0;
  intro.play().catch(() => {});
}

export function stopGameSound() {
  inGame = false;
  music.pause();
  music.currentTime = 0;
  intro.pause();
  stopVoice();
}

export function playAnswerSound(correct) {
  const [clip,message] = correct
    ? encouragement[correctCount++ % encouragement.length]
    : ['retry','Belajar lagi, ya!'];
  if (!enabled || !settings?.voiceEnabled || !settings.voiceVolume) return message;
  const play = ++voicePlay;
  voice.pause();
  const custom = settings.customClips?.[correct ? 'right' : 'retry'];
  const {source,rate} = commentatorClip(clip,settings.voiceProfile,settings.voiceTone);
  const actualSource = custom || source;
  if (actualSource !== activeSource) {
    activeSource = actualSource;
    voice.src = actualSource;
  } else {
    voice.currentTime = 0;
  }
  voice.preservesPitch = true;
  voice.playbackRate = rate;
  mixer.prepare(music,voice);
  mixer.volume(voice,settings.voiceVolume/100);
  musicVolume(true);
  voice.play().catch(() => {
    if (play === voicePlay) musicVolume();
  });
  return message;
}
