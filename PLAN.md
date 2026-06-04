# Plan — Script Launcher (Tauri)

## Context

Le projet ScriptLauncher existe sous forme de documentation uniquement (README + quelques scripts d'exemple). L'objectif est de l'implémenter from scratch en remplaçant la stack prévue (Electron + React CRA) par **Tauri + React + TypeScript + Vite**, qui produit des binaires natifs légers (~10 MB) sans Chromium embarqué.

Cibles : **macOS** (`.dmg` / `.app`) et **Windows** (`.exe` NSIS / `.msi`).

---

## Stack

| Couche | Technologie |
|--------|------------|
| UI | React 18 + TypeScript |
| Bundler front | Vite |
| Backend natif | Rust via Tauri 2 |
| Build macOS | `cargo tauri build` → `.app` + `.dmg` |
| Build Windows | `cargo tauri build` → `.exe` (NSIS) + `.msi` |

---

## Structure de fichiers à créer

```
ScriptLauncher/
├── src-tauri/
│   ├── src/
│   │   ├── main.rs                  # setup Tauri + register commands
│   │   └── commands/
│   │       ├── mod.rs
│   │       ├── script_runner.rs     # exécution + streaming stdout/stderr
│   │       └── file_system.rs       # lister les scripts d'un dossier
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   └── icons/                       # icônes générées par tauri icon
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── App.css
│   └── components/
│       ├── FolderSelector.tsx        # bouton dialog natif
│       ├── ScriptList.tsx            # liste filtrée des scripts
│       └── ScriptExecutor.tsx        # console temps réel + run/stop
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## Backend Rust — commandes Tauri

### `list_scripts(folder_path: String) -> Vec<ScriptInfo>`
Lit le dossier, filtre les extensions supportées, retourne nom + chemin + type.

### `execute_script(window: Window, script_path: String) -> Result<u32, String>`
- Détermine l'interpréteur selon l'extension (voir tableau ci-dessous)
- Spawn du processus enfant avec `stdout/stderr` piped
- Émet les événements Tauri `script-stdout` et `script-stderr` ligne par ligne (tokio async)
- Émet `script-exit` avec le code de retour
- Retourne le PID

### `stop_script(pid: u32) -> Result<(), String>`
Kill du processus via PID (`kill -9` / `TerminateProcess`).

### `open_folder_dialog() -> Option<String>`
Ouvre le picker de dossier natif via l'API `dialog` de Tauri.

### Interpréteurs par extension

| Extension | macOS | Windows |
|-----------|-------|---------|
| `.sh` | `bash <script>` | `bash <script>` (Git Bash) |
| `.py` | `python3 <script>` | `python <script>` |
| `.js` | `node <script>` | `node <script>` |
| `.rb` | `ruby <script>` | `ruby <script>` |
| `.pl` | `perl <script>` | `perl <script>` |
| `.ps1` | `pwsh -File <script>` | `powershell -File <script>` |
| `.bat` | N/A | `cmd /c <script>` |
| exécutable | `<script>` direct | `<script>` direct |

---

## Frontend React — composants

### `FolderSelector.tsx`
- Bouton "Sélectionner un dossier"
- Appelle `invoke('open_folder_dialog')`, met à jour l'état global avec le chemin
- Affiche le chemin actuel

### `ScriptList.tsx`
- Appelle `invoke('list_scripts', { folderPath })` à chaque changement de dossier
- Affiche la liste avec icône par type, nom, chemin relatif
- Sélection par clic, surbrillance du script actif

### `ScriptExecutor.tsx`
- Affiche le script sélectionné + boutons "Exécuter" / "Stopper"
- Écoute les events Tauri (`script-stdout`, `script-stderr`, `script-exit`) via `listen()`
- Console scrollable avec couleurs : stdout blanc, stderr rouge, exit code vert/rouge
- Bouton "Effacer la console"

### `App.tsx`
Layout 2 colonnes : liste à gauche, exécuteur à droite. FolderSelector en header.

---

## Dépendances

**package.json (front)**
```
@tauri-apps/api ^2
react ^18
react-dom ^18
typescript ^5
vite ^5
@vitejs/plugin-react
```

**Cargo.toml (rust)**
```
tauri = { version = "2", features = ["dialog", "shell"] }
serde = { features = ["derive"] }
serde_json
tokio = { features = ["full"] }
```

---

## Étapes d'implémentation

1. **Init Tauri** — `npm create tauri-app@latest` avec template React-TypeScript, dans le dossier existant
2. **Rust backend** — implémenter `file_system.rs`, `script_runner.rs`, `main.rs`
3. **Tauri config** — `tauri.conf.json` : permissions `dialog:open-folder`, `shell:execute`
4. **Frontend** — composants React dans l'ordre : FolderSelector → ScriptList → ScriptExecutor → App layout
5. **Styles** — CSS minimal, thème sombre (terminal-inspired)
6. **Test macOS** — `npm run tauri dev` puis `npm run tauri build`
7. **Vérification Windows** — cross-compilation ou CI GitHub Actions

---

## Vérification

- `npm run tauri dev` : lance l'app en mode dev avec hot-reload
- Ouvrir `example-scripts/` depuis l'UI, vérifier que `hello.py`, `hello.js`, `hello.sh` apparaissent
- Exécuter chaque script, vérifier que la sortie s'affiche en temps réel dans la console
- Tester le bouton "Stopper" sur un script long-running (ex: `sleep 30`)
- `npm run tauri build` → vérifier la présence du `.app` / `.dmg` dans `src-tauri/target/release/bundle/`
