# Lux — How to Run

Lux is a desktop corpus-intelligence instrument built on Electron 31 + React 18 + TypeScript + Tailwind. It uses `better-sqlite3` with `sqlite-vec` for vector search and `@xenova/transformers` for local embeddings.

---

## Prerequisites

| Requirement | Version |
|---|---|
| Node.js | 20.x or 22.x (LTS) |
| npm | 9+ (bundled with Node) |
| Python | 3.x (required by `electron-rebuild` for native modules) |
| Visual Studio Build Tools | Windows only — required for `better-sqlite3` native compile |

> On Windows, install "Desktop development with C++" workload from Visual Studio Build Tools. Node-gyp depends on it.

---

## Install

```bash
cd stilled/products/lux
npm install
```

`postinstall` automatically runs `electron-rebuild -f -w better-sqlite3` after `npm install`. This recompiles the native SQLite bindings for the installed Electron version. It takes 1–3 minutes on first run.

If the postinstall rebuild fails, run manually:

```bash
npm run rebuild
```

---

## Dev (hot reload)

```bash
npm run dev
```

Opens the Electron window with Vite hot-module reload on the renderer side. Main process changes require a manual restart.

---

## Build (production)

```bash
npm run build
```

Output goes to `out/`. This bundles the renderer and compiles main + preload via electron-vite.

---

## Instrument Surfaces

Lux has four instrument surfaces, accessible from the sidebar:

### Reader (Text)
Import and read esoteric texts. Passages can be highlighted and annotated. Annotations are stored locally in SQLite. The reader supports text-to-passage segmentation for embedding.

### The Gathered (KnowledgeBase)
A semantic knowledge base. Ingested documents are chunked, embedded with `@xenova/transformers` (all-MiniLM-L6-v2), and stored as vectors in `sqlite-vec`. Supports semantic search across the corpus.

### Map (ConceptGraph)
A force-directed concept graph powered by `react-force-graph`. Visualises relationships between concepts extracted from the knowledge base. Nodes are concepts; edges represent co-occurrence or explicit links.

### The Chamber (ShadowWork)
A shadow-work journalling instrument. Entry gate (EntryGate) and containment gate (ContainmentGate) guide the session. Phase one and phase two structure the reflective process. Belief mapping (BeliefMap) surfaces patterns over time.

---

## Known Quirks

- **First embedding run is slow.** `@xenova/transformers` downloads the model (~25 MB) on first use and caches it in `node_modules/@xenova/transformers/.cache`. Subsequent runs are fast.
- **`better-sqlite3` must be rebuilt per Electron version.** If you upgrade Electron, run `npm run rebuild` again.
- **Path spaces on Windows.** The workspace path contains spaces (`great value`). When running scripts from a terminal, quote the path. Claude Code sessions that don't set `cwd` correctly will fail to find files — see `handoffs/engineering-lux-diagnosis.md`.
- **`out/` and `node_modules/` are not committed.** They are in `.gitignore`. Always run `npm install` after cloning.
- **sqlite-vec extension.** Loaded at runtime from `node_modules/sqlite-vec`. If the extension fails to load, check that `npm install` completed without errors and that the architecture matches.
