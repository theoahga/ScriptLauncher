# Tests de configuration — S-04 : Tauri config + permissions

> S-04 est une story de configuration pure (JSON + Cargo.toml).
> Les tests automatisables ciblent la structure statique des fichiers ; le comportement runtime
> (démarrage Tauri, rendu WebView, dialog natif) est hors scope des tests unitaires.

---

## Périmètre

| Fichier | Type de validation |
|---------|--------------------|
| `core/capabilities/default.json` | Parse JSON + assertions sur les champs |
| `core/tauri.conf.json` | Parse JSON + assertions sur les champs |
| `core/Cargo.toml` | `cargo check` (compilation) |
| `core/src/lib.rs` | `cargo check` + tests unitaires inline |

---

## Tests automatisables — `#[cfg(test)]` dans `core/src/lib.rs`

Les tests sont implémentés dans le module `config_tests` via `include_str!` + `serde_json`.
Ils ne font aucun accès FS au runtime et ne dépendent pas du CWD.

### Groupe CA-1 : `capabilities/default.json`

| ID | Nom du test | Critère d'acceptation couvert | Méthode |
|----|-------------|-------------------------------|---------|
| CA-1a | `test_capabilities_contains_dialog_allow_open` | `dialog:allow-open` présent dans `permissions[]` | Parse JSON + assert |
| CA-1b | `test_capabilities_contains_core_default` | `core:default` présent (base IPC) | Parse JSON + assert |
| CA-1c | `test_capabilities_no_fs_or_shell_permissions` | Aucune permission `fs:*` ni `shell:*` (moindre privilège) | Parse JSON + assert |
| CA-1d | `test_capabilities_targets_main_window` | `windows[]` contient `"main"` | Parse JSON + assert |
| CA-1e | `test_capabilities_exactly_two_permissions` | Exactement 2 permissions déclarées (périmètre minimal) | Parse JSON + assert sur la longueur |

### Groupe CA-2 : `tauri.conf.json`

| ID | Nom du test | Critère d'acceptation couvert | Méthode |
|----|-------------|-------------------------------|---------|
| CA-2a | `test_tauri_conf_product_name` | `productName = "ScriptLauncher"` | Parse JSON + assert |
| CA-2b | `test_tauri_conf_identifier` | `identifier = "dev.theoclere.scriptlauncher"` | Parse JSON + assert |
| CA-2c | `test_tauri_conf_version` | `version = "0.1.0"` | Parse JSON + assert |
| CA-2d | `test_tauri_conf_bundle_active` | `bundle.active = true` | Parse JSON + assert |
| CA-2e | `test_tauri_conf_bundle_icon_non_empty` | `bundle.icon` contient au moins une entrée (icônes présentes) | Parse JSON + assert |
| CA-2f | `test_tauri_conf_csp_defined` | `app.security.csp` n'est pas `null` | Parse JSON + assert non-null |
| CA-2g | `test_tauri_conf_csp_contains_required_directives` | CSP contient `tauri:`, `asset:`, `script-src`, `'self'` | Parse JSON + assert substring |
| CA-2h | `test_tauri_conf_csp_no_unsafe_eval` | CSP ne contient pas `'unsafe-eval'` (ADR-04) | Parse JSON + assert absence |
| CA-2i | `test_tauri_conf_before_dev_command_present` | `build.beforeDevCommand` présent et non vide | Parse JSON + assert |
| CA-2j | `test_tauri_conf_before_build_command_present` | `build.beforeBuildCommand` présent et non vide | Parse JSON + assert |

### Groupe CC : cohérence croisée

| ID | Nom du test | Description | Méthode |
|----|-------------|-------------|---------|
| CC-1 | `test_both_config_files_are_valid_json` | Les deux fichiers JSON sont valides et parseable | Parse JSON combiné |

**Total : 16 tests automatisés** (tous dans `config_tests` module de `core/src/lib.rs`)

---

## Validations manuelles / `cargo check`

Ces critères ne sont pas automatisables en test unitaire — ils nécessitent l'exécution du build system Tauri ou une action humaine.

### V-1 : `cargo check` — compilation Rust

**Commande :** `cd core && cargo check`

**Ce que ça valide :**
- `tauri-plugin-dialog = "2"` est résolu depuis crates.io
- `.plugin(tauri_plugin_dialog::init())` compile correctement
- Aucun warning Rust

**Statut :** Vérifié par le Dev (agent-bus.jsonl : "cargo check OK, tauri-plugin-dialog v2.7.1 résolu")

**Pourquoi non automatisable en test unitaire :** `tauri_plugin_dialog::init()` génère du code au moment du build Tauri ; le tester unitairement nécessiterait de mocker le contexte Tauri entier.

---

### V-2 : `dialog:allow-open` reconnu à la compilation Tauri

**Commande :** `npm run tauri build` ou `npm run tauri dev` (première compilation)

**Ce que ça valide :**
- `tauri-plugin-dialog` est enregistré dans `lib.rs` ET déclaré dans `capabilities/default.json`
- Tauri ne lève pas d'erreur `unknown permission 'dialog:allow-open'`

**Statut :** Confirmé par `cargo check` (le plugin est reconnu dès la compilation Rust).
Validation runtime à exécuter lors de `npm run tauri dev`.

**Pourquoi non automatisable en test unitaire :** La validation des permissions Tauri 2 se fait dans le build system Tauri (macro `generate_context!`), pas dans le code Rust pur.

---

### V-3 : `npm run tauri dev` — démarrage sans erreur visuel

**Commande :** `npm run tauri dev` depuis `/Users/theoclere/Development/ScriptLauncher/`

**Ce que ça valide :**
- `beforeDevCommand = "npm run dev"` lance Vite correctement depuis la racine du projet
- La WebView se charge sans erreur CSP dans la console DevTools
- Aucun script bloqué par `script-src 'self'` (pas de scripts inline injectés par React/Vite en conflit)
- Hot-reload Vite fonctionnel

**Gap identifié :** Si Vite HMR injecte des scripts avec hashes différents, la CSP peut bloquer le
hot-reload. Dans ce cas, ajouter temporairement `'unsafe-eval'` en dev uniquement (ADR-04, edge case).

**Pourquoi non automatisable :** Nécessite le rendu WebView (macOS + processus Tauri en cours).

---

### V-4 : icônes présentes dans `core/icons/`

**Commande :** `ls core/icons/` ou inspection manuelle.

**Ce que ça valide :**
- `icons/32x32.png`, `icons/128x128.png`, `icons/128x128@2x.png`, `icons/icon.icns`, `icons/icon.ico`
  sont présents (chemins référencés dans `bundle.icon`)

**Statut :** Confirmé (ls `core/icons/` — tous les fichiers sont présents).

**Note :** Ce check pourrait être automatisé via un test Rust utilisant `Path::exists()`, mais les
chemins sont relatifs au répertoire `core/` (CWD du build) et non au répertoire d'exécution des tests.
Un tel test serait fragile et dépendant de l'environnement CI. Laissé en validation manuelle.

---

### V-5 : dialog runtime — sélecteur de dossier (scope S-05)

**Validation :** Hors scope S-04. La validation que `dialog:allow-open` fonctionne réellement depuis
le frontend (invoke `dialog.open()`) est dans le périmètre de S-05 (FolderSelector.tsx).

---

## Récapitulatif des gaps

| Gap | Raison | Stratégie |
|-----|--------|-----------|
| Comportement CSP en dev (HMR Vite) | Nécessite WebView runtime | Validation manuelle `npm run tauri dev` |
| `dialog:allow-open` reconnu par Tauri | Macro Tauri au build | `cargo check` + `npm run tauri dev` |
| Icônes présentes sur disque | CWD-dépendant en test | `ls core/icons/` manuel |
| Dialog runtime S-05 | Hors scope S-04 | Testé en S-05 |
| `beforeDevCommand` depuis racine | Dépend du contexte d'exécution | Validation manuelle |
