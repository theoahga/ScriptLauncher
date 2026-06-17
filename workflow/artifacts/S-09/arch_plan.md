# Plan technique — S-09 : Config système (catégories + chemins) + arborescence collapsible

> Produit par : Architecte | Date : 2026-06-17

## Compréhension de la story

Implémenter un système de configuration persistant (catégories de scripts) stocké dans `app_data_dir()` via deux commandes Tauri (`get_config`, `save_config`), et remplacer `FolderSelector` par un `CategoryManager` affichant une arborescence collapsible dans la sidebar.

## Périmètre technique

- Fichiers Rust à créer/modifier :
  - `core/src/config.rs` — **NOUVEAU** : struct `Config`, `Category`, commandes `get_config` et `save_config`
  - `core/src/lib.rs` — **MODIFIER** : enregistrer `get_config` et `save_config` dans `invoke_handler`
  - `core/Cargo.toml` — **MODIFIER** : ajouter `uuid` crate (génération d'IDs)
- Fichiers TypeScript à créer/modifier :
  - `ui/types.ts` — **MODIFIER** : ajouter `Category` et `AppConfig`
  - `ui/components/CategoryManager.tsx` — **NOUVEAU** : remplace `FolderSelector`
  - `ui/components/CategoryManager.css` — **NOUVEAU** : styles
  - `ui/App.tsx` — **MODIFIER** : utiliser `CategoryManager` à la place de `FolderSelector` + gérer `AppConfig`
- Fichiers de config à modifier :
  - `core/capabilities/default.json` — **MODIFIER** : ajouter `dialog:allow-open` (déjà présent, vérifier si suffisant)

## Interfaces et contrats

### Commandes Tauri (Rust → Frontend)

#### `get_config() → AppConfig`

- Signature Rust : `pub fn get_config(app_handle: tauri::AppHandle) -> Result<AppConfig, String>`
- Comportement :
  1. Résoudre `app_handle.path().app_data_dir()` → `base_dir`
  2. Construire le chemin `base_dir/config.json`
  3. Si le fichier n'existe pas → retourner `AppConfig { categories: vec![] }`
  4. Lire le fichier et désérialiser via `serde_json`
  5. Retourner `Ok(config)`
- Erreurs possibles :
  - `app_data_dir` inaccessible → `Err("Cannot resolve app data directory: ...")`
  - Fichier corrompu (JSON invalide) → `Err("Failed to parse config: ...")`
  - Erreur lecture FS → `Err("Failed to read config: ...")`

#### `save_config(config: AppConfig) → ()`

- Signature Rust : `pub fn save_config(app_handle: tauri::AppHandle, config: AppConfig) -> Result<(), String>`
- Comportement (écriture atomique via temp + rename) :
  1. Résoudre `app_data_dir`
  2. Créer le répertoire si absent (`fs::create_dir_all`)
  3. Sérialiser `config` en JSON formaté (`serde_json::to_string_pretty`)
  4. Écrire dans un fichier temporaire `config.json.tmp`
  5. Renommer `config.json.tmp` → `config.json` (atomique)
- Erreurs possibles :
  - `app_data_dir` inaccessible → Err
  - Erreur création répertoire → Err
  - Erreur sérialisation → Err
  - Erreur écriture → Err
  - Erreur rename → Err
- Les chemins invalides (dossier inexistant) sont **acceptés** sans validation côté Rust

### Events Tauri (Rust → Frontend)

Aucun event dans cette story. Uniquement des commandes synchrones.

### Types partagés (structs Rust / types TypeScript)

#### Rust — `core/src/config.rs`

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Category {
    pub id: String,
    pub name: String,
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub categories: Vec<Category>,
}
```

#### TypeScript — `ui/types.ts` (ajout)

```typescript
export interface Category {
  id: string;
  name: string;
  path: string;
}

export interface AppConfig {
  categories: Category[];
}
```

### Props des composants React

#### `CategoryManager`

```typescript
interface CategoryManagerProps {
  onScriptSelected: (script: ScriptInfo) => void;
}
```

- Charge la config au montage via `invoke<AppConfig>('get_config')`
- Affiche chaque catégorie comme un nœud collapsible :
  - Header cliquable (chevron ▶/▼ + nom de catégorie + bouton ✕ supprimer)
  - Corps (si expanded) : sous-composant `ScriptList` avec `folderPath={category.path}`
- Bouton "+" en haut pour ajouter une catégorie
- Ajout : ouvre dialog native (`open({ directory: true })`), demande un nom (via `window.prompt` ou input inline — voir ADR-02), crée `{ id: uuid, name, path }`, appelle `save_config`
- Suppression : filtre la catégorie, appelle `save_config`
- Sélection de script : propage via `onScriptSelected`

#### `App` (mise à jour)

```typescript
// Supprime folderPath state (géré par CategoryManager en interne)
// Supprime handleFolderSelected
// Conserve selectedScript + handleScriptSelected
// Remplace <FolderSelector ... /> + <ScriptList ... /> par <CategoryManager onScriptSelected={handleScriptSelected} />
```

## Dépendances

### Crates Rust à ajouter

```toml
uuid = { version = "1", features = ["v4"] }
```

Justification : génération d'IDs uniques pour les catégories côté Rust (appelé depuis `save_config` si un ID est vide, ou généré côté frontend via `crypto.randomUUID()`).

**ADR-03 note** : préférer la génération d'UUID côté frontend via `crypto.randomUUID()` (disponible dans les WebViews modernes) pour éviter d'ajouter une dépendance Rust. Voir ADR-03.

### Packages npm à ajouter

Aucun. `@tauri-apps/plugin-dialog` est déjà installé (`open` est utilisé dans `FolderSelector`). `crypto.randomUUID()` est natif au navigateur.

## Décisions architecturales (ADR)

### ADR-01 : Écriture atomique du config.json

- Contexte : une écriture directe peut corrompre le fichier si l'app est tuée en cours d'écriture
- Options considérées : écriture directe, écriture temp + rename, journal de transaction
- Décision retenue : écriture dans un fichier `.tmp` suivi d'un rename atomique (`fs::rename`)
- Conséquences : légère complexité supplémentaire, mais garantit la cohérence du fichier

### ADR-02 : Saisie du nom de catégorie — input inline vs prompt natif

- Contexte : l'utilisateur doit nommer une catégorie lors de l'ajout
- Options considérées :
  a. `window.prompt()` — simple mais bloquant et non stylable
  b. Input inline dans le composant (state `addingCategory: boolean`) — non-bloquant, stylable
  c. Dialog Tauri native — trop lourde pour un simple champ texte
- Décision retenue : **input inline** dans le composant. Quand l'utilisateur clique "+", afficher un input text + bouton "Confirmer" + bouton "Annuler" directement dans la sidebar
- Conséquences : état supplémentaire (`isAdding`, `newName`) dans `CategoryManager`, mais meilleure UX

### ADR-03 : Génération d'UUID — frontend vs Rust

- Contexte : chaque catégorie doit avoir un ID unique
- Options considérées : `uuid` crate côté Rust, `crypto.randomUUID()` côté frontend
- Décision retenue : **`crypto.randomUUID()`** côté frontend (disponible dans Chromium/WebKit modernes, zéro dépendance supplémentaire)
- Conséquences : la crate `uuid` n'est pas ajoutée à `Cargo.toml`. L'ID est généré lors de la création de la catégorie dans `CategoryManager`

### ADR-04 : `CategoryManager` contient toute la logique config

- Contexte : `App.tsx` gère actuellement `folderPath` et passe à `FolderSelector` + `ScriptList`
- Options considérées :
  a. Garder l'état config dans `App.tsx`, passer en props à `CategoryManager`
  b. Encapsuler tout dans `CategoryManager` (config + scripts listés)
- Décision retenue : **option b** — `CategoryManager` est auto-suffisant. `App.tsx` ne connaît que `selectedScript` et `onScriptSelected`. `folderPath` disparaît de `App.tsx`
- Conséquences : `App.tsx` simplifié. `CategoryManager` est le seul composant qui appelle `get_config`/`save_config`

### ADR-05 : État collapsed par catégorie — Map locale

- Contexte : chaque catégorie peut être collapsed/expanded indépendamment
- Options considérées : `Set<string>`, `Map<string, boolean>`, tableau de booleans indexé
- Décision retenue : `Record<string, boolean>` (objet TypeScript) keyed par `category.id`, initialisé à `true` (toutes les catégories expanded par défaut)
- Conséquences : `setCollapsed(prev => ({ ...prev, [id]: !prev[id] }))` pour toggle

### ADR-06 : `tauri::Manager` pour `app_data_dir()`

- Contexte : la commande `get_config` / `save_config` doit résoudre le répertoire de données Tauri
- Options considérées : `tauri::Manager::path().app_data_dir()`, hardcoder un chemin
- Décision retenue : `app_handle.path().app_data_dir()` via `use tauri::Manager`
- Conséquences : signature de commande doit accepter `app_handle: tauri::AppHandle` comme paramètre injecté automatiquement par Tauri

## Edge cases à gérer

1. **Config absente** : fichier `config.json` inexistant → retourner `AppConfig { categories: [] }` (ne pas créer le fichier)
2. **Config corrompue** : JSON invalide → retourner `Err(...)` (afficher erreur dans UI)
3. **Répertoire app_data inexistant** : `save_config` doit créer le répertoire avec `fs::create_dir_all` avant d'écrire
4. **Chemin de catégorie invalide** : le dossier peut ne pas exister → `ScriptList` affichera son erreur ("Path does not exist"), la catégorie reste dans la config
5. **Catégorie sans nom** : empêcher la confirmation si l'input est vide (validation frontend)
6. **Double clic "+"** : si déjà en mode ajout (`isAdding`), ignorer le clic ou reset
7. **app_data_dir inaccessible** (rare, contexte sandbox) → `Err` remonté, affiché dans UI
8. **Renommage atomique échoue** (filesystem différent pour /tmp) : utiliser le même répertoire pour le `.tmp` (même filesystem garanti)

## Contraintes de sécurité

- Permissions Tauri : `dialog:allow-open` déjà déclaré dans `capabilities/default.json` — suffisant
- Pas de nouvelle permission nécessaire (`fs:` non requis car Tauri 2 gère les chemins via `AppHandle`)
- `save_config` accepte les chemins arbitraires dans `Category.path` — pas d'exécution, risque faible
- L'ID de catégorie est un UUID v4 généré côté frontend — pas de validation nécessaire côté Rust (string opaque)
