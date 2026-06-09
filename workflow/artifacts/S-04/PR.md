# PR — S-04 : Tauri config + permissions

## Résumé

Cette PR finalise la configuration Tauri 2 de ScriptLauncher : elle corrige la CSP (`null` → valeur sécurisée sans `unsafe-eval`), déclare les permissions IPC minimales dans `capabilities/default.json` (principe du moindre privilège), et enregistre `tauri-plugin-dialog` en anticipation du sélecteur de dossier de S-05. Les commandes `list_scripts` et `run_script` (S-02/S-03) continuent de fonctionner sans permission plugin car elles passent par `std::fs`/`std::process::Command` directement. Seize tests automatisés de config ont été ajoutés, portant la suite totale à 58/58.

## Fichiers modifiés

| Fichier | Type | Description |
|---------|------|-------------|
| `core/tauri.conf.json` | Modifié | CSP définie (`default-src 'self' tauri: asset:; script-src 'self'; style-src 'self' 'unsafe-inline'`), métadonnées cohérentes |
| `core/capabilities/default.json` | Modifié | Permissions `["core:default", "dialog:allow-open"]`, cible fenêtre `main`, `$schema` relatif |
| `core/Cargo.toml` | Modifié | Ajout `tauri-plugin-dialog = "2"` (Modernizer : commentaire inline supprimé) |
| `core/Cargo.lock` | Modifié | Verrouillage de `tauri-plugin-dialog` v2.7.1 et ses dépendances transitives |
| `core/build.rs` | Modifié | Ajout du point-virgule manquant sur `tauri_build::build();` (fix clippy::pedantic) |
| `core/src/lib.rs` | Modifié | Enregistrement `.plugin(tauri_plugin_dialog::init())` + 16 tests de config dans `config_tests` |
| `core/gen/schemas/` | Modifié | Schémas ACL régénérés après ajout du plugin dialog |

## Critères d'acceptation — statut

| Critère | Adressé par | Statut |
|---------|-------------|--------|
| `capabilities/default.json` déclare `dialog:allow-open` | `capabilities/default.json:8` | PASS |
| `capabilities/default.json` inclut `core:default` (IPC de base) | `capabilities/default.json:7` | PASS |
| Aucune permission `fs:*` ni `shell:*` (moindre privilège) | `capabilities/default.json` + test CA-1c | PASS |
| `app.security.csp` défini (pas `null`) | `tauri.conf.json:21` | PASS |
| CSP sans `unsafe-eval` | `tauri.conf.json:21` + test CA-2h | PASS |
| `productName`, `identifier`, `version` cohérents | `tauri.conf.json:2-4` | PASS |
| `bundle.active = true` | `tauri.conf.json:26` | PASS |
| Icônes présentes dans `bundle.icon` | `tauri.conf.json:27-33` (5 entrées) | PASS |
| `beforeDevCommand` et `beforeBuildCommand` présents | `tauri.conf.json:8-9` | PASS |
| `tauri-plugin-dialog` enregistré dans `lib.rs` | `lib.rs:14` | PASS |
| `cargo check` passe sans warnings | Vérifié en session d'audit | PASS |
| Aucune permission superflue | exactement 2 permissions déclarées | PASS |

## Tests

| Suite | Tests | Résultat |
|-------|-------|---------|
| `config_tests` (Rust — nouveaux S-04) | 16 | PASS (58/58 total) |
| `file_system::tests` (Rust — baseline S-02) | 14 | PASS (aucune régression) |
| `script_runner::tests` (Rust — baseline S-03) | 28 | PASS (aucune régression) |

## Commandes de vérification

```bash
# Vérifier le code Rust
cd core && cargo check && cargo clippy -- -W clippy::pedantic

# Lancer tous les tests (58 attendus)
cd core && cargo test

# Mode dev (test visuel — requiert contexte graphique macOS)
npm run tauri dev

# Build prod
npm run tauri build
```

## Notes du reviewer

- **Validation manuelle `npm run tauri dev` recommandée avant merge** — les tests automatisés couvrent la config JSON et la compilation Rust, mais le comportement CSP en dev (hot-reload Vite HMR) et le démarrage WebView ne sont pas automatisables. Lancer `npm run tauri dev` depuis la racine du projet et vérifier qu'aucune erreur CSP n'apparaît dans la console DevTools de la WebView.
- **Fenêtre sans `label` explicite** — `app.windows[0]` ne déclare pas `"label": "main"`. Tauri 2 génère ce label automatiquement ; c'est fonctionnel mais une déclaration explicite serait plus robuste pour les stories futures (non bloquant).
- **`tauri-plugin-dialog` anticipé pour S-05** — le plugin est enregistré mais aucune commande dialog n'est exposée au frontend en S-04. L'interface UI (picker de dossier) sera implémentée dans S-05 (`FolderSelector.tsx`).

## Décision demandée

Merge cette PR ou retours correctifs ?

En attente de ta review. Aucune action sans ton accord.

PR GitHub : https://github.com/theoahga/ScriptLauncher/pull/13
