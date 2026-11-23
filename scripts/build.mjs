import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { extname } from 'node:path';
import { gradeFromClass, levels } from '../public/levels.js';
import { audioDefaults } from '../public/audio-defaults.js';
import { voiceProfiles, voiceTones } from '../public/commentator-voices.js';

const mime = {
  '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8',
  '.js':'text/javascript; charset=utf-8', '.webp':'image/webp',
  '.png':'image/png', '.woff2':'font/woff2', '.wav':'audio/wav', '.mp3':'audio/mpeg', '.txt':'text/plain; charset=utf-8'
};
const assets = {};
for (const entry of await readdir('public',{withFileTypes:true})) {
  if (!entry.isFile()) continue;
  const type = mime[extname(entry.name)];
  if (!type) throw new Error('Unknown asset type: '+entry.name);
  assets['/'+entry.name] = [type,(await readFile('public/'+entry.name)).toString('base64')];
}
const answers = levels.map(({missions,boss}) => [...missions,boss].map(mission => mission.questions.map(question => question.answer)));
const worker = await readFile('worker/index.js','utf8');
const quizzes = await readFile('worker/quizzes.js','utf8');
const audioSettings = await readFile('worker/audio-settings.js','utf8');
const media = await readFile('worker/media.js','utf8');
await mkdir('dist/server',{recursive:true});
await writeFile('dist/server/index.js','const assets = '+JSON.stringify(assets)+';\nconst expectedAnswers = '+JSON.stringify(answers)+';\n'+gradeFromClass.toString()+'\n'+ 'const audioDefaults = '+JSON.stringify(audioDefaults)+';\nconst allowedVoiceProfiles = '+JSON.stringify(voiceProfiles.map(item => item.value))+';\nconst allowedVoiceTones = '+JSON.stringify(voiceTones.map(item => item.value))+';\n'+worker+'\n'+quizzes+'\n'+audioSettings+'\n'+media);
