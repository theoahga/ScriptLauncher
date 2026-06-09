# Story S-04 — Tauri config + permissions

**ID :** S-04  
**Titre :** Tauri config + permissions  
**Dépend de :** S-02 (list_scripts), S-03 (run_script)  
**Branche :** story/S-04

## Description

En tant que développeur,
je veux configurer correctement `tauri.conf.json` et le système de capabilities Tauri 2,
afin que les commandes `list_scripts` et `run_script` fonctionnent en prod avec les permissions minimales nécessaires.

## Critères d'acceptation

- `core/capabilities/default.json` déclare les permissions nécessaires pour :
  - Accès filesystem en lecture (`fs:read-all` ou équivalent Tauri 2) pour `list_scripts`
  - Exécution de processus (`shell:execute` ou équivalent Tauri 2) pour `run_script`
  - Dialogue de sélection de dossier (`dialog:open`) pour S-05 (anticipé ici)
- `core/tauri.conf.json` est configuré correctement :
  - `productName`, `identifier`, `version` cohérents
  - `bundle.active = true`, icônes présentes
  - `app.security.csp` défini (pas `null`)
  - `build.beforeDevCommand` et `build.beforeBuildCommand` corrects pour la structure du projet (depuis la racine)
- `npm run tauri dev` continue de compiler et de lancer l'app sans erreur après les changements
- `cargo check` passe sans warnings
- Aucune permission superflue (principe du moindre privilège)

## Out of scope

- Aucune UI dans cette story (S-05 à S-07)
- Pas d'implémentation de dialog dans le Rust (S-05)
- Pas de plugin `tauri-plugin-shell` si non requis par run_script (std::process::Command n'en a pas besoin)
- Pas de permissions réseau

## Contexte technique

Structure actuelle :
```
core/
├── capabilities/
│   └── default.json          # {"permissions": ["core:default"]} — à enrichir
├── tauri.conf.json            # config de base — app.security.csp = null
├── src/
│   ├── lib.rs                 # invoke_handler: [list_scripts, run_script]
│   ├── file_system.rs         # list_scripts — std::fs (pas de plugin fs)
│   └── script_runner.rs       # run_script — std::process::Command (pas de plugin shell)
└── Cargo.toml                 # dépendances: tauri 2, serde, serde_json
```

**Note importante :** `list_scripts` et `run_script` utilisent `std::fs` et `std::process::Command` directement — ils ne passent pas par les plugins Tauri `fs` ou `shell`. Les permissions requises concernent uniquement ce que le **frontend** peut faire via l'IPC Tauri (appeler les commandes custom, ouvrir un dialog, etc.).

Les plugins à évaluer :
- `tauri-plugin-dialog` : pour le sélecteur de dossier de S-05
- `tauri-plugin-fs` : à évaluer si nécessaire
- `tauri-plugin-shell` : à évaluer (probablement non requis)
