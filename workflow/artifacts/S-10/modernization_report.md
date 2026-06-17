# Rapport de modernisation — S-10

## Fichiers modifiés

- `core/src/script_runner.rs` — 2 changements
- `ui/components/ScriptExecutor.tsx` — 1 changement

## Changements

### script_runner.rs

**Changement 1** — imports ligne 30

- Règle : imports explicites pour les traits utilisés (éviter les appels FQCN)
- Avant : `use tokio::io::{AsyncBufReadExt, BufReader};` + appel `tokio::io::AsyncReadExt::read_to_string(&mut stderr_reader, ...)`
- Après : `use tokio::io::{AsyncBufReadExt, AsyncReadExt, BufReader};` + appel `stderr_reader.read_to_string(&mut stderr_buf).await`
- Impact comportemental : aucun — même trait, même méthode, syntaxe idiomatique tokio

**Changement 2** — ligne 330 (corps de la tâche tokio)

- Règle : méthode de trait appelée sur le receiver, pas en forme FQCN
- Avant : `let _ = tokio::io::AsyncReadExt::read_to_string(&mut stderr_reader, &mut stderr_buf).await;`
- Après : `let _ = stderr_reader.read_to_string(&mut stderr_buf).await;`
- Impact comportemental : aucun

### ScriptExecutor.tsx

**Changement 1** — useEffect listeners (lignes 57-89)

- Règle : les références aux callbacks de cleanup ne doivent pas capturer des variables locales `let` non encore assignées. Utiliser des refs React pour stocker les `unlisten` fonctions, accessibles depuis le handler et depuis le cleanup sans risque de capture stale.
- Avant : `let unlistenStdout / unlistenDone` déclarées localement, référencées dans le handler `script-done` avant d'être assignées (risque de fermeture stale)
- Après : `unlistenStdoutRef / unlistenDoneRef` via `useRef` — accessibles à tout moment depuis le handler et le cleanup
- Impact comportemental : aucun en pratique (le handler est appelé après l'assignation), mais le pattern est plus sûr et explicite sur l'intention

## Aucun changement appliqué à

- `core/src/lib.rs` — déjà idiomatique
- `core/Cargo.toml` — correct
