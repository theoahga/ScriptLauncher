# Plan technique — S-04 : Tauri config + permissions

## Compréhension de la story

Il s'agit de compléter la configuration `tauri.conf.json` et le fichier `capabilities/default.json`
pour que l'application soit correctement sécurisée en dev et en prod : CSP défini, permissions IPC
minimales déclarées (custom commands + anticipation dialog pour S-05), et `beforeDevCommand`
corrigé pour la structure multi-répertoire du projet.

---

## Périmètre technique

- Fichiers Rust à créer/modifier : aucun (S-02 et S-03 sont complets)
- Fichiers TypeScript à créer/modifier : aucun (scope S-05 à S-07)
- Fichiers de config à modifier :
  - `core/tauri.conf.json`
  - `core/capabilities/default.json`
  - `core/Cargo.toml` (ajout de `tauri-plugin-dialog` en dépendance)
  - `core/src/lib.rs` (enregistrement du plugin `tauri-plugin-dialog`)

---

## Interfaces et contrats

### Commandes Tauri (Rust → Frontend)

Cette story ne crée ni ne modifie de commandes. Les commandes `list_scripts` et `run_script`
définies en S-02/S-03 sont déjà enregistrées dans l'`invoke_handler` de `lib.rs`.

**Rappel des signatures existantes (immuables dans S-04) :**

```
list_scripts(folder: String) -> Result<Vec<ScriptInfo>, String>
run_script(path: String) -> Result<ScriptOutput, String>
```

Ces commandes n'utilisent pas de plugin Tauri (`fs`, `shell`) — elles passent directement par
`std::fs` et `std::process::Command`. Elles n'ont donc **aucun besoin de permission plugin** dans
`capabilities/default.json`. Ce qui doit y figurer : la permission IPC pour les appeler depuis le
frontend, plus les permissions des plugins enregistrés.

### Events Tauri

Aucun event dans S-04.

### Types partagés

Aucun type nouveau dans S-04.

### Props des composants React

Hors scope S-04.

---

## Dépendances

### Crates Rust à ajouter

```toml
tauri-plugin-dialog = "2"
```

**Justification (ADR-01) :** `tauri-plugin-dialog` doit être ajouté dès S-04, non pas parce que le
dialog est utilisé en S-04, mais parce que sa déclaration dans `capabilities/default.json`
(`dialog:allow-open`) ne sera reconnue par Tauri que si le plugin est enregistré côté Rust. Ajouter
la permission dans les capabilities sans le plugin déclencherait une erreur de compilation Tauri
(`unknown permission`). L'enregistrement du plugin dans `lib.rs` est donc aussi dans le périmètre
de cette story.

### Packages npm à ajouter

Aucun.

---

## Décisions architecturales (ADR)

### ADR-01 : Inclure `tauri-plugin-dialog` dès S-04

- **Contexte :** La story demande d'anticiper la permission `dialog:allow-open` pour S-05.
  Tauri 2 valide les permissions déclarées dans les capabilities contre les plugins effectivement
  enregistrés dans l'application. Si `dialog:allow-open` est déclaré mais que le plugin n'est pas
  enregistré, `cargo check` et `npm run tauri dev` échouent avec une erreur de permission inconnue.
- **Options considérées :**
  1. Déclarer seulement la permission dans `capabilities/default.json` sans ajouter le plugin
     (risque d'erreur de build).
  2. Ajouter le plugin en Cargo.toml + enregistrement dans `lib.rs` + déclaration dans les
     capabilities (cohérent, conforme aux critères d'acceptation).
  3. Ne pas anticiper du tout et laisser S-05 le faire intégralement (contredit la story).
- **Décision retenue :** Option 2. Le plugin est ajouté maintenant, son interface UI (picker de
  dossier) sera utilisée en S-05.
- **Conséquences :** `lib.rs` doit appeler `.plugin(tauri_plugin_dialog::init())` dans
  `tauri::Builder`. Pas de commande Rust exposée au frontend pour le dialog en S-04.

---

### ADR-02 : Permissions IPC pour `list_scripts` et `run_script`

- **Contexte :** Ces commandes sont des commandes custom (non issues d'un plugin). Dans Tauri 2,
  une commande custom n'a pas besoin d'une permission plugin — elle est accessible via l'IPC dès
  qu'elle est dans l'`invoke_handler`. La question est : faut-il déclarer une permission explicite ?
- **Options considérées :**
  1. Ne rien ajouter pour les commandes custom — `core:default` couvre déjà l'accès IPC de base.
  2. Ajouter des permissions custom nommées `allow-list-scripts` / `allow-run-script` via des
     fichiers `.toml` de permissions dans `capabilities/` (pattern avancé Tauri 2).
- **Décision retenue :** Option 1. Les commandes custom déclarées dans `invoke_handler` sont
  accessibles depuis le frontend sans déclaration de permission supplémentaire dans les capabilities.
  `core:default` couvre l'IPC de base (événements, fenêtres, app info). L'ajout de permissions
  custom nommées est pertinent uniquement quand on veut contrôler l'accès par fenêtre ou webview
  différenciée — ce n'est pas le cas ici (une seule fenêtre `main`).
- **Conséquences :** `capabilities/default.json` n'a pas besoin de `allow-list-scripts` ni
  `allow-run-script`. Périmètre minimal.

---

### ADR-03 : `beforeDevCommand` — chemin relatif depuis la racine du projet

- **Contexte :** La mémoire projet (MEMORY.md) documente explicitement le bug :
  > "Tauri beforeDevCommand runs from project root — not from the config dir; write paths relative
  > to project root"
  La structure du projet est :
  ```
  /Users/theoclere/Development/ScriptLauncher/   ← racine, contient package.json
  └── core/                                       ← répertoire Tauri (tauri.conf.json)
  ```
  Le script npm `tauri` est défini comme `cd core && tauri`, donc `tauri dev` est lancé depuis
  `core/`. Mais `beforeDevCommand` est exécuté avec le CWD de la racine du projet, pas de `core/`.
  Actuellement : `"beforeDevCommand": "npm run dev"` — ce command lance Vite depuis `core/`, ce
  qui échoue car `vite.config.ts` et `package.json` sont à la racine.
- **Options considérées :**
  1. Garder `"npm run dev"` — fonctionne si Tauri CLI est lancé depuis la racine (mais risque de
     confusion selon la version et le contexte).
  2. Utiliser `"npm run dev --prefix /Users/theoclere/Development/ScriptLauncher"` — chemin
     absolu, non portable.
  3. Utiliser `"npm run dev"` avec l'option `devPath` / `frontendDist` configurés correctement
     et laisser le CLI résoudre depuis la racine.
  4. Fixer explicitement le CWD dans la commande : le script `tauri` dans `package.json` fait
     `cd core && tauri`, donc la résolution du CWD de `beforeDevCommand` par Tauri CLI 2 est la
     racine du workspace (là où est `package.json` principal). Vérifier si `"npm run dev"` depuis
     la racine fonctionne déjà.
- **Décision retenue :** Conserver `"beforeDevCommand": "npm run dev"` et
  `"beforeBuildCommand": "npm run build"` — ces commandes réfèrent aux scripts du `package.json`
  racine, qui est le CWD lors de l'exécution de `npm run tauri dev` (l'utilisateur lance depuis la
  racine). Le CLI Tauri exécute `beforeDevCommand` depuis le CWD de l'appelant (racine), et `npm
  run dev` y est défini. Aucun changement nécessaire sur ces champs si l'utilisateur lance depuis
  la racine. Si un problème se présente à l'exécution, le Dev doit tester et vérifier.
- **Conséquences :** Pas de modification de `build.beforeDevCommand`. Le Dev doit s'assurer de
  lancer `npm run tauri dev` depuis `/Users/theoclere/Development/ScriptLauncher/`, pas depuis
  `core/`.

---

### ADR-04 : CSP — valeur minimale sécurisée pour une app Tauri locale

- **Contexte :** `app.security.csp = null` désactive totalement la CSP. C'est inacceptable en
  production. L'app est une app desktop locale : pas de ressources réseau, pas d'iframe, pas de
  scripts inline. Tauri 2 sert le frontend via son protocole interne `tauri://localhost`.
- **Options considérées :**
  1. `null` — désactivé (état actuel, non acceptable).
  2. CSP permissive : `"default-src 'self'"` — bloque tout ce qui n'est pas same-origin.
  3. CSP stricte Tauri-compatible :
     ```
     "default-src 'self' tauri: asset:; script-src 'self'; style-src 'self' 'unsafe-inline'"
     ```
     Nécessaire car Vite injecte des styles inline en dev.
  4. Variante sans `unsafe-inline` pour les styles — nécessiterait des nonces ou des hash CSS.
- **Décision retenue :** Option 3. Valeur CSP :
  ```
  "default-src 'self' tauri: asset:; script-src 'self'; style-src 'self' 'unsafe-inline'"
  ```
  - `tauri:` et `asset:` : schémas utilisés par Tauri 2 pour servir les assets locaux.
  - `'unsafe-inline'` sur `style-src` uniquement : Vite en dev injecte des styles inline ; React
    et les bibliothèques CSS font de même. Acceptable car l'app ne charge aucun contenu externe.
  - `script-src 'self'` : aucun script inline, aucun CDN.
  - Aucun `connect-src`, `img-src` réseau : app 100% locale.
- **Conséquences :** La CSP sera appliquée dès le dev. Si une bibliothèque future utilise des
  scripts inline, il faudra réviser. Pas d'impact sur les commandes Rust.

---

### ADR-05 : `tauri-plugin-fs` et `tauri-plugin-shell` — non requis en S-04

- **Contexte :** `list_scripts` utilise `std::fs` (Rust pur), `run_script` utilise
  `std::process::Command` (Rust pur). Aucun de ces deux ne passe par les plugins Tauri.
- **Décision retenue :** Ne pas ajouter `tauri-plugin-fs` ni `tauri-plugin-shell`. Ils ne sont
  pas nécessaires maintenant, et les ajouter sans usage violerait le principe du moindre privilège.
  Si une story future en a besoin (ex : accès FS depuis le frontend TypeScript, ou `open` d'URL),
  ils seront ajoutés à ce moment.
- **Conséquences :** `capabilities/default.json` ne contient pas `fs:*` ni `shell:*`.

---

### ADR-06 : Contenu de `core:default` — périmètre déjà couvert

- **Contexte :** `core:default` inclut (cf. `gen/schemas/desktop-schema.json`, ligne 180) :
  - `core:path:default` — utilitaires de chemin côté JS
  - `core:event:default` — emit, listen, unlisten
  - `core:window:default` — gestion fenêtre (titre, taille, focus, etc.)
  - `core:webview:default` — gestion webview
  - `core:app:default` — version, name, identifier, register/remove listener
  - `core:image:default` — from-bytes, from-path, new, rgba, size
  - `core:resources:default` — close resources
  - `core:menu:default` — gestion menus natifs
  - `core:tray:default` — tray icon
  Ces permissions couvrent largement les besoins IPC de base de l'app. Aucune des ces permissions
  n'est superflue pour une app desktop standard.
- **Décision retenue :** Conserver `core:default` comme base. Ne rien retirer. Ajouter uniquement
  `dialog:allow-open` pour anticiper S-05.

---

## Contrat de modification pour le Dev

### `core/Cargo.toml` — ajout de dépendance

```toml
[dependencies]
tauri = { version = "2", features = [] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tauri-plugin-dialog = "2"    # ajout S-04 — anticipation S-05 (ADR-01)
```

### `core/src/lib.rs` — enregistrement du plugin

Le `tauri::Builder` doit enchaîner `.plugin(tauri_plugin_dialog::init())` avant `.invoke_handler`.
Ordre conseillé : plugins d'abord, invoke_handler ensuite.

Signature de la fonction `run()` : inchangée.

### `core/tauri.conf.json` — modifications

| Champ | Valeur actuelle | Valeur cible |
|-------|----------------|--------------|
| `app.security.csp` | `null` | `"default-src 'self' tauri: asset:; script-src 'self'; style-src 'self' 'unsafe-inline'"` |
| `build.beforeDevCommand` | `"npm run dev"` | inchangé (ADR-03) |
| `build.beforeBuildCommand` | `"npm run build"` | inchangé (ADR-03) |
| `productName` | `"ScriptLauncher"` | inchangé (cohérent) |
| `identifier` | `"dev.theoclere.scriptlauncher"` | inchangé (cohérent) |
| `version` | `"0.1.0"` | inchangé |
| `bundle.active` | `true` | inchangé |
| `bundle.icon` | (liste existante) | inchangé (icônes présentes dans `icons/`) |

Champs à ne pas modifier : `app.windows` (titre, dimensions), `bundle.targets`.

### `core/capabilities/default.json` — résultat attendu

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Capability for the main window — liste et exécution de scripts, sélecteur de dossier (S-05)",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "dialog:allow-open"
  ]
}
```

**Justification du choix `dialog:allow-open` :**
- `dialog:open` (sans préfixe `allow-`) est le raccourci documenté dans les exemples Tauri, mais
  la convention Tauri 2 pour les plugins tiers utilise `<plugin>:allow-<command>`. Le nom correct
  est `dialog:allow-open`.
- Aucune permission `fs:*`, `shell:*` — non nécessaire (ADR-05).

---

## Edge cases à gérer

- **Plugin dialog non trouvé à la compilation :** Si `tauri-plugin-dialog = "2"` n'est pas
  disponible dans le registre crates.io (réseau absent), `cargo check` échouera. Le Dev doit
  s'assurer d'une connexion réseau lors de la première compilation.
- **CSP trop restrictive en dev :** Si Vite HMR injecte des scripts avec des hashes différents,
  la CSP `script-src 'self'` pourrait bloquer le hot-reload. Si cela se produit, le Dev peut
  temporairement ajouter `'unsafe-eval'` en dev uniquement via la variable d'env
  `TAURI_ENV_DEBUG`. Ce cas doit être testé lors du `npm run tauri dev`.
- **`dialog:allow-open` non reconnu sans `tauri-plugin-dialog` :** Si le plugin n'est pas
  enregistré dans `lib.rs`, Tauri émettra une erreur à la compilation sur la permission inconnue.
  Le Dev doit vérifier que l'enregistrement du plugin et la déclaration de permission sont
  cohérents (les deux ou aucun des deux).
- **Icônes manquantes :** `bundle.icon` référence des chemins relatifs à `core/`. Les fichiers
  sont confirmés présents dans `core/icons/`. Pas d'action nécessaire.

---

## Contraintes de sécurité

- **Principe du moindre privilège :** Seules deux permissions ajoutées à `core:default` :
  `dialog:allow-open`. Pas de `dialog:allow-save`, pas de `fs:*`, pas de `shell:*`.
- **CSP sans `unsafe-eval` :** Aucun `eval()` JavaScript requis.
- **Pas de `remote` dans les capabilities :** L'app ne sert pas de contenu distant.
- **Commandes custom non restreintes par capability :** `list_scripts` et `run_script` reçoivent
  des chemins depuis le frontend. La validation (path existe, est un répertoire/fichier,
  canonicalisation) est déjà implémentée côté Rust (S-02, S-03). S-04 ne modifie pas ce contrat.
