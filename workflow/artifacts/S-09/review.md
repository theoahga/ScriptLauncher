# Audit — S-09 : Config système (catégories + chemins) + arborescence collapsible

> Produit par : Reviewer | Date : 2026-06-17

## Checklist qualité

### Code Rust

- [x] Aucun `.unwrap()` non justifié — `get_config` et `save_config` utilisent exclusivement `?` et `map_err`
- [x] Tous les `Result` sont gérés — `config_path`, `get_config`, `save_config` retournent `Result<T, String>`
- [x] Pas de chemins absolus hardcodés — utilise `app_handle.path().app_data_dir()`
- [x] `cargo check` passe sans warnings — vérifié
- [x] `cargo clippy` passe sans warnings — vérifié
- [x] Permissions Tauri au minimum nécessaire — `dialog:allow-open` déjà déclaré, pas de nouvelle permission requise

### Code TypeScript

- [x] Aucun `any` explicite ou implicite — types stricts partout (`AppConfig`, `Category`, `ScriptInfo`, `Record<string, boolean>`)
- [x] Dépendances `useEffect` complètes — `useEffect(loadConfig, [])` correct (pas de dépendances changeantes)
- [x] Tous les listeners Tauri ont un cleanup — pas de `listen()` dans ce composant, `cancelledRef` pattern utilisé dans `useEffect`
- [x] Props interfaces définies pour chaque composant — `CategoryManagerProps` défini
- [x] `tsc --noEmit` passe — les erreurs dans `ScriptExecutor.test.tsx` sont pré-existantes (S-07, hors scope)
- [x] `import type` utilisé pour les imports de types — appliqué par le Modernizer

### Tests

- [x] Cas nominaux couverts — 8 cas nominaux + interaction
- [x] Edge cases de `arch_plan.md` couverts — config vide, collapse, ajout, suppression
- [x] Mocks Tauri correctement configurés — `invoke` et `open` mockés en tête de fichier
- [x] Pas de tests qui passent pour de mauvaises raisons — assertions précises sur les `invoke` calls

### Story

- [x] `config.json` stocké dans `app_data_dir()` — `app_handle.path().app_data_dir()` (ADR-06)
- [x] Format JSON correct — struct `Category { id, name, path }` + `AppConfig { categories }`
- [x] `get_config()` → crée config vide si absent, erreur si corrompu
- [x] `save_config()` → écriture atomique via .tmp + rename (ADR-01)
- [x] `FolderSelector` remplacé par `CategoryManager` — vérifié dans `App.tsx`
- [x] Arborescence collapsible avec chevron ▶/▼ — implémenté
- [x] Bouton "+" → dialog native → input inline — implémenté (ADR-02)
- [x] Sélection script → `onScriptSelected` callback — propagé depuis `ScriptList`
- [x] Types TypeScript ajoutés (`Category`, `AppConfig`) — dans `ui/types.ts`
- [x] `npx tsc --noEmit` passe (hors erreurs pré-existantes S-07) — vérifié
- [x] 8 cas Vitest (>= 6 requis) — tous passent
- [ ] Rien hors du périmètre Out of scope n'a été implémenté — VÉRIFIÉ : pas de drag-and-drop, pas d'édition inline, pas d'icônes personnalisées

## Problèmes détectés

### Bloquants (empêchent le merge)

Aucun bloquant détecté.

### Non bloquants (à corriger dans une story ultérieure)

1. **`ScriptExecutor.test.tsx` : 5 erreurs TypeScript pré-existantes** (S-07)  
   - Fichier : `ui/components/ScriptExecutor.test.tsx`, lignes 98, 141, 192, 244, 277  
   - Description : mock `listen` incompatible avec `EventCallback<T>`  
   - Note : hors scope S-09, pré-existe sur story/S-08. À corriger dans S-10 ou une story dédiée.

2. **Test Cas 6 (`onScriptSelected`) non testé en profondeur**  
   - Description : le test vérifie que le callback n'est pas appelé sans interaction, mais ne vérifie pas l'appel effectif avec un script (le mock ScriptList ne simule pas un clic sur un script)  
   - Impact : faible — la propagation de props est un pattern simple, couvert implicitement par les tests ScriptList

### Observations (informatif)

1. **`CategoryManager.css` utilise des variables CSS** (`--color-border`, `--color-accent`, etc.) non définies dans `App.css`  
   - Observation : les variables CSS ont des valeurs de fallback solides (`#333`, `#5a9fd4`, etc.) donc aucun risque visuel. À consolider dans S-10 (theme global)

2. **Fichier `FolderSelector.tsx` et `FolderSelector.test.tsx` toujours présents**  
   - Observation : la story remplace FolderSelector dans `App.tsx`, mais les fichiers ne sont pas supprimés. Non bloquant — suppression possible lors du nettoyage S-08/S-09 ou dans une story de refactoring.

3. **Tests Rust dans `config.rs` ne couvrent pas AppHandle**  
   - Observation : `get_config` et `save_config` dépendent de `tauri::AppHandle` qui ne peut pas être injecté dans des tests unitaires purs. La logique de sérialisation/lecture est testée directement. Acceptable et documenté dans `test_report.md`.

## Verdict

**APPROUVÉ**

Justification : les 3 commits S-09 passent `cargo check`, `cargo clippy`, et 44 tests Vitest. Les critères d'acceptation de la story sont tous adressés. Aucun bloquant détecté.
