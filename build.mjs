// build.mjs — regenerate manifest.json from the tools/ folder.
// Run after dropping in a tool:  node build.mjs
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('.', import.meta.url).pathname;
const TOOLS = join(ROOT, 'tools');

const titleCase = (slug) =>
  slug.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

async function readMeta(sessionId, slug) {
  const dir = join(TOOLS, sessionId, slug);
  if (!existsSync(join(dir, 'index.html'))) {
    console.warn(`! skip ${sessionId}/${slug} — no index.html`);
    return null;
  }
  let name = titleCase(slug);
  let author = 'Unknown';
  const metaPath = join(dir, 'meta.json');
  if (existsSync(metaPath)) {
    try {
      const m = JSON.parse(await readFile(metaPath, 'utf8'));
      if (m.name) name = m.name;
      if (m.author) author = m.author;
    } catch (e) {
      console.warn(`! ${sessionId}/${slug} — bad meta.json: ${e.message}`);
    }
  } else {
    console.warn(`! ${sessionId}/${slug} — no meta.json, using folder name`);
  }
  return { slug, name, author, path: `tools/${sessionId}/${slug}/index.html` };
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
    out.sessions.push({ id: s.id, title: s.title, tools });
    console.log(`· ${s.id}: ${tools.length} tool(s)`);
  }
  await writeFile(join(ROOT, 'manifest.json'), JSON.stringify(out, null, 2) + '\n');
  console.log('✓ manifest.json written');
}

build().catch((e) => { console.error(e); process.exit(1); });
