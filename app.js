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
  const cards = m.sessions.map(s => {
    const covers = s.tools.filter(t => t.cover).map(t => t.cover);
    const live = covers.length > 0;
    return `
    <a class="card${live ? ' session-card' : ''}" href="#/${encodeURIComponent(s.id)}"${
      live ? ` data-covers='${esc(JSON.stringify(covers))}'` : ''}>
      ${live ? `<div class="session-covers" aria-hidden="true"><div class="frame"></div><div class="frame"></div></div>` : ''}
      <div class="code${s.id === 'work' ? ' is-work' : ''}">${esc(s.id.toUpperCase())}</div>
      <div class="foot">
        <div class="name">${esc(s.title)}</div>
        <div class="meta">${s.tools.length} ${s.tools.length === 1 ? 'tool' : 'tools'}</div>
      </div>
    </a>`;
  }).join('');
  return `<div class="wrap">
    <p class="eyebrow">Saffron · AI Tools</p>
    <h1 class="title">AI × FF Tools</h1>
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
          ${t.cover ? `<div class="cover" style="background-image:url('${esc(t.cover)}')"></div>` : ''}
          <div class="code${s.id === 'work' ? ' is-work' : ''}">${esc(s.id.toUpperCase())}</div>
          <div class="foot">
            <div class="name">${esc(t.name)}</div>
            <div class="byline"><span class="by">by</span> <span class="who">${esc(t.author)}</span></div>
          </div>
        </a>`).join('')}</div>`
    : `<div class="empty">No tools dropped in yet.</div>`;
  return `<div class="wrap">
    <div class="session-head">
      <a class="backlink" href="#/">← sessions</a>
      <span class="session-tag${s.id === 'work' ? ' is-work' : ''}">${esc(s.id.toUpperCase())}</span>
    </div>
    <h1 class="title">${esc(s.title)}</h1>
    ${body}
  </div>`;
}

// ---- level 3: the tool itself ----
function toolView(m, sid, slug) {
  const s = m.sessions.find(x => x.id === sid);
  const t = s && s.tools.find(x => x.slug === slug);
  if (!t) return notFound();
  // Trusted tools run same-origin so camera/mic + other same-origin APIs work.
  // This collapses the sandbox isolation for that tool (see README).
  const sandbox = t.trusted ? `${SANDBOX} allow-same-origin` : SANDBOX;
  // AI tools can't fully run here (no API). Still load the tool as a faint,
  // non-interactive backdrop behind a 90% paper veil, with a copy-the-prompt
  // gate floated on top.
  const body = t.ai
    ? `<div class="ai-stage">
        <iframe class="ai-bg" src="${esc(t.path)}" sandbox="${esc(sandbox)}" tabindex="-1" aria-hidden="true" title="${esc(t.name)} preview"></iframe>
        <div class="ai-veil"></div>
        <div class="ai-gate" data-ai-path="${esc(t.path)}">
          <div class="ai-card">
            <p class="ai-eyebrow">Uses AI</p>
            <h2 class="ai-title">This tool runs on Gemini</h2>
            <p class="ai-text">It needs a Gemini API key, which isn't wired up here. Copy the prompt below and paste it into the Gemini canvas environment to run it:</p>
            <textarea class="ai-prompt" readonly spellcheck="false">Loading the tool source…</textarea>
            <div class="ai-actions">
              <button class="ai-copy" type="button">Copy prompt</button>
              <a class="ai-open" href="https://gemini.google.com/app" target="_blank" rel="noopener noreferrer">Open Gemini ↗</a>
            </div>
          </div>
        </div>
      </div>`
    : `<iframe src="${esc(t.path)}" sandbox="${esc(sandbox)}" allow="camera; microphone" title="${esc(t.name)}"></iframe>`;
  return `<div class="toolview">
    <div class="toolbar">
      <a class="back" href="#/${encodeURIComponent(sid)}">← back to tools</a>
      <span class="label">${esc(t.name)} <span class="by">by</span> ${esc(t.author)}</span>
    </div>
    ${body}
  </div>`;
}

// ---- AI gate: fetch the tool's HTML, build the Gemini prompt, wire copy ----
function enhanceAITool() {
  const gate = document.querySelector('.ai-gate');
  if (!gate) return;
  const ta = gate.querySelector('.ai-prompt');
  const btn = gate.querySelector('.ai-copy');
  fetch(gate.dataset.aiPath, { cache: 'no-store' })
    .then(r => r.text())
    .then(html => {
      ta.value = `I have this tool, can you run it in canvas:\n\n${html}`;
    })
    .catch(e => { ta.value = `Couldn't load the tool source: ${e.message}`; });
  btn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(ta.value);
    } catch {
      ta.select();
      document.execCommand('copy');
    }
    btn.textContent = 'Copied ✓';
    setTimeout(() => { btn.textContent = 'Copy prompt'; }, 1500);
  });
}

function notFound() {
  return `<div class="wrap">
    <a class="backlink" href="#/">← sessions</a>
    <div class="empty">Not found.</div>
  </div>`;
}

// ---- session-card hover: randomised cover slideshow + slow zoom ----
const REDUCE_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function enhanceSessionCovers() {
  if (REDUCE_MOTION) return;
  document.querySelectorAll('.session-card[data-covers]').forEach(card => {
    let covers;
    try { covers = JSON.parse(card.dataset.covers); } catch { return; }
    if (!covers || !covers.length) return;

    covers.forEach(src => { const im = new Image(); im.src = src; });  // preload

    const layer = card.querySelector('.session-covers');
    const frames = layer.querySelectorAll('.frame');
    const base = frames[0];   // always opaque, holds the current cover
    const over = frames[1];   // fades the next cover in on top
    const BEAT = 220, FADE = 140;
    let timer = null, commitT = null, zoom = null;

    // shuffled sequence so every cover shows once per pass (no repeats /
    // no lingering on a duplicate) — steady, regular rhythm
    let order = [], oi = 0, last = null;
    const reshuffle = () => {
      order = covers.slice();
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }
      if (order.length > 1 && order[0] === last) [order[0], order[1]] = [order[1], order[0]];
      oi = 0;
    };
    const nextCover = () => {
      if (oi >= order.length) reshuffle();
      return (last = order[oi++]);
    };

    const ZOOM_IN = 'cubic-bezier(0.11, 0, 0.5, 0)';    // gradual ease-in (easeInQuad)
    const ZOOM_OUT = 'cubic-bezier(0.33, 1, 0.68, 1)';  // quick ease-out back
    const zoomIn = () => {
      if (zoom) zoom.cancel();
      zoom = layer.animate(
        [{ transform: 'scale(1)' }, { transform: 'scale(2.4)' }],
        { duration: 10000, easing: ZOOM_IN, fill: 'forwards' }
      );
    };
    const zoomBack = () => {
      const cur = new DOMMatrix(getComputedStyle(layer).transform).a || 1;
      if (zoom) zoom.cancel();
      zoom = layer.animate(
        [{ transform: `scale(${cur})` }, { transform: 'scale(1)' }],
        { duration: 220, easing: ZOOM_OUT, fill: 'forwards' }
      );
    };

    // fade the next cover in on top; after a fixed FADE, commit it to the
    // opaque base and reset the overlay — deterministic, so the beat is even
    const tick = () => {
      over.style.backgroundImage = `url('${nextCover()}')`;
      over.style.opacity = '1';
      clearTimeout(commitT);
      commitT = setTimeout(() => {
        base.style.backgroundImage = over.style.backgroundImage;
        over.style.transition = 'none';
        over.style.opacity = '0';
        void over.offsetWidth;
        over.style.transition = '';
      }, FADE);
    };

    card.addEventListener('mouseenter', () => {
      clearInterval(timer); clearTimeout(commitT);
      reshuffle();
      base.style.transition = over.style.transition = 'none';
      base.style.backgroundImage = `url('${nextCover()}')`;
      base.style.opacity = '1';
      over.style.opacity = '0';
      void over.offsetWidth;
      base.style.transition = over.style.transition = '';
      timer = setInterval(tick, BEAT);
      zoomIn();
    });
    card.addEventListener('mouseleave', () => {
      clearInterval(timer); clearTimeout(commitT); timer = null;
      zoomBack();
    });
  });
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
  document.body.classList.toggle('is-tool', !!tool);
  if (!session) { $app.innerHTML = sessionsView(m); enhanceSessionCovers(); }
  else if (!tool) $app.innerHTML = sessionView(m, session);
  else { $app.innerHTML = toolView(m, session, tool); enhanceAITool(); }
  if (!tool) window.scrollTo(0, 0);
}

window.addEventListener('hashchange', render);
render();
