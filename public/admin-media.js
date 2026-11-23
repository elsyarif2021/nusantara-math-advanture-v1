const formats = {
  jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',
  mp4:'video/mp4',webm:'video/webm',mp3:'audio/mpeg',wav:'audio/wav',m4a:'audio/mp4',ogg:'audio/ogg'
};
const maxMegabytes = {image:5,audio:10,video:25};
const uploadIds = new WeakMap();

export function validateMedia(file,kind) {
  if (!file) return;
  const mime = formats[file.name.split('.').pop().toLowerCase()];
  if (!mime?.startsWith(kind+'/')) throw new Error('Format '+file.name+' tidak didukung.');
  if (!file.size || file.size > maxMegabytes[kind]*1024*1024) {
    throw new Error(file.name+' harus berukuran lebih dari 0 dan maksimal '+maxMegabytes[kind]+' MB.');
  }
  return mime;
}

export async function uploadMedia(file,kind) {
  const mime = validateMedia(file,kind);
  let id = uploadIds.get(file);
  if (!id) {
    id = crypto.randomUUID();
    uploadIds.set(file,id);
  }
  const response = await fetch('/api/admin/media/'+id,{
    method:'PUT',headers:{'Content-Type':mime,'X-Filename':encodeURIComponent(file.name.slice(0,160))},
    body:file
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'Gagal mengunggah '+file.name+'.');
  return result.id;
}

export function youtubeId(value) {
  if (!value.trim()) return '';
  let url;
  try { url = new URL(value.trim()); } catch { throw new Error('Masukkan URL video YouTube yang valid.'); }
  const host = url.hostname;
  let id;
  if (url.protocol === 'https:' && host === 'youtu.be') id = url.pathname.split('/')[1];
  if (url.protocol === 'https:' && ['www.youtube.com','youtube.com','m.youtube.com','www.youtube-nocookie.com'].includes(host)) {
    const [,mode,clip] = url.pathname.split('/');
    id = mode === 'watch' ? url.searchParams.get('v') : ['shorts','live','embed'].includes(mode) ? clip : '';
  }
  if (!id || !/^[A-Za-z0-9_-]{11}$/.test(id)) throw new Error('Masukkan URL video YouTube yang valid.');
  return id;
}

export function mediaField(field) {
  const {input,remove,saved} = typeof field === 'string' ? {
    input:document.getElementById(field),
    remove:document.getElementById(field+'-remove'),
    saved:document.getElementById(field+'-saved')
  } : field;
  const kind = input.dataset.kind;
  let existing = '';
  function update() {
    remove.hidden = !existing && !input.files.length;
    saved.hidden = !existing;
    if (existing) saved.href = '/api/admin/media/'+existing;
    else saved.removeAttribute('href');
  }
  input.addEventListener('change',update);
  remove.addEventListener('click',() => {
    existing = '';
    input.value = '';
    update();
    input.dispatchEvent(new Event('input',{bubbles:true}));
  });
  return {
    set(id) {
      existing = id || '';
      input.value = '';
      update();
    },
    validate() { validateMedia(input.files[0],kind); },
    value() { return input.files[0] ? uploadMedia(input.files[0],kind) : Promise.resolve(existing); },
    preview() {
      const file = input.files[0];
      if (file) {
        validateMedia(file,kind);
        const url = URL.createObjectURL(file);
        return {url,release:()=>URL.revokeObjectURL(url)};
      }
      return existing ? {url:'/api/admin/media/'+existing} : null;
    }
  };
}
