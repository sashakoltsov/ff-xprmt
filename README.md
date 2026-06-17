# Saffron AI Tools — portal

A static wrapper for the single-page HTML tools built in the AI adoption sessions.
Three levels: **sessions → tools → tool**. Each tool runs in a sandboxed iframe;
the 40px top bar (back nav) lives in the parent shell, so tools can't touch it.

## Run it locally

Must be served over http (the shell `fetch`es `manifest.json`; `file://` is blocked):

```
python3 -m http.server 8000
# → http://localhost:8000
```

## Add a tool

1. Drop the author's HTML into:
   `tools/<session>/<slug>/index.html`
   e.g. `tools/s04/halftone-machine/index.html`
2. Add `meta.json` next to it:
   `{ "name": "Halftone Machine", "author": "Leif" }`
   Optional flags in `meta.json`:
   - `"ai": true` — the tool needs an AI API that isn't wired up here. Instead
     of a dead iframe, the tool view loads it as a faint, non-interactive
     backdrop behind a copy-the-prompt gate (the prompt embeds the tool's HTML
     for pasting into Gemini canvas).
   - `"trusted": true` — runs the tool same-origin (adds `allow-same-origin`)
     so camera/mic and other same-origin APIs work. This collapses the sandbox
     isolation for that tool, so only set it on tools you control.
3. (Optional) Drop a `cover.png` (or `.jpg`/`.jpeg`/`.webp`/`.gif`/`.avif`)
   into the tool folder — `build.mjs` picks it up as the card cover. It fills
   the card behind an FDF578 75% wash so the type still reads.
4. Regenerate the manifest:
   `node build.mjs`

That's it. The slug (folder name) should be lowercase-hyphenated; the display
name comes from `meta.json`. Single-file tools are just a folder with one
`index.html`. Multi-file tools (assets, separate JS/CSS) drop in the same way —
keep everything inside the tool's folder and reference it relatively.

## Add a session

Edit `sessions.json` (ordered; controls the landing page):

```json
{ "id": "s06", "title": "S06 — Something New" }
```

Then `mkdir tools/s06` and start dropping tools in. Empty sessions show on the
landing page with a "no tools yet" state.

## Sandbox / origin note

Tools load with `sandbox="allow-scripts allow-downloads"` (see `app.js`). That
gives each tool a **null origin**: isolated `localStorage`, no access to the
parent. Canvas tools, downloads, file inputs all work.

If a tool genuinely needs `localStorage` or other same-origin APIs it will break
under this sandbox. Two options, in order of preference:
1. Patch the tool to not rely on persistent storage.
2. Serve `tools/` from a separate subdomain and add `allow-same-origin` — the
   cross-origin boundary keeps isolation intact. Don't add `allow-same-origin`
   while same-origin; that collapses the sandbox.

## Structure

```
index.html      shell (mount point)
app.js          hash router + render (sessions / session / tool)
styles.css      all styling — safe to restyle freely
sessions.json   ordered session definitions  ← you edit
build.mjs       folder scan → manifest.json
manifest.json   generated — do not hand-edit
tools/<s>/<slug>/{index.html, meta.json}
```

## Handoff (Claude Code)

This is a working scaffold. Open the folder in Claude Code for: deploy wiring
(GitHub Pages / Netlify / internal static host), batch-importing real session
tools, and the v2 generative tile covers (variable colour/params per tile).
The build step is the only non-static piece and it runs locally — the deploy
artifact is just these static files plus a fresh `manifest.json`.
