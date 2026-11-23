import { gradeFromClass, levels } from './levels.js';
import { beginGameSound, playEntrySound, stopGameSound, playAnswerSound, setStoryAudioActive } from './game-audio.js';

const byId = id => document.getElementById(id);
const dialog = byId('game-dialog');
const content = byId('game-content');
const emptyProgress = { cleared:0, boss:false, name:'', date:'' };
const clean = value => typeof value === 'string' ? value.trim().replace(/\s+/g,' ') : '';

let player = null;
let level = levels[0];
let {missions,boss} = level;
let playerToken = '';
let state = {...emptyProgress};
let run;
let trigger;
let deferredNavigation;

function clearLegacyData() {
  try {
    for (let index = localStorage.length - 1; index >= 0; index--) {
      const key = localStorage.key(index);
      if (key?.startsWith('nusantara-player-progress-v1:') ||
          ['nusantara-adventure-v1','nusantara-active-player-v1','nusantara-entry-sound-v1'].includes(key)) {
        localStorage.removeItem(key);
      }
    }
  } catch {}
}

async function playerRequest(path,body,token=playerToken) {
  const headers = {'Content-Type':'application/json'};
  if (token) headers.Authorization = 'Bearer '+token;
  let response;
  try {
    response = await fetch('/api/player/'+path,{
      method:'POST',headers,body:JSON.stringify(body),cache:'no-store'
    });
  } catch {
    throw new Error('Koneksi terputus. Periksa internet dan coba lagi.');
  }
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(result.error || 'Server belum dapat menyimpan data. Coba lagi.');
    error.status = response.status;
    throw error;
  }
  return result;
}

function updatePlayerDisplay() {
  const greeting = byId('greeting');
  greeting.textContent = player ? 'Assalamu’alaikum, '+player.name+'! · Kelas '+player.schoolClass : '';
  greeting.hidden = !player;
  byId('level-banner').hidden = !player;
  if (player) byId('level-banner').textContent = 'Level '+level.grade+' · Kelas '+level.grade+' SD/MI · Fase '+level.phase;
}

function signIn(result) {
  const oldToken = playerToken;
  player = result.player;
  level = levels[player.grade-1];
  ({missions,boss} = level);
  playerToken = result.token;
  state = result.progress;
  if (oldToken) playerRequest('logout',{},oldToken).catch(() => {});
  byId('print-certificate').replaceChildren();
  updatePlayerDisplay();
  drawDashboard();
}

function resetPlayer() {
  player = null;
  playerToken = '';
  state = {...emptyProgress};
  run = null;
  byId('print-certificate').replaceChildren();
  updatePlayerDisplay();
}

function signOut() {
  const token = playerToken;
  resetPlayer();
  stopGameSound();
  if (token) playerRequest('logout',{},token).catch(() => {});
  deferredNavigation = () => {
    byId('adventure').hidden = true;
    byId('opening').hidden = false;
    window.scrollTo(0,0);
    byId('enter-adventure').focus({preventScroll:true});
  };
  dialog.close();
}

function statusLine() {
  const status = add('p','server-status');
  status.setAttribute('role','status');
  return status;
}

function reportPlayerError(error,status) {
  status.textContent = error.message;
  if (error.status !== 401) return;
  resetPlayer();
  drawDashboard();
  const reenter = button('Masuk kembali','button teal',() => openSignIn());
  status.after(reenter);
}

function add(tag, classes, text) {
  const node = document.createElement(tag);
  if (classes) node.className = classes;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(label, classes, onClick) {
  const node = add('button', classes, label);
  node.type = 'button';
  node.addEventListener('click', onClick);
  return node;
}

function stylePosition(node, x, y) {
  node.style.left = x+'%';
  node.style.top = y+'%';
}

function drawRoute() {
  const canvas = byId('route-lines');
  const bounds = canvas.getBoundingClientRect();
  if (!bounds.width) return;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(bounds.width*dpr);
  canvas.height = Math.round(bounds.height*dpr);
  const context = canvas.getContext('2d');
  context.scale(dpr,dpr);
  const width = bounds.width / 100;
  const height = bounds.height / 100;
  context.lineWidth = 2.5;
  context.setLineDash([4, 7]);
  context.lineCap = 'round';
  missions.slice(1).forEach((mission, i) => {
    const [x1,y1] = missions[i].pin;
    const [x2,y2] = mission.pin;
    context.beginPath();
    context.strokeStyle = i < state.cleared ? '#146f60' : '#497e76';
    context.moveTo(x1*width, y1*height);
    context.quadraticCurveTo((x1+x2)*width/2, (Math.min(y1,y2)-8)*height, x2*width, y2*height);
    context.stroke();
  });
}

function drawDashboard() {
  const list = byId('stop-list');
  const pins = byId('map-pins');
  list.replaceChildren();
  pins.replaceChildren();
  missions.forEach((mission, index) => {
    const status = index < state.cleared ? 'done' : index === state.cleared ? 'active' : 'locked';
    const statusText = {done:'Selesai',active:'Pos aktif',locked:'Terkunci'}[status];
    const pin = button(status === 'done' ? '✓' : index+1, 'pin '+status, () => openMission(index));
    pin.setAttribute('aria-label', mission.region+' · '+statusText);
    const label = add('span','pin-name',mission.label);
    label.setAttribute('aria-hidden','true');
    stylePosition(pin, ...mission.pin.slice(0,2));
    stylePosition(label, ...mission.pin.slice(2));
    pins.append(pin,label);
    const card = button('', 'stop '+status, () => openMission(index));
    card.setAttribute('aria-label', mission.region+' · '+mission.topic+' · '+statusText);
    const icon = add('span','stop-icon',mission.icon);
    icon.setAttribute('aria-hidden','true');
    const copy = add('span');
    copy.append(add('b','',mission.region),add('small','',mission.topic));
    const marker = add('span','stop-state',status === 'done' ? '✓' : status === 'active' ? '→' : '🔒');
    marker.setAttribute('aria-hidden','true');
    card.append(icon,copy,marker);
    list.append(card);
  });
  const finalStatus = state.boss ? 'done' : state.cleared === missions.length ? 'active' : 'locked';
  const finalCard = button('', 'stop '+finalStatus, openBoss);
  finalCard.setAttribute('aria-label','Final Boss · '+({done:'Selesai',active:'Terbuka',locked:'Terkunci'}[finalStatus]));
  const bossIcon = add('span','stop-icon','🏆');
  bossIcon.setAttribute('aria-hidden','true');
  const bossText = add('span');
  bossText.append(add('b','','Final Boss'),add('small','','Tantangan semua topik'));
  const bossStatus = add('span','stop-state',finalStatus === 'done' ? '✓' : finalStatus === 'active' ? '→' : '🔒');
  bossStatus.setAttribute('aria-hidden','true');
  finalCard.append(bossIcon,bossText,bossStatus);
  list.append(finalCard);

  const active = missions[Math.min(state.cleared, missions.length-1)];
  const shipOffset = [[6,7],[2,10],[-6,7],[4,12],[-4,4],[4,10],[3,9]][Math.min(state.cleared, missions.length-1)];
  stylePosition(byId('ship'),active.pin[0]+shipOffset[0],active.pin[1]+shipOffset[1]);
  byId('map-count').textContent = state.cleared+' dari 7 pos selesai';
  byId('progress-count').textContent = state.cleared+'/7';
  byId('progress-bar').value = state.cleared;
  byId('current-icon').textContent = state.boss ? '🏅' : state.cleared === missions.length ? '🏆' : active.icon;
  byId('current-status').textContent = state.boss ? 'MISI TUNTAS' : state.cleared === 0 ? 'POS PERTAMA' : 'MISI BERIKUTNYA';
  byId('current-name').textContent = state.boss ? 'Sertifikat' : state.cleared === missions.length ? boss.region : active.region;
  byId('current-detail').textContent = state.boss ? 'Penjelajah Angka Nusantara' : state.cleared === missions.length ? boss.game : active.topic;
  byId('current-button').textContent = state.boss ? 'Buka sertifikat →' : state.cleared === 0 ? 'Buka pos pertama →' : state.cleared === missions.length ? 'Mulai Final Boss →' : 'Lanjut ke pos berikutnya →';
  drawRoute();
}

function stopQuizStory() {
  content.querySelectorAll('.quiz-story-media audio,.quiz-story-media video').forEach(media => media.pause());
  content.querySelector('.quiz-story-media iframe')?.remove();
  setStoryAudioActive(false);
}

function show(title, kicker, gameplay = false) {
  stopQuizStory();
  dialog.toggleAttribute('data-gameplay',gameplay);
  byId('close-dialog').setAttribute('aria-label',gameplay ? 'Kembali ke peta' : 'Tutup');
  content.replaceChildren();
  content.append(add('p','eyebrow dialog-kicker',kicker));
  const heading = add('h2','dialog-title',title);
  heading.id = 'dialog-title';
  heading.tabIndex = -1;
  content.append(heading);
  if (!dialog.open) {
    trigger = document.activeElement;
    dialog.showModal();
  }
  dialog.scrollTop = 0;
  heading.focus({preventScroll:true});
}

function playerField(label, id, maxLength, autocomplete) {
  const wrapper = add('div','player-field');
  const caption = add('label','',label);
  caption.htmlFor = id;
  const input = add('input');
  input.id = id;
  input.name = id;
  input.maxLength = maxLength;
  input.autocomplete = autocomplete;
  input.required = true;
  input.addEventListener('input',() => input.setCustomValidity(''));
  wrapper.append(caption,input);
  return {wrapper,input};
}

function openSignIn(afterSignIn) {
  show(player ? 'Ganti penjelajah' : 'Masuk sebagai penjelajah','SELAMAT DATANG');
  content.append(add('p','story','Masukkan nama lengkap dan pilih kelasmu. Gunakan nama dan kelas yang sama untuk melanjutkan dari perangkat lain.'));
  const form = add('form','player-form');
  const name = playerField('Nama lengkap','player-name',90,'username');
  const gradeLabel = add('label','player-field','Kelas SD/MI');
  const grade = add('select');
  grade.required = true;
  grade.append(new Option('Pilih kelas',''));
  for (const item of levels) grade.append(new Option('Kelas '+item.grade+' · Level '+item.grade+' · Fase '+item.phase,item.grade));
  gradeLabel.append(grade);
  const schoolClass = playerField('Rombel atau label kelas lama (opsional)','player-class',32,'off');
  schoolClass.input.required = false;
  const legacyLabel = add('label','player-legacy');
  const legacy = add('input');
  legacy.type = 'checkbox';
  legacyLabel.append(legacy,' Gunakan label kelas profil lama persis seperti sebelumnya');
  grade.addEventListener('change',() => schoolClass.input.setCustomValidity(''));
  legacy.addEventListener('change',() => {
    schoolClass.input.required = legacy.checked;
    schoolClass.input.setCustomValidity('');
  });
  schoolClass.input.placeholder = 'Contoh: A atau 4A';
  const status = statusLine();
  const submit = add('button','button teal','Masuk →');
  submit.type = 'submit';
  form.append(name.wrapper,gradeLabel,schoolClass.wrapper,legacyLabel,status,submit);
  form.addEventListener('submit',async event => {
    event.preventDefault();
    if (submit.disabled) return;
    const selected = Number(grade.value);
    const label = clean(schoolClass.input.value);
    const labelGrade = legacy.checked || /^\d|^kelas\s/i.test(label) ? gradeFromClass(label) : 0;
    if (labelGrade && labelGrade !== selected) {
      schoolClass.input.setCustomValidity('Label rombel harus sesuai kelas yang dipilih.');
      schoolClass.input.reportValidity();
      return;
    }
    const schoolClassValue = legacy.checked || labelGrade ? label : grade.value+label;
    if (schoolClassValue.length > 32) {
      schoolClass.input.setCustomValidity('Label kelas maksimal 32 karakter.');
      schoolClass.input.reportValidity();
      return;
    }
    const nextPlayer = {name:clean(name.input.value),schoolClass:schoolClassValue,grade:selected};
    if (!nextPlayer.name || !nextPlayer.schoolClass) {
      const field = nextPlayer.name ? schoolClass.input : name.input;
      field.setCustomValidity('Isi kolom ini terlebih dahulu.');
      field.reportValidity();
      return;
    }
    submit.disabled = true;
    status.textContent = 'Sedang masuk…';
    try {
      const result = await playerRequest('login',nextPlayer,'');
      if (!dialog.open || !form.isConnected) {
        playerRequest('logout',{},result.token).catch(() => {});
        return;
      }
      signIn(result);
      if (afterSignIn) afterSignIn();
      else {
        deferredNavigation = showMap;
        dialog.close();
      }
    } catch (error) {
      status.textContent = error.message;
    } finally {
      submit.disabled = false;
    }
  });
  content.append(form);
}

function openProfile() {
  if (!player) {
    openSignIn();
    return;
  }
  show('Profil penjelajah','JURNAL PELAYARAN');
  content.append(add('p','story','Assalamu’alaikum, '+player.name+'!'),add('p','story','Kelas '+player.schoolClass));
  const actions = add('div','actions');
  actions.append(button('Ganti penjelajah','button teal',() => openSignIn()),button('Keluar','button soft',signOut));
  content.append(actions);
}

function factCard(mission) {
  const box = add('div','fact');
  const link = add('a','','Baca fakta budaya ↗');
  link.href = mission.source;
  link.target = '_blank';
  link.rel = 'noopener';
  box.append(add('strong','fact-title','💡 Tahukah kamu?'),add('p','',mission.fact),link);
  return box;
}

function enrichmentList(index,mission) {
  const section = add('section','enrichment-list');
  section.append(add('h3','lesson-title','Pengayaan'),add('p','story','Latihan tambahan di luar misi wajib.'));
  for (const module of mission.enrichment) {
    section.append(button(module.topic,'button soft',() => {
      show(module.topic,'PENGAYAAN · LEVEL '+level.grade,true);
      content.append(add('p','story',module.lesson));
      const actions = add('div','actions');
      actions.append(button('Kembali ke pos','button soft',() => openMission(index)),
        button('Mulai latihan →','button teal',() => begin(index,module,true)));
      content.append(actions);
    }));
  }
  return section;
}

function openMission(index) {
  if (!player) {
    openSignIn(() => openMission(index));
    return;
  }
  if (index > state.cleared) {
    show(missions[index].region, 'POS TERKUNCI');
    content.append(add('p','story','Tuntaskan misi di '+missions[index-1].region+' untuk membuka pos ini.'));
    if (missions[index].enrichment.length) content.append(enrichmentList(index,missions[index]));
    return;
  }
  const mission = missions[index];
  show(mission.game, mission.region.toUpperCase()+' · LEVEL '+level.grade,true);
  content.append(add('p','story',mission.story),add('h3','lesson-title',mission.topic),add('p','story',mission.lesson));
  for (const module of mission.core) content.append(add('h3','lesson-title',module.topic),add('p','story',module.lesson));
  content.append(factCard(mission));
  const actions = add('div','actions');
  actions.append(button(index < state.cleared ? 'Main lagi' : 'Mulai misi →','button teal',() => begin(index, mission)));
  content.append(actions);
  if (mission.enrichment.length) content.append(enrichmentList(index,mission));
}

function openBoss() {
  if (!player) {
    openSignIn(openBoss);
    return;
  }
  show(boss.region,'TANTANGAN TERAKHIR',state.cleared === missions.length);
  if (state.cleared < missions.length) {
    content.append(add('p','story','Selesaikan ketujuh pos, termasuk misi panahan di Papua, untuk membuka tantangan ini.'));
    return;
  }
  content.append(add('p','story',boss.story));
  const actions = add('div','actions');
  actions.append(button(state.boss ? 'Main lagi' : 'Mulai Final Boss →','button teal',() => begin(missions.length,boss)));
  content.append(actions);
}

async function quizRequest(path,token,body) {
  const response = await fetch('/api/quizzes'+path,{
    method:body ? 'POST' : 'GET',
    headers:{Authorization:'Bearer '+token,...(body ? {'Content-Type':'application/json'} : {})},
    body:body ? JSON.stringify(body) : undefined
  });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.error || 'Kuis belum bisa dibuka. Coba lagi.');
    error.status = response.status;
    throw error;
  }
  return data;
}

async function openQuizzes() {
  if (!player) {
    openSignIn(openQuizzes);
    return;
  }
  show('Kuis Kelas '+level.grade,'LEVEL '+level.grade+' · FASE '+level.phase,true);
  const status = statusLine();
  status.textContent = 'Memuat kuis…';
  content.append(status);
  const token = playerToken;
  try {
    const {quizzes} = await quizRequest('',token);
    if (!dialog.open || !status.isConnected || playerToken !== token) return;
    status.textContent = quizzes.length ? 'Pilih kuis yang ingin kamu kerjakan.' : 'Belum ada kuis tambahan yang terbit.';
    const list = add('div','quiz-player-list');
    for (const quiz of quizzes) {
      list.append(button(quiz.title+' · '+quiz.count+' soal','button soft',() => openCustomQuiz(quiz.id)));
    }
    content.append(list);
  } catch(error) {
    if (dialog.open && status.isConnected && playerToken === token) reportPlayerError(error,status);
  }
}

async function openCustomQuiz(id) {
  show('Membuka kuis','LATIHAN',true);
  const status = statusLine();
  status.textContent = 'Memuat soal…';
  content.append(status);
  const token = playerToken;
  try {
    const quiz = await quizRequest('/'+id,token);
    if (!dialog.open || !status.isConnected || playerToken !== token) return;
    showQuizStory(id,quiz);
  } catch(error) {
    if (dialog.open && status.isConnected && playerToken === token) {
      reportPlayerError(error,status);
      if (error.status !== 401) content.append(button('Daftar kuis','button soft',openQuizzes));
    }
  }
}

function showQuizStory(id,quiz) {
  const {story} = quiz;
  if (!story || !Object.values(story).some(Boolean)) {
    renderCustomQuestion(id,quiz,[],0);
    return;
  }
  show(quiz.title,'CERITA PEMBUKA · KELAS '+level.grade,true);
  const media = add('div','quiz-story-media');
  if (story.text) media.append(add('p','story quiz-story-text',story.text));
  if (story.image) {
    const image = add('img');
    image.src = story.image;
    image.alt = 'Ilustrasi cerita untuk kuis '+quiz.title;
    media.append(image);
  }
  const tracks = [];
  const updateStoryAudio = () => setStoryAudioActive(tracks.some(track => track.isConnected && !track.paused && !track.ended));
  for (const kind of ['video','audio']) {
    if (!story[kind]) continue;
    const player = add(kind);
    player.src = story[kind];
    player.controls = true;
    player.preload = 'metadata';
    if (kind === 'video') player.playsInline = true;
    player.setAttribute('aria-label',kind === 'video' ? 'Video cerita' : 'Suara cerita');
    tracks.push(player);
    for (const event of ['play','pause','ended','error']) player.addEventListener(event,updateStoryAudio);
    media.append(player);
  }
  if (story.youtube) {
    const video = add('iframe');
    video.src = 'https://www.youtube-nocookie.com/embed/'+story.youtube;
    video.title = 'Video YouTube untuk kuis '+quiz.title;
    video.referrerPolicy = 'strict-origin-when-cross-origin';
    video.allowFullscreen = true;
    const link = add('a','','Buka video di YouTube ↗');
    link.href = 'https://www.youtube.com/watch?v='+story.youtube;
    link.target = '_blank';
    link.rel = 'noopener';
    media.append(video,link);
  }
  const actions = add('div','actions');
  actions.append(button('Daftar kuis','button soft',openQuizzes),
    button('Mulai kuis →','button teal',() => renderCustomQuestion(id,quiz,[],0)));
  content.append(media,actions);
}

function renderCustomQuestion(id,quiz,answers,index) {
  show(quiz.title,'SOAL '+(index+1)+' DARI '+quiz.questions.length,true);
  const item = quiz.questions[index];
  const prompt = add('p','question',item.prompt);
  prompt.id = 'quiz-prompt';
  const options = add('div','options quiz-options');
  options.setAttribute('role','group');
  options.setAttribute('aria-labelledby',prompt.id);
  const actions = add('div','actions');
  const last = index === quiz.questions.length-1;
  const status = statusLine();
  const next = button(last ? 'Kirim jawaban' : 'Soal berikutnya →','button teal next',async () => {
    if (!last) {
      renderCustomQuestion(id,quiz,answers,index+1);
      return;
    }
    next.disabled = true;
    status.textContent = 'Memeriksa jawaban…';
    const token = playerToken;
    try {
      const score = await quizRequest('/'+id,token,{version:quiz.version,answers});
      if (!dialog.open || !next.isConnected || playerToken !== token) return;
      show('Hasil kuis','LATIHAN SELESAI',true);
      content.append(add('p','question',score.correct+' dari '+score.total+' jawaban benar'));
      const review = add('ol','quiz-review');
      quiz.questions.forEach((question,i) => {
        review.append(add('li','',question.prompt+' · '+(score.results[i] ? 'Benar' : 'Belum tepat')));
      });
      const controls = add('div','actions');
      controls.append(button('Daftar kuis','button soft',openQuizzes),button('Coba lagi','button teal',() => openCustomQuiz(id)));
      content.append(review,controls);
    } catch(error) {
      if (!dialog.open || !next.isConnected || playerToken !== token) return;
      reportPlayerError(error,status);
      if ([404,409].includes(error.status)) {
        actions.replaceChildren(button('Daftar kuis','button soft',openQuizzes));
      } else if (error.status !== 401) {
        next.disabled = false;
      }
    }
  });
  next.disabled = answers[index] === undefined;
  const choices = item.options.map((label,value) => {
    const option = button('ABCD'[value]+'. '+label,'option',() => {
      answers[index] = value;
      choices.forEach((choice,i) => choice.setAttribute('aria-pressed',String(i === value)));
      next.disabled = false;
    });
    option.setAttribute('aria-pressed',String(answers[index] === value));
    return option;
  });
  options.append(...choices);
  if (index > 0) actions.append(button('← Sebelumnya','button soft',() => renderCustomQuestion(id,quiz,answers,index-1)));
  else actions.append(button('Daftar kuis','button soft',openQuizzes));
  actions.append(next);
  content.append(prompt);
  if (item.image) {
    const image = add('img','quiz-question-image');
    image.src = item.image;
    image.alt = 'Ilustrasi untuk soal '+(index+1);
    content.append(image);
  }
  content.append(options,actions,status);
}

function shuffle(items) {
  const shuffled = [...items];
  for (let index = shuffled.length-1; index > 0; index--) {
    const other = Math.floor(Math.random()*(index+1));
    [shuffled[index],shuffled[other]] = [shuffled[other],shuffled[index]];
  }
  return shuffled;
}

function begin(index, mission, practice = false) {
  run = { index, mission, practice, step:0, answers:[], runId:crypto.randomUUID() };
  renderQuestion();
}

function makeScene(mission, step) {
  const icons = {
    gasing:['🪀','🪀','🪀'], dakon:['🌰','🌰','🌰','🌰','🌰'], enggrang:['🎋','🌉','🎋'],
    karet:['🪢','🦘','🪢'], topeng:['🌺','🎭','🌺'], benteng:['🚩','🏰','🚩'], panah:['🎯','🎯','🎯'], boss:['✦','🏆','✦']
  };
  const scene = add('div','scene '+mission.theme);
  scene.setAttribute('aria-hidden','true');
  if (mission.theme === 'gasing') {
    for (let i=0; i<3; i++) {
      const top = add('span','gasing-piece');
      top.style.setProperty('--i',i);
      scene.append(top);
    }
  } else {
    icons[mission.theme].forEach((icon,index) => {
      const element = add('span','',icon);
      element.style.setProperty('--i',index);
      scene.append(element);
    });
  }
  if (mission.theme === 'karet') scene.style.setProperty('--jump', ['-10px','-19px','-29px'][step]);
  return scene;
}

function renderQuestion() {
  const currentRun = run;
  const { mission, step } = currentRun;
  const {prompt,answer,distractors} = mission.questions[step];
  show(mission.game,mission.region.toUpperCase()+' · SOAL '+(step+1)+' DARI '+mission.questions.length,true);
  const scene = makeScene(mission,step);
  const question = add('p','question',prompt);
  question.id = 'question';
  const options = add('div','options quiz-options');
  options.setAttribute('role','group');
  options.setAttribute('aria-labelledby',question.id);
  const feedback = add('p','feedback');
  feedback.setAttribute('role','status');
  const actions = add('div','actions');
  const next = button(step === mission.questions.length-1 ? 'Selesaikan misi →' : 'Soal berikutnya →','button teal next',() => advance(currentRun,next,feedback));
  next.hidden = true;
  const concept = step >= 2 && mission.core?.length ? mission.core.map(module => module.lesson).join(' ') : mission.lesson;
  const hint = concept ? add('p','hint',concept) : null;
  if (hint) { hint.id = 'math-hint'; hint.hidden = true; }
  let answered = false;
  shuffle([answer,...distractors]).forEach(value => {
    const option = button(value,'option',() => {
      if (answered) return;
      if (value !== answer) {
        option.classList.add('wrong');
        option.disabled = true;
        feedback.textContent = playAnswerSound(false)+' Coba pilihan lain.';
        feedback.dataset.kind = 'wrong';
        options.querySelector('button:not(:disabled)')?.focus();
        return;
      }
      answered = true;
      currentRun.answers[step] = value;
      option.classList.add('correct');
      options.querySelectorAll('button').forEach(item => item.disabled = true);
      feedback.textContent = playAnswerSound(true)+' Jawabannya '+answer+'.';
      feedback.dataset.kind = 'correct';
      scene.classList.add('win');
      next.hidden = false;
      next.focus();
    });
    options.append(option);
  });
  if (hint) {
    const help = button('💡 Bantuan Kakak Pintar','button soft',() => {
      hint.hidden = !hint.hidden;
      help.setAttribute('aria-expanded',String(!hint.hidden));
    });
    help.setAttribute('aria-controls',hint.id);
    help.setAttribute('aria-expanded','false');
    actions.append(help);
  }
  actions.append(next);
  content.append(scene,question,options,feedback,actions);
  if (hint) content.append(hint);
}

async function advance(currentRun,next,feedback) {
  if (run !== currentRun || next.disabled) return;
  const {index,mission,step,answers,runId} = currentRun;
  if (step+1 < mission.questions.length) {
    currentRun.step++;
    renderQuestion();
    return;
  }
  if (currentRun.practice) {
    show('Latihan selesai','PENGAYAAN · LEVEL '+level.grade,true);
    content.append(add('p','story','Kamu sudah menuntaskan latihan '+mission.topic+'.'),
      button('Kembali ke pos','button teal',() => openMission(index)));
    return;
  }
  next.disabled = true;
  feedback.dataset.kind = '';
  feedback.textContent = 'Menyimpan hasil misi…';
  const token = playerToken;
  try {
    const result = await playerRequest('finish',{index,answers,runId},token);
    if (playerToken !== token) return;
    state = result.progress;
    drawDashboard();
  } catch (error) {
    if (playerToken !== token) return;
    next.disabled = false;
    feedback.dataset.kind = 'wrong';
    if (error.status === 401) next.hidden = true;
    reportPlayerError(error,feedback);
    return;
  }
  if (!dialog.open || !next.isConnected) return;
  if (index === missions.length) {
    openCertificate();
    return;
  }
  show('Misi '+mission.region+' selesai!','✦ POS DITAKLUKKAN',true);
  content.append(add('p','story',index === missions.length-1 ? 'Kapalmu sudah sampai di Merauke. Saatnya menghadapi Final Boss!' : 'Kapalmu siap berlayar menuju '+missions[index+1].region+'.'));
  const actions = add('div','actions');
  actions.append(button('Lihat kapal di peta','button soft',() => {
    deferredNavigation = focusMap;
    dialog.close();
  }));
  actions.append(button(index === missions.length-1 ? 'Buka Final Boss →' : 'Berlayar ke '+missions[index+1].region+' →','button teal',() => {
    if (index === missions.length-1) openBoss();
    else openMission(index+1);
  }));
  content.append(actions);
}

function makeCertificate() {
  const paper = add('article','certificate-paper');
  const date = add('time','',new Intl.DateTimeFormat('id-ID',{dateStyle:'long',timeZone:'UTC'}).format(new Date(state.date+'T00:00:00Z')));
  date.dateTime = state.date;
  paper.append(add('div','seal','✦'),add('p','eyebrow','SERTIFIKAT KELULUSAN'),add('h3','cert-title','Penjelajah Angka Nusantara'),add('p','cert-meta','Diberikan kepada'),add('p','recipient',state.name),add('p','','Telah menuntaskan Petualangan Matematika dari Sabang sampai Merauke.'),date);
  return paper;
}

function openCertificate() {
  if (!player) {
    openSignIn(openCertificate);
    return;
  }
  show('Sertifikat Penjelajah','NUSANTARA MATH ADVENTURE');
  if (!state.boss) {
    content.append(add('p','story','Selesaikan tujuh pos dan Final Boss untuk mendapatkan sertifikat atas namamu.'));
    return;
  }
  const preview = add('div');
  const form = add('form','cert-form');
  const label = add('label','','Nama lengkap penjelajah');
  label.htmlFor = 'certificate-name';
  const name = add('input');
  name.id = label.htmlFor;
  name.name = 'name';
  name.maxLength = 90;
  name.required = true;
  name.autocomplete = 'name';
  name.value = state.name || player.name;
  const actions = add('div','actions');
  const create = add('button','button teal',state.name ? 'Perbarui nama' : 'Buat sertifikat');
  create.type = 'submit';
  const print = button('Cetak / simpan PDF','button soft',() => {
    byId('print-certificate').replaceChildren(makeCertificate());
    window.print();
  });
  const update = () => {
    preview.replaceChildren();
    if (state.name) preview.append(makeCertificate());
    print.hidden = !state.name;
    print.disabled = name.value.trim() !== state.name;
  };
  actions.append(create,print);
  const status = statusLine();
  form.append(label,name,status,actions);
  name.addEventListener('input',() => {
    name.setCustomValidity('');
    print.disabled = name.value.trim() !== state.name;
  });
  form.addEventListener('submit',async event => {
    event.preventDefault();
    if (create.disabled) return;
    const value = clean(name.value);
    if (!value) {
      name.setCustomValidity('Masukkan nama lengkap terlebih dahulu.');
      name.reportValidity();
      return;
    }
    create.disabled = true;
    status.textContent = 'Menyimpan sertifikat…';
    const token = playerToken;
    try {
      const result = await playerRequest('certificate',{name:value},token);
      if (playerToken !== token) return;
      state = result.progress;
      name.value = state.name;
      update();
      status.textContent = 'Sertifikat tersimpan.';
      create.textContent = 'Perbarui nama';
      if (dialog.open && form.isConnected) print.focus();
    } catch (error) {
      if (playerToken !== token) return;
      reportPlayerError(error,status);
    } finally {
      create.disabled = false;
    }
  });
  content.append(add('p','story','Selamat, Penjelajah! Tulis nama lengkapmu untuk menerbitkan sertifikat.'),form,preview);
  update();
}

function showMap() {
  byId('opening').hidden = true;
  byId('adventure').hidden = false;
  beginGameSound();
  window.scrollTo(0,0);
  drawRoute();
  byId('map-title').focus({preventScroll:true});
}

function enterAdventure() {
  const opening = byId('opening');
  const enter = byId('enter-adventure');
  if (enter.getAttribute('aria-disabled') === 'true') return;

  beginGameSound();
  playEntrySound();

  function finishEntry() {
    if (player) showMap();
    else openSignIn();
    opening.classList.remove('is-sailing');
    enter.removeAttribute('aria-disabled');
  }

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    finishEntry();
    return;
  }
  enter.setAttribute('aria-disabled','true');
  opening.classList.add('is-sailing');
  window.setTimeout(finishEntry,620);
}

function focusMap() {
  const board = byId('map-board');
  const scroller = board.parentElement;
  const stop = missions[Math.min(state.cleared,missions.length-1)];
  scroller.scrollLeft = board.clientWidth * stop.pin[0] / 100 - scroller.clientWidth / 2;
  byId('peta').scrollIntoView({block:'start'});
  byId('current-button').focus({preventScroll:true});
}

function resume() {
  if (!player) {
    openSignIn(resume);
    return;
  }
  if (state.boss) openCertificate();
  else if (state.cleared === missions.length) openBoss();
  else openMission(state.cleared);
}

byId('open-quizzes').addEventListener('click',openQuizzes);
byId('open-profile').addEventListener('click',openProfile);
byId('open-certificate').addEventListener('click',openCertificate);
byId('enter-adventure').addEventListener('click',enterAdventure);
byId('current-button').addEventListener('click',resume);
byId('close-dialog').addEventListener('click',() => {
  if (dialog.hasAttribute('data-gameplay')) deferredNavigation = focusMap;
  dialog.close();
});
dialog.addEventListener('close',() => {
  stopQuizStory();
  if (!byId('opening').hidden && !player) stopGameSound();
  if (deferredNavigation) {
    const navigate = deferredNavigation;
    deferredNavigation = null;
    navigate();
  } else if (trigger?.isConnected) trigger.focus();
  else byId('current-button').focus();
});
clearLegacyData();
new ResizeObserver(drawRoute).observe(byId('map-board'));
updatePlayerDisplay();
drawDashboard();
