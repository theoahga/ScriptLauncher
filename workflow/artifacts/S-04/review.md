# Audit — S-04 : Tauri config + permissions

## Checklist qualité

### Code Rust

- [x] Aucun `.unwrap()` non justifié — `lib.rs` utilise `.expect()` avec message explicite sur `.run()`, seul usage justifié (panic intentionnel si Tauri ne peut pas démarrer)
- [x] Tous les Result sont gérés — pas de nouveaux `Result` introduits en S-04 (les commandes S-02/S-03 inchangées)
- [x] Pas de chemins absolus hardcodés — `include_str!` utilise des chemins relatifs au fichier source (`../tauri.conf.json`, `../capabilities/default.json`)
- [x] `cargo check` passe sans warnings — vérifié : `cargo check` = 0 warning, `cargo clippy -- -W clippy::pedantic` = 0 warning (après fix `build.rs` par Modernizer)
- [x] Permissions Tauri au minimum nécessaire — `["core:default", "dialog:allow-open"]`, aucune permission `fs:*` ou `shell:*`

### Code TypeScript

- [x] N/A — S-04 est une story de config pure, aucun TypeScript modifié

### Tests

- [x] Cas nominaux couverts — 16 tests couvrant `dialog:allow-open`, `core:default`, CSP, `productName`, `identifier`, `version`, `bundle.active`, `bundle.icon`, `beforeDevCommand`, `beforeBuildCommand`, fenêtre `main`
- [x] Edge cases de `arch_plan.md` couverts — CSP sans `unsafe-eval` (CA-2h), aucune permission `fs:`/`shell:` (CA-1c), exactement 2 permissions (CA-1e)
- [x] Mocks Tauri correctement configurés — N/A (tests de config statique via `include_str!`, pas d'invocations runtime)
- [x] Pas de tests qui passent pour de mauvaises raisons — assertions précises avec messages d'erreur descriptifs, `assert_eq!` sur les valeurs exactes

### Story

- [x] Tous les critères d'acceptation sont adressés par le code (voir tableau détaillé ci-dessous)
- [x] Rien hors du périmètre Out of scope n'a été implémenté — pas de plugin `fs`, pas de plugin `shell`, pas d'UI, pas de commandes dialog exposées au frontend

---

## Vérification des critères d'acceptation

| Critère | Fichier | Statut |
|---------|---------|--------|
| `capabilities/default.json` déclare `dialog:allow-open` | `core/capabilities/default.json:8` | PASS |
| `capabilities/default.json` déclare les permissions IPC de base | `core/capabilities/default.json:7` (`core:default`) | PASS |
| `app.security.csp` défini (pas `null`) | `core/tauri.conf.json:21` | PASS |
| `productName`, `identifier`, `version` cohérents | `core/tauri.conf.json:2-4` | PASS |
| `bundle.active = true` | `core/tauri.conf.json:26` | PASS |
| Icônes présentes dans `bundle.icon` | `core/tauri.conf.json:27-33` (5 entrées) + `core/icons/` contient tous les fichiers référencés | PASS |
| `beforeDevCommand` et `beforeBuildCommand` corrects | `core/tauri.conf.json:8-9` (`"npm run dev"` / `"npm run build"`) | PASS |
| `cargo check` passe sans warnings | Vérifié en session | PASS |
| `tauri-plugin-dialog` enregistré dans `lib.rs` | `core/src/lib.rs:14` (`.plugin(tauri_plugin_dialog::init())`) | PASS |
| Aucune permission superflue | `capabilities/default.json` — exactement 2 permissions | PASS |

---

## Vérifications spécifiques demandées

| Point d'attention | Résultat |
|-------------------|----------|
| `cargo test` 58/58 | PASS — confirmé en session : `test result: ok. 58 passed; 0 failed; 0 ignored` |
| `tauri-plugin-dialog` enregistré avec `.plugin(tauri_plugin_dialog::init())` | PASS — `core/src/lib.rs:14` |
| `capabilities/default.json` contient exactement `["core:default", "dialog:allow-open"]` | PASS — exactement 2 permissions, dans cet ordre |
| CSP non null et sans `unsafe-eval` | PASS — CSP = `"default-src 'self' tauri: asset:; script-src 'self'; style-src 'self' 'unsafe-inline'"` |
| `build.rs` a le point-virgule (correction Modernizer) | PASS — `core/build.rs:2` : `tauri_build::build();` |
| Principe du moindre privilège : pas de `fs:*` ni `shell:*` superflus | PASS — test automatisé `test_capabilities_no_fs_or_shell_permissions` |

---

## Problèmes détectés

### Bloquants (empêchent le merge)

Aucun.

### Non bloquants (à corriger dans une story ultérieure)

1. **`core/src/lib.rs` — tests config_tests non liés au code applicatif** — Les 16 tests de S-04 testent les fichiers de config JSON (via `include_str!`), ce qui est une bonne pratique. En revanche, les tests sont déclarés directement dans `lib.rs`, le fichier de point d'entrée. Pour les stories futures, envisager de déplacer ces tests dans un module dédié (`src/config_tests.rs`) via `#[cfg(test)] mod config_tests;` pour maintenir la lisibilité de `lib.rs`. Impact S-04 : nul (fonctionnel, 58/58).

2. **`tauri.conf.json` — fenêtre sans `label`** — `app.windows[0]` ne déclare pas de champ `label`. Tauri 2 génère automatiquement le label `main` pour la première fenêtre, ce qui est cohérent avec `capabilities/default.json` qui cible `"main"`. C'est fonctionnel, mais une déclaration explicite `"label": "main"` serait plus robuste si une seconde fenêtre est ajoutée dans une story future (S-07/S-08).

3. **Validation manuelle non effectuée** — `npm run tauri dev` n'a pas pu être validé dans cette session d'audit (nécessite un contexte graphique macOS). Le test_report.md documente ce gap comme non automatisable. Ce point est acceptable pour le merge en tant que réserve.

### Observations (informatif)

1. **ADR-03 (beforeDevCommand)** — La décision de conserver `"npm run dev"` sans le rendre relatif à la racine est documentée et correcte au regard du bug mémoire projet. La commande sera lancée depuis la racine car le script `tauri` dans `package.json` fait `cd core && tauri` ; Tauri CLI exécute `beforeDevCommand` depuis le CWD de l'appelant.

2. **Modernizer — commentaire inline Cargo.toml** — La suppression du commentaire `# ajout S-04 — anticipation S-05 (ADR-01)` est conforme aux conventions Rust. La traçabilité est bien portée par Git et `arch_plan.md`.

3. **Tests `include_str!`** — L'approche `include_str!` pour tester les fichiers de config est élégante : les fichiers sont intégrés au binaire de test à la compilation, ce qui garantit que les tests reflètent toujours l'état actuel des fichiers et ne dépendent pas du CWD à l'exécution.

4. **`core:default` périmètre large** — Comme documenté en ADR-06, `core:default` inclut des permissions comme `core:tray:default` et `core:menu:default` qui ne sont pas utilisées. C'est acceptable pour une app desktop standard ; le principe du moindre privilège s'applique d'abord aux plugins tiers (fs, shell) plutôt qu'aux groupes de permissions `core`.

---

## Verdict

**APPROUVE**

Justification : Tous les critères d'acceptation sont satisfaits, `cargo test` 58/58 est confirmé en session, la CSP est correctement définie sans `unsafe-eval`, les permissions respectent strictement le principe du moindre privilège (`["core:default", "dialog:allow-open"]` uniquement), et `tauri-plugin-dialog` est correctement enregistré dans `lib.rs`. Les réserves (fenêtre sans `label` explicite, tests dans `lib.rs`, validation manuelle dev) sont mineures et n'empêchent pas le merge.
