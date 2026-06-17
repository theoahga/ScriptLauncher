# Story S-10 — Streaming stdout + bouton Stop

**ID :** S-10  
**Titre :** Streaming stdout temps-réel + bouton Stop  
**Dépend de :** S-08 (layout panel output en place), S-07 (ScriptExecutor existant)  
**Branche :** story/S-10

## Description

En tant qu'utilisateur,
je veux voir la sortie standard d'un script s'afficher ligne par ligne en temps réel,
et pouvoir stopper l'exécution à tout moment via un bouton Stop,
afin de pouvoir lancer des scripts longue durée ou à boucle infinie et les interrompre.

## Critères d'acceptation

### Backend Rust

- Une nouvelle commande Tauri asynchrone `run_script_stream(path: String, window: Window)` :
  - Spawn le processus de façon **non-bloquante** (`tokio::process::Command` avec `stdout(Stdio::piped())`)
  - Lit `stdout` ligne par ligne via `BufReader` async et émet un événement Tauri `script-stdout` par ligne : `{ line: String }`
  - À la fin du processus, émet un événement `script-done` : `{ exit_code: i32, stderr: String }`
  - Le `stderr` est collecté entièrement à la fin (pas de streaming stderr pour simplifier)
  - Le `pid` du processus est stocké dans un `Arc<Mutex<Option<u32>>>` partagé (state Tauri)
- Une commande `kill_script() → ()` :
  - Lit le PID stocké et envoie `SIGTERM` sur Unix / `TerminateProcess` sur Windows
  - Remet le PID à `None` après kill
- L'ancienne commande `run_script` (bloquante) est conservée (pas de breaking change)

### Frontend

- `ScriptExecutor` est mis à jour :
  - Utilise `listen('script-stdout', ...)` et `listen('script-done', ...)` de `@tauri-apps/api/event`
  - La zone d'output affiche les lignes au fur et à mesure (append, pas replace)
  - Auto-scroll vers le bas à chaque nouvelle ligne
  - Un bouton **Stop** est visible pendant l'exécution, caché sinon
  - Le clic sur Stop appelle `invoke('kill_script')`
  - Quand `script-done` est reçu : bouton Stop disparaît, exit code affiché, unlisten des événements
- L'output est affiché dans un `<pre>` ou zone monospace avec scroll interne
- La zone d'output est **vidée** à chaque nouvelle exécution (pas d'accumulation entre runs)

### Qualité

- `cd core && cargo check` passe sans erreur
- `npx tsc --noEmit` passe sans erreur
- Tests Vitest : au moins 5 cas
  - Affichage de lignes successives via événements simulés
  - Bouton Stop visible pendant exécution, caché sinon
  - Clic Stop → `kill_script` invoqué
  - Auto-scroll déclenché à chaque ligne
  - Zone vidée au démarrage d'un nouveau run
- Tests Rust : au moins 2 cas
  - `kill_script` quand aucun PID stocké → pas de panique
  - PID stocké + kill → PID remis à None

## Out of scope

- Streaming de `stderr` ligne par ligne (collecté en bloc à la fin)
- Timeout automatique d'exécution
- Arguments passés au script par l'utilisateur
- Exécution parallèle de plusieurs scripts
- Historique (S-11)

## Contexte technique

```
core/src/
├── lib.rs              # enregistrer run_script_stream et kill_script dans generate_handler!
├── script_runner.rs    # run_script existant (conserver), ajouter run_script_stream + kill_script
└── main.rs
```

Dépendance Rust à ajouter dans `core/Cargo.toml` :
```toml
tokio = { version = "1", features = ["full"] }
```
(Tauri 2 utilise déjà tokio en interne — vérifier si déjà présent avant d'ajouter)

Événements Tauri frontend :
```typescript
import { listen } from '@tauri-apps/api/event';

const unlisten1 = await listen<{ line: string }>('script-stdout', (e) => { ... });
const unlisten2 = await listen<{ exit_code: number; stderr: string }>('script-done', (e) => { ... });
// Appeler unlisten1() et unlisten2() dans le cleanup useEffect
```

PID state côté Rust :
```rust
// Dans lib.rs / main.rs — state Tauri
struct ScriptPid(Arc<Mutex<Option<u32>>>);
```

Chemin du projet : `/Users/theoclere/Development/ScriptLauncher`  
Branche de départ : `story/S-08` (ou `main` si S-08 mergée) — S-10 peut partir de S-08 directement, S-09 n'est pas un prérequis.

**Note de sécurité :** Le kill envoie SIGTERM (pas SIGKILL) pour laisser le script nettoyer. Si le process ne répond pas, l'utilisateur peut relancer l'app. Ne pas exposer une API de kill arbitraire par PID externe — le PID doit provenir uniquement du state interne Tauri.
