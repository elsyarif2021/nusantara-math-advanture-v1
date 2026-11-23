import {mediaField,youtubeId} from './admin-media.js';

const byId = id => document.getElementById(id);
const editor = byId('quiz-editor');
const fields = byId('quiz-questions');
const addQuestion = byId('quiz-add-question');
const saveButton = byId('quiz-save');
const status = byId('quiz-admin-status');
const formStatus = byId('quiz-form-status');
const storyFields = Object.fromEntries(['image','video','audio'].map(kind => [kind,mediaField('quiz-'+kind)]));
const questionImages = new WeakMap();
let editing;
let changed = false;
let busy = false;

function element(tag,text) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  return node;
}
async function request(path='',options) {
  const response = await fetch('/api/admin/quizzes'+path,options);
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Data kuis belum bisa dimuat.');
  return result;
}
function allowSwitch() {
  return !busy && (!changed || window.confirm('Tinggalkan perubahan kuis yang belum disimpan?'));
}

function renumber() {
  const rows = [...fields.children];
  rows.forEach((row,index) => {
    row.querySelector('legend').textContent = 'Soal '+(index+1);
    row.querySelector('[data-remove-question]').disabled = rows.length === 1;
    row.querySelector('[data-upload-question]').setAttribute('aria-label','Unggah gambar soal '+(index+1));
  });
  addQuestion.disabled = rows.length >= 30;
}

function labeled(label,input) {
  const wrapper = element('label',label);
  wrapper.append(input);
  return wrapper;
}

function questionImage(row,id) {
  const controls = element('div');
  controls.className = 'question-image-controls';
  const input = element('input');
  input.type = 'file';
  input.hidden = true;
  input.dataset.kind = 'image';
  input.accept = '.jpg,.jpeg,.png,.webp';
  const upload = element('button','Unggah gambar');
  upload.type = 'button';
  upload.className = 'button soft';
  upload.dataset.uploadQuestion = '';
  upload.addEventListener('click',() => input.click());
  const remove = element('button','Lepas gambar');
  remove.type = 'button';
  remove.className = 'button soft';
  const saved = element('a','Buka gambar tersimpan');
  saved.target = '_blank';
  saved.rel = 'noopener';
  const name = element('p','JPG, PNG, atau WebP · Maks. 5 MB');
  name.setAttribute('aria-live','polite');
  const updateName = () => {
    name.textContent = input.files[0]?.name || 'JPG, PNG, atau WebP · Maks. 5 MB';
  };
  input.addEventListener('change',() => { changed = true; updateName(); });
  input.addEventListener('input',updateName);
  controls.append(input,upload,remove,saved,name);
  const field = mediaField({input,remove,saved});
  field.set(id);
  questionImages.set(row,{
    validate:field.validate,
    value:field.value,
    set(value) { field.set(value); updateName(); }
  });
  return controls;
}

function insertQuestion(question={prompt:'',options:['','','',''],answer:0}) {
  const row = element('fieldset');
  const prompt = element('textarea');
  prompt.value = question.prompt;
  prompt.required = true;
  prompt.maxLength = 350;
  prompt.rows = 2;
  row.append(element('legend'),labeled('Pertanyaan',prompt),questionImage(row,question.image));
  question.options.forEach((value,index) => {
    const input = element('input');
    input.required = true;
    input.maxLength = 160;
    input.value = value;
    row.append(labeled('Pilihan '+('ABCD'[index]),input));
  });
  const answer = element('select');
  [...'ABCD'].forEach((letter,index) => answer.append(new Option(letter,String(index))));
  answer.value = String(question.answer);
  const remove = element('button','Hapus soal');
  remove.type = 'button';
  remove.className = 'button soft';
  remove.dataset.removeQuestion = '';
  remove.addEventListener('click',() => {row.remove(); changed = true; renumber(); addQuestion.focus();});
  row.append(labeled('Kunci jawaban',answer),remove);
  fields.append(row);
  renumber();
  return prompt;
}

function showEditor(quiz) {
  editing = quiz;
  changed = false;
  editor.hidden = false;
  byId('quiz-editor-title').textContent = quiz.version ? 'Edit kuis' : 'Kuis baru';
  byId('quiz-title').value = quiz.title;
  byId('quiz-published').checked = quiz.published;
  byId('quiz-grade').value = quiz.grade ?? '';
  const story = quiz.story ?? {};
  byId('quiz-story').value = story.text ?? '';
  byId('quiz-youtube').value = story.youtube ? 'https://www.youtube.com/watch?v='+story.youtube : '';
  for (const [kind,field] of Object.entries(storyFields)) field.set(story[kind]);
  byId('legacy-story-image').hidden = !story.image;
  formStatus.textContent = '';
  fields.replaceChildren();
  if (quiz.questions.length) quiz.questions.forEach(insertQuestion);
  else insertQuestion();
  byId('quiz-title').focus();
}
async function refresh() {
  const {quizzes} = await request();
  const rows = quizzes.map(quiz => {
    const row = element('li');
    const button = element('button','Edit');
    button.type = 'button';
    button.className = 'button soft';
    button.setAttribute('aria-label','Edit '+quiz.title);
    button.addEventListener('click',async () => {
      if (!allowSwitch()) return;
      busy = true;
      try {showEditor(await request('/'+quiz.id));}
      catch(error) {status.textContent = error.message;}
      finally {busy = false;}
    });
    row.append(element('span',quiz.title+' · '+quiz.count+' soal · '+(quiz.grade ? 'Kelas '+quiz.grade+' · '+(quiz.published ? 'Terbit' : 'Draf') : 'Perlu pilih kelas')),button);
    return row;
  });
  byId('quiz-admin-list').replaceChildren(...rows);
  status.textContent = rows.length ? rows.length+' kuis' : 'Belum ada kuis tambahan.';
}

byId('quiz-new').addEventListener('click',() => {
  if (allowSwitch()) showEditor({id:crypto.randomUUID(),version:0,title:'',published:false,questions:[]});
});
byId('quiz-cancel').addEventListener('click',() => {
  if (!allowSwitch()) return;
  editor.hidden = true;
  changed = false;
  byId('quiz-new').focus();
});
addQuestion.addEventListener('click',() => {changed = true; insertQuestion().focus();});
editor.addEventListener('input',() => {changed = true;});
byId('quiz-image-remove').addEventListener('click',() => {byId('legacy-story-image').hidden = true;});
editor.addEventListener('submit',async event => {
  event.preventDefault();
  if (busy) return;
  const title = byId('quiz-title').value.trim();
  const published = byId('quiz-published').checked;
  const grade = Number(byId('quiz-grade').value);
  const rows = [...fields.children];
  const images = rows.map(row => questionImages.get(row));
  const questions = rows.map(row => ({
    prompt:row.querySelector('textarea').value,
    options:[...row.querySelectorAll('input:not([type=file])')].map(input => input.value),
    answer:Number(row.querySelector('select').value)
  }));
  busy = true;
  editor.inert = true;
  formStatus.textContent = 'Menyimpan…';
  try {
    const story = {text:byId('quiz-story').value,youtube:youtubeId(byId('quiz-youtube').value)};
    for (const field of [...Object.values(storyFields),...images]) field.validate();
    for (const [kind,field] of Object.entries(storyFields)) story[kind] = await field.value();
    for (const [index,field] of images.entries()) questions[index].image = await field.value();
    const saved = await request('/'+editing.id,{
      method:'PUT',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({version:editing.version,title,published,questions,grade,story})
    });
    editing.version = saved.version;
    for (const [kind,field] of Object.entries(storyFields)) field.set(story[kind]);
    images.forEach((field,index) => field.set(questions[index].image));
    changed = false;
    byId('quiz-editor-title').textContent = 'Edit kuis';
    formStatus.textContent = published ? 'Kuis sudah terbit dan bisa dimainkan.' : 'Draf kuis tersimpan.';
    refresh().catch(error => {status.textContent = error.message;});
  } catch(error) {
    formStatus.textContent = error.message;
  } finally {
    busy = false;
    editor.inert = false;
    saveButton.focus();
  }
});
refresh().catch(error => {status.textContent = error.message;});
