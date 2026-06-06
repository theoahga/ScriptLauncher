# ScriptLauncher

Application desktop pour lancer des scripts depuis un dossier local.

---

## Fonctionnel

### Ce que fait l'application

ScriptLauncher permet de sélectionner un dossier, de lister les scripts qu'il contient, et de les lancer d'un clic depuis une interface graphique native.

### État actuel (S-02)

L'application se lance et expose une commande backend pour lister les scripts d'un dossier. L'interface affiche encore "Hello ScriptLauncher" — la connexion UI arrive en S-05/S-06.

### Roadmap

| Story | Fonctionnalité |
|-------|---------------|
| S-01 ✅ | Initialisation — fenêtre de base |
| S-02 ✅ | Lecture du système de fichiers (`file_system.rs`) |
| S-03 | Exécution de scripts (`script_runner.rs`) |
| S-04 | Configuration Tauri + permissions |
| S-05 | Sélection de dossier (`FolderSelector`) |
| S-06 | Liste des scripts (`ScriptList`) |
| S-07 | Exécution depuis l'UI (`ScriptExecutor`) |
| S-08 | Layout + styles |

---

## Technique

### Stack

| Couche | Technologie |
|--------|-------------|
| Frontend | React 18 + TypeScript 5 + Vite 5 |
| Backend natif | Rust (Tauri 2) |
| Tests frontend | Vitest + Testing Library |
| Tests Rust | `cargo test` |
| CI | GitHub Actions |
| Cibles | macOS (`.app`/`.dmg`) · Windows (`.exe`/`.msi`) |

### Structure du projet

```
ScriptLauncher/
├── ui/                  # Frontend React/TS/Vite
│   ├── App.tsx          # Composant racine
│   ├── main.tsx         # Point d'entrée React
│   └── test/setup.ts    # Setup Vitest
├── core/                # Backend Rust/Tauri
│   ├── src/
│   │   ├── lib.rs       # Logique Tauri + commandes IPC
│   │   └── main.rs      # Délègue à lib.rs::run()
│   ├── capabilities/    # Permissions Tauri 2
│   ├── Cargo.toml
│   └── tauri.conf.json  # Config fenêtre, bundle, devUrl
├── workflow/            # Système multi-agents (méta)
│   ├── agents/          # Prompts agents
│   ├── artifacts/       # Artefacts par story (gitignored)
│   ├── prompt_pr/       # PRs d'évolution des prompts
│   └── scripts/         # Scripts CI/GitHub
├── index.html
├── package.json
└── vite.config.ts
```

### S-02 · Backend file_system.rs

**Fonctionnel**
- Le backend peut lister tous les scripts d'un dossier donné.
- Seuls les fichiers avec une extension reconnue sont retournés : `.sh` `.py` `.js` `.ts` `.ps1` `.bat` `.cmd` `.rb` `.fish`
- Les résultats sont triés par nom, insensible à la casse.

**Fichiers ajoutés/modifiés**

| Fichier | Rôle |
|---------|------|
| `core/src/file_system.rs` | Module Rust — logique de lecture de dossier + filtrage par extension |
| `core/src/lib.rs` | Enregistrement de la commande Tauri `list_scripts` |

**Commande IPC exposée**

```
list_scripts(folder: String) → Result<Vec<ScriptInfo>, String>
```

```rust
struct ScriptInfo {
    name: String,       // nom du fichier
    path: String,       // chemin absolu canonicalisé
    extension: String,  // extension sans point, en minuscules
}
```

**Décisions notables**
- `fs::canonicalize` pour garantir un chemin absolu (portable macOS/Windows).
- Extensions comparées en minuscules — `DEPLOY.SH` est reconnu.
- Entrées individuellement illisibles ignorées silencieusement (robustesse CI).
- `std::fs` uniquement — pas de plugin Tauri filesystem (ajouté en S-04 si besoin).

---

### Architecture Rust (pattern Tauri 2)

`main.rs` est volontairement minimal — il délègue entièrement à `lib.rs::run()`. Toutes les commandes Tauri (`#[tauri::command]`) sont déclarées dans `lib.rs`. Cela permet de tester la logique Rust sans démarrer l'application.

```
main.rs  →  lib.rs::run()  →  tauri::Builder
                                  └── register_commands()   (S-02+)
                                  └── manage_state()        (S-02+)
```

### Identifiant de bundle

`dev.theoclere.scriptlauncher` — figé depuis S-01, utilisé pour le stockage de données utilisateur (AppData macOS/Windows).

### Décisions architecturales notables

- **Pas de `@tauri-apps/vite-plugin`** : le package n'existe pas sur npm ; la configuration Vite reproduit manuellement les effets attendus (ports, env prefix, targets de build).
- **Permissions Tauri 2** : système de `capabilities` déclaratif (fichier `core/capabilities/default.json`), pas l'ancien `allowlist` Tauri 1.
- **TypeScript strict** : `strict: true`, `noUnusedLocals`, `noUnusedParameters` dès S-01.

### Prérequis

- [Node.js](https://nodejs.org/) 20+
- [Rust](https://rustup.rs/) stable
- Sur macOS : Xcode Command Line Tools (`xcode-select --install`)
- Sur Linux : `libwebkit2gtk-4.1-dev`, `libgtk-3-dev` (voir [Tauri prerequisites](https://tauri.app/start/prerequisites/))

### Démarrage rapide

```bash
# 1. Installer les dépendances npm
npm install

# 2. Lancer en mode développement (hot-reload frontend + Rust)
npm run tauri dev
```

L'app s'ouvre dans une fenêtre native. Le frontend se recharge automatiquement à chaque modification dans `ui/`. Le backend Rust recompile à chaque modification dans `core/src/`.

### Build de production

```bash
npm run tauri build
```

Les binaires et installeurs sont générés dans `core/target/release/bundle/` :
- macOS : `.app` et `.dmg`
- Windows : `.exe` et `.msi`

### Vérifications qualité

```bash
npx tsc --noEmit           # vérifie les types frontend
npm run test               # tests Vitest (frontend)

cd core && cargo check     # compile Rust sans build
cd core && cargo clippy    # lint Rust
cd core && cargo test      # tests Rust
```
