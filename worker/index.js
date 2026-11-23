const encoder = new TextEncoder();
const sessionLength = 12 * 60 * 60 * 1000;
const attemptWindow = 10 * 60 * 1000;
const adminPageSize = 50;
const profileColumns = 'id, name, school_class, grade, cleared, boss, certificate_name, completed_date';
const securityHeaders = {
  'x-content-type-options':'nosniff',
  'referrer-policy':'no-referrer',
  'x-frame-options':'DENY',
  'content-security-policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; frame-src https://www.youtube-nocookie.com; media-src 'self' blob:; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
};

function respond(body,status=200,headers={},embedGame=false) {
  const responseHeaders = new Headers({...securityHeaders,...headers});
  if (embedGame) {
    responseHeaders.delete('x-frame-options');
    responseHeaders.set('content-security-policy',
      securityHeaders['content-security-policy'].replace("frame-ancestors 'none'","frame-ancestors 'self' https://chatgpt.com")
    );
  }
  return new Response(body,{status,headers:responseHeaders});
}
function json(body,status=200) {
  return respond(JSON.stringify(body),status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});
}
function problem(error,status) {
  return json({error},status);
}
function asset(path,{privatePage=false,request}={}) {
  const found = assets[path];
  if (!found) return null;
  const [type,data] = found;
  const bytes = Uint8Array.from(atob(data),character => character.charCodeAt(0));
  const headers = {
    'content-type':type,
    'cache-control':privatePage ? 'no-store' : type.startsWith('text/') ? 'no-cache' : 'public, max-age=3600',
    'content-length':String(bytes.length)
  };
  const isAudio = type.startsWith('audio/');
  const embedGame = path === '/index.html';
  if (isAudio) headers['accept-ranges'] = 'bytes';
  if (request?.method === 'HEAD') return respond(null,200,headers,embedGame);
  const range = isAudio && request?.headers.get('range');
  if (!range) return respond(bytes,200,headers,embedGame);
  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  const invalid = () => respond(null,416,{'content-range':'bytes */'+bytes.length});
  if (!match || (!match[1] && !match[2])) return invalid();
  const first = match[1] ? Number(match[1]) : Math.max(0,bytes.length-Number(match[2]));
  const last = match[1] && match[2] ? Math.min(bytes.length-1,Number(match[2])) : bytes.length-1;
  if (!Number.isSafeInteger(first) || first < 0 || first > last || first >= bytes.length) return invalid();
  return respond(bytes.subarray(first,last+1),206,{
    ...headers,
    'content-length':String(last-first+1),
    'content-range':`bytes ${first}-${last}/${bytes.length}`
  });
}

const clean = value => typeof value === 'string' ? value.trim().replace(/\s+/g,' ') : '';
const normalize = value => value.normalize('NFKC').toLocaleLowerCase('id-ID');
const hex = bytes => Array.from(bytes,byte => byte.toString(16).padStart(2,'0')).join('');
const random = length => hex(crypto.getRandomValues(new Uint8Array(length)));
const digest = async value => hex(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(value))));

async function readJson(request, limit=4096) {
  if (!request.headers.get('content-type')?.startsWith('application/json')) return null;
  if (Number(request.headers.get('content-length')) > limit || !request.body) return null;
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let text = '';
  try {
    while (true) {
      const {done,value} = await reader.read();
      if (done) return JSON.parse(text+decoder.decode());
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        return null;
      }
      text += decoder.decode(value,{stream:true});
    }
  } catch { return null; }
}

function playerResponse(row) {
  return {
    player:{name:row.name,schoolClass:row.school_class,grade:row.grade ?? gradeFromClass(row.school_class)},
    progress:{cleared:row.cleared,boss:Boolean(row.boss),name:row.certificate_name,date:row.completed_date}
  };
}

async function recordLimit(db,bucket,now) {
  const record = await db.prepare(`
    INSERT INTO sign_in_limits (bucket, hits, expires_at) VALUES (?, 1, ?)
    ON CONFLICT(bucket) DO UPDATE SET
      hits = CASE WHEN expires_at <= ? THEN 1 ELSE hits + 1 END,
      expires_at = CASE WHEN expires_at <= ? THEN excluded.expires_at ELSE expires_at END
    RETURNING hits
  `).bind(bucket,now+attemptWindow,now,now).first();
  return record.hits;
}

async function signIn(request,env) {
  if (!request.headers.get('oai-authenticated-user-id')) {
    return problem('Masuk ke situs dengan akun ChatGPT untuk melanjutkan.',401);
  }
  const body = await readJson(request);
  const name = clean(body?.name);
  const schoolClass = clean(body?.schoolClass);
  const classGrade = gradeFromClass(schoolClass);
  const grade = body?.grade ?? classGrade;
  if (!name || name.length > 90 || !schoolClass || schoolClass.length > 32 || !Number.isInteger(grade) ||
      grade < 1 || grade > 6 || (classGrade && grade !== classGrade)) {
    return problem('Isi nama dan pilih kelas SD/MI 1–6 yang sesuai.',400);
  }
  const db = env.DB;
  const now = Date.now();
  const limitSalt = env.PLAYER_PIN_PEPPER ?? '';
  const network = request.headers.get('cf-connecting-ip') || 'unknown';
  const networkBucket = await digest('ip:'+network+':'+limitSalt);
  if (await recordLimit(db,networkBucket,now) > 150) return problem('Terlalu banyak percobaan. Coba lagi beberapa menit lagi.',429);
  const profileKey = JSON.stringify([normalize(name),normalize(schoolClass)]);
  const profileBucket = await digest('profile:'+profileKey+':'+limitSalt);
  if (await recordLimit(db,profileBucket,now) > 10) return problem('Terlalu banyak percobaan. Coba lagi beberapa menit lagi.',429);

  const findProfile = db.prepare('SELECT '+profileColumns+' FROM players WHERE profile_key = ?').bind(profileKey);
  let row = await findProfile.first();
  if (!row && !classGrade) return problem('Profil lama dengan label kelas ini tidak ditemukan.',404);
  if (!row) {
    // The original schema requires these two columns. New players have no PIN.
    row = await db.prepare(`
      INSERT INTO players (id,name,school_class,profile_key,pin_salt,pin_hash,created_at,updated_at,grade)
      VALUES (?,?,?,?,'','',?,?,?) ON CONFLICT(profile_key) DO NOTHING
      RETURNING ${profileColumns}
    `).bind(crypto.randomUUID(),name,schoolClass,profileKey,now,now,grade).first() ?? await findProfile.first();
  }
  if (row.grade === null) {
    await db.prepare('UPDATE players SET grade = ? WHERE id = ? AND grade IS NULL').bind(grade,row.id).run();
    row = await findProfile.first();
  }
  if (row.grade !== grade) return problem('Pilih kelas yang sesuai dengan profil ini.',409);
  const token = random(32);
  await db.batch([
    db.prepare('DELETE FROM player_sessions WHERE expires_at <= ?').bind(now),
    db.prepare('DELETE FROM sign_in_limits WHERE expires_at <= ?').bind(now),
    db.prepare('DELETE FROM sign_in_limits WHERE bucket = ?').bind(profileBucket),
    db.prepare('INSERT INTO player_sessions (token_hash,player_id,expires_at) VALUES (?,?,?)').bind(await digest(token),row.id,now+sessionLength),
    db.prepare('UPDATE players SET updated_at = ? WHERE id = ?').bind(now,row.id),
    activityRecord(db,crypto.randomUUID(),row.id,'login',null,now)
  ]);
  return json({...playerResponse(row),token});
}

async function session(request,db) {
  const authorization = request.headers.get('authorization') ?? '';
  const match = /^Bearer ([a-f0-9]{64})$/.exec(authorization);
  if (!match) return null;
  const tokenHash = await digest(match[1]);
  const row = await db.prepare(`
    SELECT players.* FROM players
    JOIN player_sessions ON player_sessions.player_id = players.id
    WHERE player_sessions.token_hash = ? AND player_sessions.expires_at > ?
  `).bind(tokenHash,Date.now()).first();
  return row ? {row,tokenHash} : null;
}

function activityRecord(db,id,playerId,type,index,now) {
  return db.prepare(`
    INSERT INTO game_activity (id,player_id,event_type,mission_index,occurred_at)
    VALUES (?,?,?,?,?) ON CONFLICT(id) DO NOTHING
  `).bind(id,playerId,type,index,now);
}

async function playerRequest(request,env,path) {
  const db = env.DB;
  const account = await session(request,db);
  if (!account) return problem('Sesi berakhir. Masuk kembali untuk melanjutkan.',401);
  const {row,tokenHash} = account;
  if (path === '/api/player/logout') {
    await db.prepare('DELETE FROM player_sessions WHERE token_hash = ?').bind(tokenHash).run();
    return json({ok:true});
  }
  const body = await readJson(request);
  if (path === '/api/player/finish') {
    const index = body?.index;
    const gradeAnswers = expectedAnswers[(row.grade ?? gradeFromClass(row.school_class))-1];
    const expected = Number.isInteger(index) && gradeAnswers?.[index];
    const submitted = body?.answers;
    const runId = typeof body?.runId === 'string' && /^[0-9a-f-]{36}$/.test(body.runId) ? body.runId : '';
    if (!runId || !expected || !Array.isArray(submitted) || expected.length !== submitted.length ||
        !expected.every((answer,i) => answer === submitted[i])) {
      return problem('Jawaban misi belum lengkap atau belum benar.',422);
    }
    if (index > row.cleared) return problem('Selesaikan pos sebelumnya terlebih dahulu.',409);
    const now = Date.now();
    const isBoss = index === gradeAnswers.length - 1;
    const event = activityRecord(db,row.id+':'+runId,row.id,isBoss ? 'boss' : 'mission',index,now);
    const date = new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Jakarta',dateStyle:'short'}).format(now);
    const progress = isBoss
      ? db.prepare(`
          UPDATE players SET boss = 1, updated_at = ?,
            completed_date = CASE WHEN completed_date = '' THEN ? ELSE completed_date END
          WHERE id = ? AND cleared = ?
        `).bind(now,date,row.id,index)
      : db.prepare('UPDATE players SET cleared = MAX(cleared,?), updated_at = ? WHERE id = ?')
        .bind(index+1,now,row.id);
    await db.batch([event,progress]);
  } else {
    const name = clean(body?.name);
    if (!row.boss || !name || name.length > 90) return problem('Selesaikan permainan dan isi nama sertifikat.',422);
    await db.prepare('UPDATE players SET certificate_name = ?, updated_at = ? WHERE id = ?')
      .bind(name,Date.now(),row.id).run();
  }
  const updated = await db.prepare('SELECT '+profileColumns+' FROM players WHERE id = ?').bind(row.id).first();
  return json(playerResponse(updated));
}

function adminAccess(request,env) {
  const id = request.headers.get('oai-authenticated-user-id');
  const email = request.headers.get('oai-authenticated-user-email')?.trim().toLowerCase();
  if (!id || !email) return 401;
  const allowed = (env.ADMIN_EMAILS ?? '').split(',').map(value => value.trim().toLowerCase());
  return allowed.includes(email) ? 200 : 403;
}

function adminLogin(status) {
  const content = status === 401
    ? '<p>Masuk dengan akun ChatGPT admin untuk memantau permainan.</p><a class="button teal" href="/signin-with-chatgpt?return_to=%2Fadmin" target="_top">Masuk admin dengan ChatGPT</a>'
    : '<p>Halaman ini khusus akun admin yang ditetapkan untuk permainan.</p><a class="button teal" href="/signout-with-chatgpt?return_to=%2Fadmin" target="_top">Ganti akun ChatGPT</a>';
  return respond(`<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Masuk admin · Nusantara Math Adventure</title><link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/admin.css"></head><body><main class="admin-login"><div class="eyebrow">NUSANTARA MATH ADVENTURE</div><h1>Masuk admin</h1>${content}<a href="/">Kembali ke permainan</a></main></body></html>`,
    status === 401 ? 200 : status,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});
}

async function adminOverview(request,env) {
  const query = new URL(request.url).searchParams;
  const name = normalize(clean(query.get('q')).slice(0,90));
  const schoolClass = normalize(clean(query.get('class')).slice(0,32));
  const requestedPage = Number(query.get('page'));
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 && requestedPage <= 20000 ? requestedPage : 1;
  const db = env.DB;
  const where = "WHERE (? = '' OR instr(profile_key, ?) > 0) AND (? = '' OR lower(school_class) = ?)";
  const [summary, classes, count, rows] = await db.batch([
    db.prepare('SELECT COUNT(*) AS players, COALESCE(SUM(boss),0) AS completed, COALESCE(SUM(cleared),0) AS stations FROM players'),
    db.prepare('SELECT MIN(school_class) AS label FROM players GROUP BY lower(school_class) ORDER BY lower(school_class)'),
    db.prepare('SELECT COUNT(*) AS total FROM players '+where).bind(name,name,schoolClass,schoolClass),
    db.prepare(`
      SELECT name, school_class, cleared, boss, updated_at FROM players ${where}
      ORDER BY updated_at DESC, id DESC LIMIT ? OFFSET ?
    `).bind(name,name,schoolClass,schoolClass,adminPageSize,(page-1)*adminPageSize)
  ]);
  return json({
    summary:summary.results[0], classes:classes.results.map(row => row.label), players:rows.results,
    total:count.results[0].total,page,pageSize:adminPageSize
  });
}

const activitySelect = `
  SELECT game_activity.id, players.name, players.school_class, event_type, mission_index, occurred_at
  FROM game_activity JOIN players ON players.id = game_activity.player_id
`;
const activityOrder = ' ORDER BY occurred_at DESC, game_activity.id DESC';
const activityLabels = ['Sumatra','Jawa','Kalimantan','Sulawesi','Bali & Nusa Tenggara','Maluku','Papua','Final Boss'];
const activityDate = new Intl.DateTimeFormat('sv-SE',{
  timeZone:'Asia/Jakarta',dateStyle:'short',timeStyle:'medium'
});
const activityName = type => ({login:'Pemain masuk',mission:'Pos selesai',boss:'Final Boss selesai'})[type];

async function adminActivity(request,env) {
  const requested = Number(new URL(request.url).searchParams.get('page'));
  const page = Number.isSafeInteger(requested) && requested > 0 && requested <= 20000 ? requested : 1;
  const db = env.DB;
  const [count,rows] = await db.batch([
    db.prepare('SELECT COUNT(*) AS total FROM game_activity'),
    db.prepare(activitySelect+activityOrder+' LIMIT ? OFFSET ?').bind(adminPageSize,(page-1)*adminPageSize)
  ]);
  return json({
    page,pageSize:adminPageSize,total:count.results[0].total,
    rows:rows.results.map(row => ({
      name:row.name,schoolClass:row.school_class,activity:activityName(row.event_type),
      mission:activityLabels[row.mission_index] ?? '',time:row.occurred_at
    }))
  });
}

function csvCell(value) {
  const text = String(value);
  const safe = /^[\s]*[=+@-]|^[\t\r\n]/.test(text) ? "'"+text : text;
  return '"'+safe.replaceAll('"','""')+'"';
}

function activityCsv(env) {
  let time = Date.now();
  let lastId = '~';
  let first = true;
  const stream = new ReadableStream({
    async pull(controller) {
      if (first) {
        first = false;
        controller.enqueue(encoder.encode('\uFEFFWaktu WIB,Nama pemain,Kelas,Aktivitas,Pos\r\n'));
        return;
      }
      const {results} = await env.DB.prepare(activitySelect+`
        WHERE occurred_at < ? OR (occurred_at = ? AND game_activity.id < ?)
        `+activityOrder+' LIMIT 1000').bind(time,time,lastId).all();
      if (results.length) {
        const lines = results.map(row => [
          activityDate.format(row.occurred_at),row.name,row.school_class,
          activityName(row.event_type),activityLabels[row.mission_index] ?? ''
        ].map(csvCell).join(','));
        controller.enqueue(encoder.encode(lines.join('\r\n')+'\r\n'));
        const last = results.at(-1);
        time = last.occurred_at;
        lastId = last.id;
      }
      if (results.length < 1000) controller.close();
    }
  });
  return respond(stream,200,{
    'content-type':'text/csv; charset=utf-8',
    'content-disposition':'attachment; filename="nusantara-catatan-permainan.csv"',
    'cache-control':'no-store'
  });
}

export default {
  async fetch(request,env) {
    const path = new URL(request.url).pathname;
    try {
      if (path === '/admin' || path === '/admin/' || path.startsWith('/api/admin/')) {
        const access = adminAccess(request,env);
        if (path.startsWith('/api/admin/')) {
          if (access !== 200) return problem('Akses khusus admin.',access);
          if (path.startsWith('/api/admin/media/')) return await adminMedia(request,env,path);
          if (path === '/api/admin/audio-settings') return await adminAudioSettings(request,env);
          if (path === '/api/admin/quizzes' || path.startsWith('/api/admin/quizzes/')) return await adminQuizzes(request,env,path);
          if (request.method !== 'GET') return problem('Metode tidak didukung.',405);
          if (path === '/api/admin/overview') return await adminOverview(request,env);
          if (path === '/api/admin/activity') return await adminActivity(request,env);
          if (path === '/api/admin/activity.csv') return activityCsv(env);
          return problem('Halaman tidak ditemukan.',404);
        }
        if (request.method !== 'GET') return problem('Metode tidak didukung.',405);
        return access === 200 ? asset('/admin.html',{privatePage:true}) : adminLogin(access);
      }
      if (path.startsWith('/media/')) return await publicMedia(request,env,path.slice('/media/'.length));
      if (path === '/api/audio-settings') {
        return request.method === 'GET' ? await readAudioSettings(env,true) : problem('Metode tidak didukung.',405);
      }
      if (path === '/api/quizzes' || path.startsWith('/api/quizzes/')) return await playerQuizzes(request,env,path);
      if (path === '/api/player/login') {
        return request.method === 'POST' ? await signIn(request,env) : problem('Metode tidak didukung.',405);
      }
      if (['/api/player/logout','/api/player/finish','/api/player/certificate'].includes(path)) {
        return request.method === 'POST' ? await playerRequest(request,env,path) : problem('Metode tidak didukung.',405);
      }
      if (path !== '/admin.html' && ['GET','HEAD'].includes(request.method)) {
        const found = asset(path === '/' ? '/index.html' : path,{request});
        if (found) return found;
      }
      return respond('Halaman tidak ditemukan.',404,{'content-type':'text/plain; charset=utf-8'});
    } catch (error) {
      console.error('Nusantara request failed',path,error?.name ?? 'Error',error?.message ?? '');
      return problem('Server sedang bermasalah. Coba lagi sebentar.',503);
    }
  }
};
