const quizId = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
const quizMethodsError = () => problem('Metode tidak didukung.',405);

function quizQuestion(item) {
  if (!item || !Array.isArray(item.options) || item.options.length !== 4 ||
      !Number.isInteger(item.answer) || item.answer < 0 || item.answer > 3) return null;
  const prompt = clean(item.prompt);
  const options = item.options.map(clean);
  if (!prompt || prompt.length > 350 || options.some(value => !value || value.length > 160) ||
      new Set(options.map(normalize)).size !== 4) return null;
  const image = item.image ?? '';
  if (typeof image !== 'string' || (image && !uuidPattern.test(image))) return null;
  return image ? {prompt,options,answer:item.answer,image} : {prompt,options,answer:item.answer};
}

async function validateQuizStory(db,story) {
  if (!story || typeof story !== 'object' || Array.isArray(story)) return null;
  const text = typeof story.text === 'string' ? story.text.trim() : '';
  const youtube = clean(story.youtube);
  if (text.length > 3000 || (youtube && !/^[A-Za-z0-9_-]{11}$/.test(youtube))) return null;
  const valid = {text,youtube};
  for (const kind of ['image','video','audio']) {
    const id = story[kind];
    if (id && !await mediaRecord(db,id,kind)) return null;
    valid[kind] = id || '';
  }
  return valid;
}

async function playerQuizStory(env,encoded) {
  const story = JSON.parse(encoded);
  const [image,video,audio] = await Promise.all(['image','video','audio'].map(kind => playerMediaUrl(env,story[kind])));
  return {text:story.text,youtube:story.youtube,image,video,audio};
}

async function adminQuizzes(request,env,path) {
  const id = path.slice('/api/admin/quizzes/'.length);
  const db = env.DB;
  if (request.method === 'GET' && path === '/api/admin/quizzes') {
    const {results} = await db.prepare(`
      SELECT id,title,published,version,grade,json_array_length(questions) AS count
      FROM custom_quizzes ORDER BY updated_at DESC,id
    `).all();
    return json({quizzes:results});
  }
  if (!quizId.test(id)) return problem('Kuis tidak ditemukan.',404);
  if (request.method === 'GET') {
    const row = await db.prepare('SELECT * FROM custom_quizzes WHERE id = ?').bind(id).first();
    return row ? json({...row,published:Boolean(row.published),questions:JSON.parse(row.questions),story:JSON.parse(row.story)}) : problem('Kuis tidak ditemukan.',404);
  }
  if (request.method !== 'PUT') return quizMethodsError();
  if (request.headers.get('origin') !== new URL(request.url).origin) return problem('Asal permintaan tidak diizinkan.',403);
  const body = await readJson(request,128*1024);
  const title = clean(body?.title);
  const version = body?.version;
  const questions = Array.isArray(body?.questions) ? body.questions.map(quizQuestion) : [];
  if (!title || title.length > 100 || !questions.length || questions.length > 30 || questions.some(item => !item) ||
      typeof body.published !== 'boolean' || !Number.isSafeInteger(version) || version < 0) {
    return problem('Isi judul dan 1–30 soal. Setiap soal perlu empat pilihan berbeda dan satu kunci.',422);
  }
  const grade = body.grade;
  if (!Number.isInteger(grade) || grade < 1 || grade > 6) return problem('Pilih kelas 1–6 untuk kuis ini.',422);
  const imageIds = [...new Set(questions.map(question => question.image).filter(Boolean))];
  if (imageIds.length) {
    const placeholders = imageIds.map(()=>'?').join(',');
    const {results} = await db.prepare("SELECT id FROM uploaded_media WHERE kind='image' AND id IN ("+placeholders+")")
      .bind(...imageIds).all();
    if (results.length !== imageIds.length) return problem('Pilih berkas gambar yang valid untuk setiap soal.',422);
  }
  const story = await validateQuizStory(db,body.story ?? {});
  if (!story) return problem('Periksa cerita, tautan YouTube, dan berkas media.',422);
  const storyJson = JSON.stringify(story);
  const published = Number(body.published);
  const encoded = JSON.stringify(questions);
  const statement = version === 0
    ? db.prepare(`INSERT INTO custom_quizzes (id,title,questions,published,updated_at,grade,story)
        VALUES (?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING RETURNING version`).bind(id,title,encoded,published,Date.now(),grade,storyJson)
    : db.prepare(`UPDATE custom_quizzes SET title=?,questions=?,published=?,updated_at=?,grade=?,story=?,version=version+1
        WHERE id=? AND version=? RETURNING version`).bind(title,encoded,published,Date.now(),grade,storyJson,id,version);
  const saved = await statement.first();
  if (saved) return json({version:saved.version});
  const latest = await db.prepare('SELECT version,title,questions,published,grade,story FROM custom_quizzes WHERE id=?').bind(id).first();
  if (latest?.title === title && latest.questions === encoded && latest.published === published && latest.grade === grade && latest.story === storyJson) return json({version:latest.version});
  return problem('Kuis sudah diubah di sesi lain. Buka ulang sebelum menyimpan.',409);
}

async function playerQuizzes(request,env,path) {
  const db = env.DB;
  const account = await session(request,db);
  if (!account) return problem('Sesi berakhir. Masuk kembali untuk melanjutkan.',401);
  const grade = account.row.grade ?? gradeFromClass(account.row.school_class);
  if (path === '/api/quizzes') {
    if (request.method !== 'GET') return quizMethodsError();
    const {results} = await db.prepare(`
      SELECT id,title,json_array_length(questions) AS count
      FROM custom_quizzes WHERE published=1 AND grade=? ORDER BY updated_at DESC,id
    `).bind(grade).all();
    return json({quizzes:results});
  }
  const id = path.slice('/api/quizzes/'.length);
  if (!quizId.test(id)) return problem('Kuis tidak ditemukan.',404);
  const row = await db.prepare('SELECT title,questions,version,story FROM custom_quizzes WHERE id=? AND published=1 AND grade=?').bind(id,grade).first();
  if (!row) return problem('Kuis ini sudah tidak tersedia.',404);
  const questions = JSON.parse(row.questions);
  if (request.method === 'GET') {
    const playerQuestions = await Promise.all(questions.map(async ({prompt,options,image}) => ({
      prompt,options,...(image ? {image:await playerMediaUrl(env,image)} : {})
    })));
    return json({title:row.title,version:row.version,story:await playerQuizStory(env,row.story),questions:playerQuestions});
  }
  if (request.method !== 'POST') return quizMethodsError();
  const body = await readJson(request);
  if (body?.version !== row.version) return problem('Kuis telah diperbarui. Buka kembali untuk mengerjakan versi terbaru.',409);
  const answers = body.answers;
  if (!Array.isArray(answers) || answers.length !== questions.length ||
      !answers.every(value => Number.isInteger(value) && value >= 0 && value < 4)) {
    return problem('Jawab semua soal sebelum mengirim.',422);
  }
  const results = questions.map((question,index) => question.answer === answers[index]);
  return json({correct:results.filter(Boolean).length,total:questions.length,results});
}
