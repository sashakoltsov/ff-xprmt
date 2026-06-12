const $app = document.getElementById('app');

// Tools run isolated: null-origin sandbox, scripts + downloads only.
// If a tool needs localStorage/same-origin APIs, see README (origin note).
const SANDBOX = 'allow-scripts allow-downloads';

let MANIFEST = null;

const esc = (s) => String(s).replace(/[&<>"]/g, c => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]
));

async function load() {
  if (MANIFEST) return MANIFEST;
  const res = await fetch('manifest.json', { cache: 'no-store' });
  if (!res.ok) throw new Error(`manifest.json ${res.status}`);
  MANIFEST = await res.json();
  return MANIFEST;
}

function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '');
  const parts = raw.split('/').filter(Boolean).map(decodeURIComponent);
  return { session: parts[0] || null, tool: parts[1] || null };
}

// ---- level 1: sessions ----
function sessionsView(m) {
  const cards = m.sessions.map(s => `
    <a class="card" href="#/${encodeURIComponent(s.id)}">
      <div class="code">${esc(s.id.toUpperCase())}</div>
      <div class="name">${esc(s.title)}</div>
      <div class="meta">${s.tools.length} ${s.tools.length === 1 ? 'tool' : 'tools'}</div>
    </a>`).join('');
  return `<div class="wrap">
    <p class="eyebrow">Saffron · AI Tools</p>
    <h1 class="title">Sessions</h1>
    <div class="grid">${cards}</div>
  </div>`;
}

// ---- level 2: tools in a session ----
function sessionView(m, id) {
  const s = m.sessions.find(x => x.id === id);
  if (!s) return notFound();
  const body = s.tools.length
    ? `<div class="grid">${s.tools.map(t => `
        <a class="card" href="#/${encodeURIComponent(s.id)}/${encodeURIComponent(t.slug)}">
          <div class="code">${esc(s.id.toUpperCase())}</div>
          <div class="name">${esc(t.name)}</div>
          <div class="meta">${esc(t.author)}</div>
        </a>`).join('')}</div>`
    : `<div class="empty">No tools dropped in yet.</div>`;
  return `<div class="wrap">
    <a class="backlink" href="#/">← sessions</a>
    <p class="eyebrow">${esc(s.id.toUpperCase())}</p>
    <h1 class="title">${esc(s.title)}</h1>
    ${body}
  </div>`;
}

// ---- level 3: the tool itself ----
function toolView(m, sid, slug) {
  const s = m.sessions.find(x => x.id === sid);
  const t = s && s.tools.find(x => x.slug === slug);
  if (!t) return notFound();
  return `<div class="toolview">
    <div class="toolbar">
      <a class="back" href="#/${encodeURIComponent(sid)}">← back to tools</a>
      <span class="label">${esc(t.name)} · ${esc(t.author)}</span>
    </div>
    <iframe src="${esc(t.path)}" sandbox="${SANDBOX}" title="${esc(t.name)}"></iframe>
  </div>`;
}

function notFound() {
  return `<div class="wrap">
    <a class="backlink" href="#/">← sessions</a>
    <div class="empty">Not found.</div>
  </div>`;
}

// ---- render loop ----
async function render() {
  let m;
  try {
    m = await load();
  } catch (e) {
    $app.innerHTML = `<div class="wrap"><div class="empty">
      Couldn't load manifest.json — serve this folder over http (not file://)
      and run <code>node build.mjs</code> first.<br><br>${esc(e.message)}
    </div></div>`;
    return;
  }
  const { session, tool } = parseHash();
  if (!session) $app.innerHTML = sessionsView(m);
  else if (!tool) $app.innerHTML = sessionView(m, session);
  else $app.innerHTML = toolView(m, session, tool);
  if (!tool) window.scrollTo(0, 0);
}

window.addEventListener('hashchange', render);
render();
