# ScriptLauncher

A native desktop app to browse and run scripts from local folders — built with Tauri 2, React, and Rust.

---

## Features

- **Categorized script browser** — organize scripts into named categories, each backed by a folder on disk
- **One-click execution** — launch any script directly from the UI, with optional arguments
- **Live streaming output** — stdout appears line by line as the script runs; stdin input is also supported
- **Stop / SIGINT controls** — interrupt a running script with `^C` (SIGINT) or force-kill it (SIGKILL)
- **Execution history** — the 50 most recent runs are persisted locally, with full stdout/stderr capture
- **Multi-tab** — open multiple scripts side by side, each in its own tab
- **Persistent config** — categories survive app restarts via an atomic JSON config file

---

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 · TypeScript 5 · Vite 5 |
| Native backend | Rust · Tauri 2 |
| Frontend tests | Vitest · Testing Library |
| Rust tests | `cargo test` |
| CI | GitHub Actions |
| Targets | macOS (`.app` / `.dmg`) · Windows (`.exe` / `.msi`) |

---

## Project structure

```
ScriptLauncher/
├── ui/                          # React / TypeScript frontend
│   ├── App.tsx                  # Root component — tab bar + layout
│   ├── main.tsx                 # React entry point
│   ├── types.ts                 # Shared types (mirror Rust structs)
│   └── components/
│       ├── CategoryManager.tsx  # Collapsible category tree (sidebar)
│       ├── ScriptList.tsx       # Scripts in a folder
│       ├── ScriptExecutor.tsx   # Run panel — output, args, stdin, stop
│       ├── HistoryPanel.tsx     # Execution history viewer
│       ├── FolderSelector.tsx   # Native folder picker
│       └── Sidebar.tsx          # Sidebar shell
├── core/                        # Rust / Tauri backend
│   ├── src/
│   │   ├── lib.rs               # Tauri builder + command registration
│   │   ├── main.rs              # Delegates to lib.rs::run()
│   │   ├── file_system.rs       # list_scripts command
│   │   ├── script_runner.rs     # run_script_stream / kill / stdin / ctrl-c
│   │   ├── config.rs            # get_config / save_config (atomic write)
│   │   └── history.rs           # append_history / get_history / clear_history
│   ├── capabilities/
│   │   └── default.json         # Tauri 2 capability declarations
│   ├── Cargo.toml
│   └── tauri.conf.json          # Window, bundle, devUrl config
├── index.html
├── package.json
└── vite.config.ts
```

---

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [Rust](https://rustup.rs/) stable
- macOS: Xcode Command Line Tools — `xcode-select --install`
- Linux: `libwebkit2gtk-4.1-dev`, `libgtk-3-dev` (see [Tauri prerequisites](https://tauri.app/start/prerequisites/))

### Development

```bash
# Install npm dependencies
npm install

# Start with hot-reload (frontend + Rust)
npm run tauri dev
```

The app opens in a native window. The frontend reloads automatically on changes in `ui/`; the Rust backend recompiles on changes in `core/src/`.

### Production build

```bash
npm run tauri build
```

Binaries and installers are generated in `core/target/release/bundle/`:
- macOS: `.app` and `.dmg`
- Windows: `.exe` and `.msi`

---

## Quality checks

```bash
# TypeScript type-check (frontend)
npx tsc --noEmit

# Frontend tests (Vitest)
npm run test

# Rust — compile check
cd core && cargo check

# Rust — linter
cd core && cargo clippy

# Rust — tests
cd core && cargo test
```

---

## Architecture notes

**IPC pattern** — `main.rs` is intentionally minimal; it delegates entirely to `lib.rs::run()`. All `#[tauri::command]` handlers are declared in their own modules (`file_system`, `script_runner`, `config`, `history`) and registered in `lib.rs`. This keeps the Rust logic testable without starting Tauri.

**Script streaming** — `run_script_stream` spawns the script process and emits `script-stdout` events line by line. A `script-done` event fires when the process exits, carrying the exit code and any buffered stderr. The frontend listens to these Tauri events with `listen()`.

**Atomic config writes** — `save_config` writes to a `.tmp` file on the same filesystem, then renames it atomically to `config.json`, preventing corruption on crash.

**History persistence** — execution history is stored as JSONL (one JSON object per line) in the app data directory. The format is append-only; `clear_history` deletes the file entirely.

**Tauri 2 capabilities** — permissions are declared declaratively in `core/capabilities/default.json`. Only `core:default` and `dialog:allow-open` are granted; no `fs:*` or `shell:*` access is exposed to the frontend.

**Bundle identifier** — `dev.theoclere.scriptlauncher` — fixed at project init, used for OS-level app data storage (macOS / Windows).
