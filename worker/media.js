const mediaFormats = {
  'image/jpeg':'image','image/png':'image','image/webp':'image',
  'video/mp4':'video','video/webm':'video',
  'audio/mpeg':'audio','audio/wav':'audio','audio/mp4':'audio','audio/ogg':'audio'
};
const mediaLimits = {image:5*1024*1024,audio:10*1024*1024,video:25*1024*1024};
const uuidPattern = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;

function mediaMatches(bytes,mime) {
  const starts = (...values) => values.every((value,i) => bytes[i] === value);
  const label = (offset,value) => [...value].every((letter,i)=>bytes[offset+i] === letter.charCodeAt(0));
  switch (mime) {
    case 'image/jpeg': return starts(255,216,255);
    case 'image/png': return starts(137,80,78,71,13,10,26,10);
    case 'image/webp': return label(0,'RIFF') && label(8,'WEBP');
    case 'audio/wav': return label(0,'RIFF') && label(8,'WAVE');
    case 'audio/ogg': return label(0,'OggS');
    case 'audio/mpeg': return label(0,'ID3') || (bytes[0] === 255 && (bytes[1] & 224) === 224);
    case 'audio/mp4':
    case 'video/mp4': return label(4,'ftyp');
    case 'video/webm': return starts(26,69,223,163);
    default: return false;
  }
}

async function mediaRecord(db,id,kind) {
  if (typeof id !== 'string' || !uuidPattern.test(id)) return null;
  const row = await db.prepare('SELECT * FROM uploaded_media WHERE id=?').bind(id).first();
  return row && (!kind || row.kind === kind) ? row : null;
}

async function boundedMedia(request,limit) {
  if (!request.body || Number(request.headers.get('content-length')) > limit) return null;
  const reader = request.body.getReader();
  const parts = [];
  let size = 0;
  while (true) {
    const {done,value} = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      return null;
    }
    parts.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    bytes.set(part,offset);
    offset += part.byteLength;
  }
  return bytes;
}

async function adminMedia(request,env,path) {
  const id = path.slice('/api/admin/media/'.length);
  if (!uuidPattern.test(id)) return problem('Media tidak ditemukan.',404);
  if (['GET','HEAD'].includes(request.method)) return streamMedia(request,env,id);
  if (request.method !== 'PUT') return problem('Metode tidak didukung.',405);
  if (request.headers.get('origin') !== new URL(request.url).origin) return problem('Asal permintaan tidak diizinkan.',403);
  const mime = request.headers.get('content-type')?.split(';')[0];
  const kind = Object.hasOwn(mediaFormats,mime) && mediaFormats[mime];
  if (!kind) return problem('Format berkas ini tidak didukung.',415);
  let name;
  try { name = clean(decodeURIComponent(request.headers.get('x-filename') || '')).slice(0,160); }
  catch { return problem('Nama berkas tidak valid.',400); }
  const prior = await mediaRecord(env.DB,id);
  if (prior) return prior.mime === mime && prior.name === name ? json(prior) : problem('ID media sudah digunakan.',409);
  const bytes = await boundedMedia(request,mediaLimits[kind]);
  if (!bytes) return problem('Ukuran berkas melebihi batas unggahan.',413);
  if (!mediaMatches(bytes,mime)) return problem('Isi berkas tidak cocok dengan format yang dipilih.',415);
  const written = await env.BUCKET.put(id,bytes,{onlyIf:new Headers({'If-None-Match':'*'})});
  if (!written) {
    const existing = await mediaRecord(env.DB,id);
    return existing && existing.mime === mime && existing.name === name
      ? json(existing) : problem('Unggahan sedang diproses. Coba kembali.',409);
  }
  try {
    await env.DB.prepare('INSERT INTO uploaded_media (id,kind,mime,name,size) VALUES (?,?,?,?,?)')
      .bind(id,kind,mime,name,bytes.length).run();
  } catch (error) {
    await env.BUCKET.delete(id).catch(() => {});
    throw error;
  }
  return json({id,kind,mime,name,size:bytes.length},201);
}

async function mediaSignature(env,id,expires) {
  const key = await crypto.subtle.importKey('raw',encoder.encode(env.PLAYER_PIN_PEPPER),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return hex(new Uint8Array(await crypto.subtle.sign('HMAC',key,encoder.encode('media:'+id+':'+expires))));
}

async function playerMediaUrl(env,id) {
  if (!id || !env.PLAYER_PIN_PEPPER) return '';
  const expires = Math.floor(Date.now()/1000)+12*60*60;
  return '/media/'+id+'?expires='+expires+'&sig='+await mediaSignature(env,id,expires);
}

async function publicMedia(request,env,id) {
  if (!['GET','HEAD'].includes(request.method)) return problem('Metode tidak didukung.',405);
  const {searchParams} = new URL(request.url);
  const expires = Number(searchParams.get('expires'));
  const sig = searchParams.get('sig') ?? '';
  const now = Math.floor(Date.now()/1000);
  if (!uuidPattern.test(id) || !env.PLAYER_PIN_PEPPER || !Number.isSafeInteger(expires) ||
      expires <= now || expires > now+12*60*60 || !/^[a-f0-9]{64}$/.test(sig) ||
      !equalDigest(sig,await mediaSignature(env,id,expires))) return problem('Media tidak ditemukan.',404);
  return streamMedia(request,env,id);
}

function requestedMediaRange(header,size) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!match || (!match[1] && !match[2])) return null;
  const offset = match[1] ? Number(match[1]) : Math.max(0,size-Number(match[2]));
  const last = match[1] && match[2] ? Math.min(size-1,Number(match[2])) : size-1;
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > last || offset >= size) return null;
  return {offset,length:last-offset+1};
}

async function streamMedia(request,env,id) {
  const row = await mediaRecord(env.DB,id);
  if (!row) return problem('Media tidak ditemukan.',404);
  const header = request.headers.get('range');
  const range = header ? requestedMediaRange(header,row.size) : null;
  if (header && !range) return respond(null,416,{'content-range':'bytes */'+row.size});
  const headers = {
    'content-type':row.mime,'content-length':String(range?.length ?? row.size),
    'accept-ranges':'bytes','cache-control':'private, no-store'
  };
  if (range) headers['content-range'] = 'bytes '+range.offset+'-'+(range.offset+range.length-1)+'/'+row.size;
  if (request.method === 'HEAD') return respond(null,range ? 206 : 200,headers);
  const object = await env.BUCKET.get(id,range ? {range} : undefined);
  if (!object) return problem('Berkas media tidak ditemukan.',404);
  return respond(object.body,range ? 206 : 200,headers);
}
