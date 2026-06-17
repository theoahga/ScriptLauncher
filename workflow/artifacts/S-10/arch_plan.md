# Plan technique — S-10 : Streaming stdout temps-réel + bouton Stop

## Compréhension de la story

Il s'agit d'ajouter deux nouvelles commandes Tauri (`run_script_stream` et `kill_script`) qui permettent d'exécuter un script de façon non-bloquante avec streaming ligne par ligne de stdout via des événements Tauri, et d'interrompre l'exécution à tout moment. Le composant `ScriptExecutor.tsx` est mis à jour pour consommer ces événements en temps réel.

## Périmètre technique

- Fichiers Rust à modifier :
  - `core/src/script_runner.rs` — ajouter `run_script_stream` et `kill_script`
  - `core/src/lib.rs` — enregistrer les deux nouvelles commandes + state PID
  - `core/Cargo.toml` — ajouter tokio si absent (vérification : absent du Cargo.toml actuel)
- Fichiers TypeScript à modifier :
  - `ui/components/ScriptExecutor.tsx` — streaming, bouton Stop, auto-scroll
- Fichiers de config à modifier :
  - `core/Cargo.toml` — dépendance tokio

## Interfaces et contrats

### Commandes Tauri (Frontend → Rust)

#### `run_script_stream`

```rust
#[tauri::command]
pub async fn run_script_stream(path: String, window: tauri::Window) -> Result<(), String>
```

- Spawn le processus en non-bloquant avec `tokio::process::Command`
- stdout pipé (`Stdio::piped()`), stderr pipé
- Lit stdout ligne par ligne via `tokio::io::BufReader` + `AsyncBufReadExt::lines()`
- Pour chaque ligne : émet l'événement `script-stdout` avec payload `{ "line": "<contenu>" }`
- À la fin du process :
  - Collecte `stderr` entier (pas de streaming)
  - Émet l'événement `script-done` avec payload `{ "exit_code": <i32>, "stderr": "<contenu>" }`
  - Remet le PID à `None` dans le state
- Stocke le PID dans `state: tauri::State<'_, ScriptPid>` avant de démarrer la boucle de lecture
- Retourne `Ok(())` immédiatement après avoir spawné le child (la boucle tourne en tâche tokio)

**Note ADR-01** : la commande est `async` et retourne immédiatement après spawn. La boucle de lecture est spawned dans une tâche tokio séparée avec `tokio::spawn`.

#### `kill_script`

```rust
#[tauri::command]
pub async fn kill_script(state: tauri::State<'_, ScriptPid>) -> Result<(), String>
```

- Lit le PID stocké dans `state.0.lock().await` (ou `.lock().unwrap()` selon impl)
- Si PID `None` → retourne `Ok(())` sans panique (edge case story : kill sans PID actif)
- Si PID `Some(pid)` :
  - Unix : envoie `SIGTERM` via `nix::sys::signal::kill` ou `std::process::Command::new("kill").arg("-TERM")`
  - Windows : `TerminateProcess` via winapi ou via `taskkill /PID <pid> /F`
  - Remet le PID à `None`
- Retourne `Ok(())`

**ADR-02 : implémentation du kill cross-plateforme**

Pour éviter d'ajouter la crate `nix` (dépendance lourde), on utilise la méthode du processus tokio enfant directement. Le child `tokio::process::Child` sera stocké dans le state plutôt que son PID u32. Cela permet d'appeler `child.kill().await` directement.

**Révision ADR-02 après réflexion** : stocker le `Child` dans le state est plus propre que stocker le PID nu. Le type du state devient :

```rust
pub struct ScriptProcess(Arc<Mutex<Option<tokio::process::Child>>>);
```

Cela simplifie le kill (pas besoin de SIGTERM manuel) et évite une dépendance sur `nix`. On garde le nom `ScriptPid` en surface pour compatibilité avec la story, mais l'implémentation stocke le `Child`.

**Note** : `tokio::process::Child` n'est pas `Send` de façon triviale dans certaines configurations — on utilisera donc `Arc<tokio::sync::Mutex<Option<tokio::process::Child>>>` (Mutex async de tokio, pas std).

### Events Tauri (Rust → Frontend)

#### `script-stdout`

```typescript
{ line: string }
```

Émis pour chaque ligne lue depuis stdout du processus enfant.

#### `script-done`

```typescript
{ exit_code: number; stderr: string }
```

Émis une seule fois quand le processus se termine (ou après kill).

### Types partagés

**Rust — ScriptPid state :**

```rust
use std::sync::Arc;
use tokio::sync::Mutex;

pub struct ScriptProcess(pub Arc<Mutex<Option<tokio::process::Child>>>);
```

**TypeScript — payloads événements (nouveaux) :**

```typescript
interface StdoutPayload {
  line: string;
}

interface DonePayload {
  exit_code: number;
  stderr: string;
}
```

### Props du composant ScriptExecutor

Inchangées (la prop `script: ScriptInfo | null` reste identique).

En interne, le composant gagne :
- `lines: string[]` — état pour les lignes accumulées
- `isDone: boolean` — pour afficher l'exit code final
- `exitCode: number | null`
- `stderrOutput: string`
- Bouton "Stop" conditionnel (`isRunning && !isDone`)

## Dépendances

### Crates Rust à ajouter

```toml
tokio = { version = "1", features = ["full"] }
```

Justification : Tauri 2 utilise tokio en interne mais ne le ré-exporte pas. Nécessaire pour `tokio::process::Command`, `tokio::sync::Mutex`, `tokio::io::BufReader`, `tokio::spawn`.

**Vérification** : `core/Cargo.toml` actuel ne contient pas `tokio` explicitement — à ajouter.

### Packages npm

Aucun ajout. `@tauri-apps/api/event` (déjà présent) fournit `listen`.

## Décisions architecturales (ADR)

### ADR-01 : commande async avec spawn tokio

- Contexte : `run_script_stream` doit retourner immédiatement au frontend pendant que le process tourne en arrière-plan.
- Options : (a) async Tauri command qui attend la fin, (b) async Tauri command qui spawn une tâche
- Décision : (b) — la commande spawne une tâche tokio et retourne `Ok(())`. La tâche gère le streaming et émet les événements.
- Conséquences : le frontend ne reçoit pas d'erreur de démarrage si le binaire est absent (l'erreur est emise via `script-done`). Acceptable car l'erreur est quand même visible.

### ADR-02 : stocker `Child` (tokio) dans le state, pas le PID u32

- Contexte : le kill doit être propre et cross-plateforme.
- Options : (a) stocker PID u32 + kill via SIGTERM/TerminateProcess, (b) stocker `tokio::process::Child` et appeler `.kill()`
- Décision : (b) — plus idiomatique tokio, pas de dépendance `nix`, cross-plateforme natif.
- Conséquences : le Mutex doit être `tokio::sync::Mutex` (async), le state est `Arc<Mutex<Option<Child>>>`.

### ADR-03 : unlisten dans cleanup useEffect

- Contexte : les listeners `script-stdout` et `script-done` doivent être nettoyés pour éviter les fuites mémoire entre les runs.
- Décision : les deux `listen()` sont dans un `useEffect` qui retourne un cleanup appelant `unlisten1()` et `unlisten2()`. Les unlisten sont stockés dans des refs pour être accessibles dans le cleanup.
- Conséquences : à chaque montage du composant (ou changement de script), les listeners sont re-enregistrés et l'ancien cleanup est appelé.

### ADR-04 : auto-scroll via ref sur le `<pre>`

- Contexte : l'auto-scroll doit se déclencher à chaque nouvelle ligne.
- Décision : `const outputRef = useRef<HTMLPreElement>(null)` — dans un `useEffect` déclenché par le changement de `lines`, appeler `outputRef.current.scrollTop = outputRef.current.scrollHeight`.
- Conséquences : comportement naturel, pas de lib externe.

### ADR-05 : reset de `lines` au démarrage de chaque run

- Contexte : la story exige que la zone output soit vidée à chaque nouvelle exécution.
- Décision : `setLines([])` appelé dans `handleRun` avant d'invoquer `run_script_stream`.
- Conséquences : si un run précédent n'est pas terminé, on vide quand même. L'utilisateur doit cliquer Stop d'abord pour interrompre proprement.

### ADR-06 : conserver `run_script` bloquant (pas de breaking change)

- Contexte : la story exige explicitement de conserver l'ancienne commande.
- Décision : `run_script` reste inchangé. `run_script_stream` est une addition.

## Edge cases à gérer

1. `kill_script` appelé sans process actif → retourner `Ok(())` sans panique (state `None`)
2. `kill_script` appelé pendant que `run_script_stream` démarre → la tâche peut recevoir un channel fermé, gérer proprement
3. Script qui produit une sortie non-UTF8 → utiliser `String::from_utf8_lossy` sur les lignes lues
4. Script qui ne termine jamais → le bouton Stop reste visible, kill fonctionne
5. `run_script_stream` appelé deux fois de suite → le deuxième run écrase le state Child. Le premier run continue d'émettre des événements jusqu'à sa fin naturelle (acceptable, la zone d'output est vidée côté frontend)
6. Listener `script-done` reçu après unmount du composant → le cleanup useEffect a déjà appelé unlisten, donc pas de mise à jour de state sur un composant démonté
7. Path inexistant → l'erreur de spawn est capturée et émise via `script-done` avec exit_code -1

## Contraintes de sécurité

- Le PID/Child provient uniquement du state interne Tauri — pas d'API de kill arbitraire par PID externe (conforme à la note de sécurité de la story)
- Le path est canonicalisé avant exécution (hérité de la logique `run_script`, à reproduire dans `run_script_stream`)
- Permissions Tauri : les événements Tauri (`emit`) ne nécessitent pas de permission supplémentaire côté capabilities
