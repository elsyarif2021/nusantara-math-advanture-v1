const byId = id => document.getElementById(id);
const results = byId('player-rows');
const status = byId('admin-status');
const previous = byId('previous-page');
const next = byId('next-page');
const classFilter = byId('class-filter');
const dateTime = new Intl.DateTimeFormat('id-ID',{
  timeZone:'Asia/Jakarta',dateStyle:'medium',timeStyle:'short'
});
let page = 1;
let filters = new URLSearchParams();
let activeRequest;

function renderOverview(data) {
  byId('total-players').textContent = data.summary.players;
  byId('total-stations').textContent = data.summary.stations;
  byId('total-completed').textContent = data.summary.completed;
  const selected = classFilter.value;
  const labels = [...new Set([...data.classes,selected].filter(Boolean))];
  classFilter.replaceChildren(new Option('Semua kelas',''),...labels.map(label => new Option(label,label)));
  classFilter.value = selected;

  results.replaceChildren();
  for (const player of data.players) {
    const row = results.insertRow();
    const finalStatus = player.boss ? 'Selesai' : player.cleared === 7 ? 'Terbuka' : 'Terkunci';
    for (const value of [player.name,player.school_class,player.cleared+'/7',finalStatus,dateTime.format(player.updated_at)]) {
      row.insertCell().textContent = value;
    }
  }
  const pageCount = Math.max(1,Math.ceil(data.total/data.pageSize));
  previous.disabled = page <= 1;
  next.disabled = page >= pageCount;
  previous.parentElement.hidden = pageCount === 1;
  byId('page-status').textContent = 'Halaman '+page+' dari '+pageCount;
  status.textContent = data.total ? data.total+' pemain · Diperbarui '+dateTime.format(Date.now()) : 'Belum ada pemain yang cocok.';
}

async function refresh() {
  activeRequest?.abort();
  const controller = new AbortController();
  activeRequest = controller;
  const params = new URLSearchParams(filters);
  params.set('page',String(page));
  try {
    const response = await fetch('/api/admin/overview?'+params,{cache:'no-store',signal:controller.signal});
    if (response.status === 401 || response.status === 403) {
      window.location.replace('/admin');
      return;
    }
    if (!response.ok) throw new Error('Data belum dapat dimuat.');
    renderOverview(await response.json());
  } catch (error) {
    if (error.name !== 'AbortError') status.textContent = 'Data belum dapat dimuat. Tekan Muat ulang untuk mencoba lagi.';
  }
}

byId('filters').addEventListener('submit',event => {
  event.preventDefault();
  filters = new URLSearchParams({q:byId('search-player').value,class:classFilter.value});
  page = 1;
  refresh();
});
byId('refresh').addEventListener('click',refresh);
previous.addEventListener('click',() => {page--; refresh();});
next.addEventListener('click',() => {page++; refresh();});
window.setInterval(() => {if (!document.hidden) refresh();},30000);
refresh();

let activityPage = 1;
let activityRequest;
const previousActivity = byId('previous-activity');
const nextActivity = byId('next-activity');

async function refreshActivity() {
  activityRequest?.abort();
  const controller = new AbortController();
  activityRequest = controller;
  const status = byId('activity-status');
  try {
    const response = await fetch('/api/admin/activity?page='+activityPage,{cache:'no-store',signal:controller.signal});
    if (response.status === 401 || response.status === 403) {
      window.location.replace('/admin');
      return;
    }
    if (!response.ok) throw new Error();
    const data = await response.json();
    const tbody = byId('activity-rows');
    tbody.replaceChildren();
    for (const event of data.rows) {
      const row = tbody.insertRow();
      for (const value of [dateTime.format(event.time),event.name,event.schoolClass,event.activity,event.mission || '—']) {
        row.insertCell().textContent = value;
      }
    }
    const pageCount = Math.max(1,Math.ceil(data.total/data.pageSize));
    previousActivity.disabled = activityPage <= 1;
    nextActivity.disabled = activityPage >= pageCount;
    previousActivity.parentElement.hidden = pageCount === 1;
    byId('activity-page-status').textContent = 'Halaman '+activityPage+' dari '+pageCount;
    status.textContent = data.total ? data.total+' catatan aktivitas' : 'Belum ada aktivitas permainan.';
  } catch (error) {
    if (error.name !== 'AbortError') status.textContent = 'Catatan belum dapat dimuat. Tekan Muat ulang untuk mencoba lagi.';
  }
}

previousActivity.addEventListener('click',() => {activityPage--; refreshActivity();});
nextActivity.addEventListener('click',() => {activityPage++; refreshActivity();});
byId('refresh').addEventListener('click',refreshActivity);
window.setInterval(() => {if (!document.hidden) refreshActivity();},30000);
refreshActivity();
