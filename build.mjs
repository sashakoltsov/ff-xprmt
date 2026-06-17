// build.mjs — regenerate manifest.json from the tools/ folder.
// Run after dropping in a tool:  node build.mjs
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('.', import.meta.url).pathname;
const TOOLS = join(ROOT, 'tools');

const titleCase = (slug) =>
  slug.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

// Optional card cover: drop a `cover.<ext>` into the tool folder.
const COVER_EXTS = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'avif'];
const findCover = (dir, sessionId, slug) => {
  for (const ext of COVER_EXTS) {
    if (existsSync(join(dir, `cover.${ext}`))) {
      return `tools/${sessionId}/${slug}/cover.${ext}`;
    }
  }
  return null;
};

// Optional session cover: drop a `cover.<ext>` directly into the session folder.
const findSessionCover = (sessionId) => {
  const dir = join(TOOLS, sessionId);
  for (const ext of COVER_EXTS) {
    if (existsSync(join(dir, `cover.${ext}`))) {
      return `tools/${sessionId}/cover.${ext}`;
    }
  }
  return null;
};

async function readMeta(sessionId, slug) {
  const dir = join(TOOLS, sessionId, slug);
  if (!existsSync(join(dir, 'index.html'))) {
    console.warn(`! skip ${sessionId}/${slug} — no index.html`);
    return null;
  }
  let name = titleCase(slug);
  let author = 'Unknown';
  let trusted = false;
  let ai = false;
  const metaPath = join(dir, 'meta.json');
  if (existsSync(metaPath)) {
    try {
      const m = JSON.parse(await readFile(metaPath, 'utf8'));
      if (m.name) name = m.name;
      if (m.author) author = m.author;
      // "trusted": true runs the tool same-origin (adds allow-same-origin).
      // Needed for camera/mic and other same-origin APIs — but it collapses
      // the sandbox isolation for this tool. Only set it on tools you trust.
      if (m.trusted === true) trusted = true;
      // "ai": true — tool needs an AI API that isn't wired up here; show a
      // copy-the-prompt gate instead of running it in the iframe.
      if (m.ai === true) ai = true;
    } catch (e) {
      console.warn(`! ${sessionId}/${slug} — bad meta.json: ${e.message}`);
    }
  } else {
    console.warn(`! ${sessionId}/${slug} — no meta.json, using folder name`);
  }
  const tool = { slug, name, author, path: `tools/${sessionId}/${slug}/index.html` };
  if (trusted) tool.trusted = true;
  if (ai) tool.ai = true;
  const cover = findCover(dir, sessionId, slug);
  if (cover) tool.cover = cover;
  return tool;
}

async function scanSession(sessionId) {
  const dir = join(TOOLS, sessionId);
  if (!existsSync(dir)) return [];
  const entries = await readdir(dir, { withFileTypes: true });
  const slugs = entries.filter((e) => e.isDirectory()).map((e) => e.name).sort();
  const tools = [];
  for (const slug of slugs) {
    const t = await readMeta(sessionId, slug);
    if (t) tools.push(t);
  }
  return tools;
}

async function build() {
  const sessions = JSON.parse(await readFile(join(ROOT, 'sessions.json'), 'utf8'));
  const out = { generated: new Date().toISOString(), sessions: [] };
  for (const s of sessions) {
    const tools = await scanSession(s.id);
    const entry = { id: s.id, title: s.title, tools };
    const cover = findSessionCover(s.id);
    if (cover) entry.cover = cover;
    out.sessions.push(entry);
    console.log(`· ${s.id}: ${tools.length} tool(s)${cover ? ' + cover' : ''}`);
  }
  await writeFile(join(ROOT, 'manifest.json'), JSON.stringify(out, null, 2) + '\n');
  console.log('✓ manifest.json written');
}

build().catch((e) => { console.error(e); process.exit(1); });
