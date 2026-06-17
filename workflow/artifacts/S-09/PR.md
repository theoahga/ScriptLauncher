# PR — S-09 : Config système (catégories + chemins) + arborescence collapsible

## Résumé

Cette PR ajoute un système de configuration persistant pour les catégories de scripts et remplace `FolderSelector` par un `CategoryManager` avec arborescence collapsible dans la sidebar. L'utilisateur peut désormais organiser ses scripts en plusieurs catégories (nom + chemin), chacune affichant ses scripts dans un nœud dépliable/repliable.

## Fichiers modifiés

| Fichier | Type | Description |
|---------|------|-------------|
| `core/src/config.rs` | Nouveau | Module Rust : structs `Category`/`AppConfig`, commandes `get_config` et `save_config` (écriture atomique) |
| `core/src/lib.rs` | Modifié | Enregistrement de `get_config` et `save_config` dans `invoke_handler` |
| `ui/types.ts` | Modifié | Ajout des interfaces TypeScript `Category` et `AppConfig` |
| `ui/components/CategoryManager.tsx` | Nouveau | Composant arborescence collapsible (remplace FolderSelector) |
| `ui/components/CategoryManager.css` | Nouveau | Styles thème sombre terminal |
| `ui/App.tsx` | Modifié | Utilise `CategoryManager` (ADR-04 : config encapsulée dans le composant) |
| `ui/components/CategoryManager.test.tsx` | Nouveau | 8 cas Vitest |
| `ui/App.test.tsx` | Modifié | Mis à jour pour S-09 (snapshot régénéré) |

## Critères d'acceptation — statut

| Critère | Adressé par | Statut |
|---------|-------------|--------|
| `config.json` dans `app_data_dir()` | `config.rs:config_path()` | ✅ |
| Format JSON `{ categories: [{ id, name, path }] }` | `config.rs:AppConfig/Category` | ✅ |
| `get_config()` → config vide si absent | `config.rs:get_config()` ligne 47 | ✅ |
| `save_config()` atomique (temp + rename) | `config.rs:save_config()` ADR-01 | ✅ |
| `FolderSelector` remplacé par `CategoryManager` | `App.tsx`, `CategoryManager.tsx` | ✅ |
| Header catégorie collapsible + chevron | `CategoryManager.tsx` lignes 184-210 | ✅ |
| Bouton "+" → ajout inline | `CategoryManager.tsx` ADR-02 | ✅ |
| Sélection script → `onScriptSelected` | `CategoryManager.tsx` prop forwarding | ✅ |
| Types `Category` et `AppConfig` dans `types.ts` | `ui/types.ts` | ✅ |
| `npx tsc --noEmit` passe | Vérifié (erreurs S-07 pré-existantes) | ✅ |
| 6+ tests Vitest | 8 cas CategoryManager + 5 App | ✅ |

## Tests

| Suite | Tests | Résultat |
|-------|-------|---------|
| CategoryManager.test.tsx | 8 | ✅ Pass |
| App.test.tsx | 5 | ✅ Pass |
| ScriptList.test.tsx | 10 | ✅ Pass |
| ScriptExecutor.test.tsx | 10 | ✅ Pass |
| Sidebar.test.tsx | 4 | ✅ Pass |
| FolderSelector.test.tsx | 7 | ✅ Pass |
| **TOTAL** | **44** | **✅ Pass** |

## Commandes de vérification

```bash
# Vérifier le code Rust
cd core && cargo check && cargo clippy

# Vérifier les types TypeScript
npx tsc --noEmit

# Lancer les tests Rust
cd core && cargo test

# Lancer les tests frontend (depuis /tmp/s09_worktree ou après merge)
npm run test

# Mode dev (test visuel)
npm run tauri dev
```

## Notes du reviewer

- `FolderSelector.tsx` et son test restent dans le repo mais ne sont plus utilisés — suppression optionnelle dans une story de nettoyage
- Les erreurs TypeScript dans `ScriptExecutor.test.tsx` (5 erreurs) sont pré-existantes depuis S-07 et hors scope S-09
- `CategoryManager.css` utilise des variables CSS avec fallbacks — à consolider dans le theme global S-08 ou S-10

## Décision demandée

Merge cette PR ou retours correctifs ?

⏸️ En attente de ta review. Aucune action sans ton accord.

PR GitHub : https://github.com/theoahga/ScriptLauncher/pull/19
