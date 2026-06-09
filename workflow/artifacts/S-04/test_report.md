# Rapport de tests — S-04

## Couverture

| Fichier / Artefact | Tests | Cas nominaux | Edge cases | Erreurs |
|--------------------|-------|-------------|------------|---------|
| `capabilities/default.json` | 5 | ✅ (dialog:allow-open, core:default) | ✅ (moindre privilège : no fs:/shell:) | ✅ (périmètre exact : 2 perms) |
| `tauri.conf.json` | 10 | ✅ (productName, identifier, version, bundle.active, CSP définie) | ✅ (directives CSP exactes, no unsafe-eval) | ✅ (csp non-null, icon non-vide) |
| Cohérence croisée | 1 | ✅ (deux fichiers JSON valides) | — | — |
| `core/Cargo.toml` | cargo check | ✅ (tauri-plugin-dialog="2" résolu) | — | — |
| `core/src/lib.rs` | cargo check | ✅ (.plugin(tauri_plugin_dialog::init())) | — | — |

**Total tests automatisés :** 16 (module `config_tests` dans `core/src/lib.rs`)
**Tests existants préservés :** 42 (file_system + script_runner)
**Total suite :** 58/58 ✅

---

## Critères d'acceptation → couverture

| Critère d'acceptation (story.md) | Test(s) correspondant(s) | Statut |
|----------------------------------|--------------------------|--------|
| `capabilities/default.json` déclare `dialog:allow-open` | `test_capabilities_contains_dialog_allow_open` | ✅ automatisé |
| `capabilities/default.json` déclare `core:default` (IPC base) | `test_capabilities_contains_core_default` | ✅ automatisé |
| Aucune permission `fs:*` ni `shell:*` (moindre privilège) | `test_capabilities_no_fs_or_shell_permissions` | ✅ automatisé |
| `app.security.csp` défini (pas `null`) | `test_tauri_conf_csp_defined` | ✅ automatisé |
| CSP contient directives Tauri-compatibles (`tauri:`, `asset:`, `script-src 'self'`) | `test_tauri_conf_csp_contains_required_directives` | ✅ automatisé |
| CSP sans `'unsafe-eval'` (ADR-04) | `test_tauri_conf_csp_no_unsafe_eval` | ✅ automatisé |
| `productName`, `identifier`, `version` cohérents | `test_tauri_conf_product_name`, `test_tauri_conf_identifier`, `test_tauri_conf_version` | ✅ automatisé |
| `bundle.active = true` | `test_tauri_conf_bundle_active` | ✅ automatisé |
| Icônes présentes dans `bundle.icon` | `test_tauri_conf_bundle_icon_non_empty` | ✅ (structure) / ⚠️ présence disque = manuel |
| `build.beforeDevCommand` et `build.beforeBuildCommand` corrects | `test_tauri_conf_before_dev_command_present`, `test_tauri_conf_before_build_command_present` | ✅ (présence) / ⚠️ comportement = manuel |
| `cargo check` passe sans warnings | cargo check (V-1) | ✅ validé par Dev (agent-bus) |
| `npm run tauri dev` compile et lance sans erreur | Validation manuelle (V-3) | ⚠️ non automatisé — voir gaps |
| `tauri-plugin-dialog` enregistré dans `lib.rs` | cargo check + `test_both_config_files_are_valid_json` | ✅ cargo check / ⚠️ runtime = manuel |
| Fenêtre cible = "main" | `test_capabilities_targets_main_window` | ✅ automatisé |

---

## Edge cases de `arch_plan.md` → couverture

| Edge case | Test correspondant | Statut |
|-----------|--------------------|--------|
| Plugin dialog non trouvé à la compilation (réseau absent) | — | ⚠️ non automatisable (dépend de crates.io) |
| CSP trop restrictive bloquant Vite HMR | `test_tauri_conf_csp_no_unsafe_eval` (vérifie l'absence de unsafe-eval intentionnelle) | ✅ test statique / ⚠️ comportement HMR = manuel |
| `dialog:allow-open` non reconnu sans `tauri-plugin-dialog` | cargo check (cohérence plugin + capabilities) | ✅ validé par cargo check |
| Icônes manquantes dans `core/icons/` | `test_tauri_conf_bundle_icon_non_empty` (structure JSON) | ✅ structure / ⚠️ existence fichiers = manuel |

---

## Cas non couverts et justification

| Cas | Justification | Stratégie recommandée |
|-----|---------------|-----------------------|
| `npm run tauri dev` visuel (démarrage app, WebView) | Nécessite processus Tauri + WebView macOS — impossible en test unitaire Rust | Validation manuelle avant merge PR |
| Dialog runtime (`dialog.open()` depuis le frontend) | Hors scope S-04 (scope S-05 FolderSelector.tsx) | Couvert dans les tests de S-05 |
| Comportement CSP avec HMR Vite en dev | Nécessite navigateur/WebView en cours d'exécution | Validation manuelle `npm run tauri dev` + DevTools console |
| Présence physique des icônes sur disque | `Path::exists()` serait CWD-dépendant dans les tests — fragile en CI | `ls core/icons/` à la revue PR |
| `beforeDevCommand` exécuté depuis la racine | Dépend du contexte shell d'appel (ADR-03) — non simulable sans fork de processus | Documenté dans ADR-03, validation manuelle |
| Résolution crates.io (`tauri-plugin-dialog`) | Dépend de la connectivité réseau — non simulable | Documenté comme précondition (connexion réseau requise) |

---

## Résultat de la suite complète

```
test result: ok. 58 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out
```

- Baseline avant S-04 : 42 tests (file_system + script_runner)
- Ajoutés par S-04 : 16 tests (module `config_tests` dans `core/src/lib.rs`)
- Régressions introduites : 0
