# PR — S-10 : Streaming stdout temps-réel + bouton Stop

## Résumé

Cette PR ajoute le streaming en temps réel de la sortie standard des scripts dans ScriptLauncher. Une nouvelle commande Tauri `run_script_stream` exécute les scripts de façon non-bloquante et émet les lignes stdout via des événements Tauri, tandis que `kill_script` permet d'interrompre l'exécution. Le composant `ScriptExecutor` est mis à jour pour afficher les lignes au fur et à mesure avec auto-scroll et un bouton Stop.

## Fichiers modifiés

| Fichier | Type | Description |
|---------|------|-------------|
| `core/src/script_runner.rs` | Modifié | Ajout run_script_stream, kill_script, ScriptProcess state, payloads StdoutPayload/DonePayload |
| `core/src/lib.rs` | Modifié | Enregistrement des nouvelles commandes + manage(ScriptProcess) |
| `core/Cargo.toml` | Modifié | Ajout tokio = { version = "1", features = ["full"] } |
| `ui/components/ScriptExecutor.tsx` | Modifié | Streaming via listen, bouton Stop, auto-scroll via ref, zone vidée au run |
| `ui/components/ScriptExecutor.test.tsx` | Modifié | Réécriture complète — 10 cas Vitest pour l'interface streaming |

## Critères d'acceptation — statut

| Critère | Adressé par | Statut |
|---------|-------------|--------|
| run_script_stream spawn non-bloquant | script_runner.rs:257 | ✅ |
| stdout ligne par ligne → script-stdout | script_runner.rs:324 | ✅ |
| script-done avec exit_code et stderr | script_runner.rs:352 | ✅ |
| PID/Child stocké dans state Arc<Mutex<Option<Child>>> | script_runner.rs:232 | ✅ |
| kill_script → kill() + None | script_runner.rs:370 | ✅ |
| kill_script sans process actif → Ok(()) | script_runner.rs TC-S10-01 | ✅ |
| run_script bloquant conservé | script_runner.rs:168 | ✅ |
| listen('script-stdout') avec cleanup | ScriptExecutor.tsx:57-89 | ✅ |
| Auto-scroll via ref | ScriptExecutor.tsx:51-55 | ✅ |
| Bouton Stop visible pendant run | ScriptExecutor.tsx:143-151 | ✅ |
| Zone output vidée au nouveau run | ScriptExecutor.tsx:96-100 | ✅ |
| cargo check OK | CI | ✅ |
| tsc --noEmit OK | CI | ✅ |
| npm run test (36 tests) | CI | ✅ |
| cargo test (60 tests) | CI | ✅ |

## Tests

| Suite | Tests | Résultat |
|-------|-------|---------|
| ScriptExecutor.test.tsx | 10 (nouveaux S-10) | ✅ Pass |
| Autres suites frontend | 26 (existants) | ✅ Pass |
| script_runner.rs (S-10) | 2 (kill_script) | ✅ Pass |
| script_runner.rs (existants) | 58 | ✅ Pass |

## Commandes de vérification

```bash
# Vérifier le code Rust
cd core && cargo check && cargo clippy

# Vérifier les types TypeScript
npx tsc --noEmit

# Lancer les tests Rust
cd core && cargo test

# Lancer les tests frontend
npm run test

# Mode dev (test visuel)
npm run tauri dev
```

## Notes du reviewer

- L'interaction branche story/S-09 (config.rs) a nécessité une correction dans lib.rs pour supprimer la référence au module `config` absent sur story/S-10. Cette correction est normale et ne pose pas de problème fonctionnel.
- La commande `run_script_stream` pour les fichiers `.ts` n'a pas le fallback `npx ts-node` (contrairement à `run_script`). À améliorer dans une story ultérieure si nécessaire.

## Décision demandée

Merge cette PR (base: story/S-08) ou retours correctifs ?

⏸️ En attente de ta review. Aucune action sans ton accord.

PR GitHub : https://github.com/theoahga/ScriptLauncher/pull/18
