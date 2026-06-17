# PR — S-08 : App Layout (two-panel layout)

## Résumé

Cette PR restructure `App.tsx` en layout deux colonnes (sidebar + panel principal) via Flexbox pur, sans aucune dépendance externe. La sidebar (260px, scroll interne) contient `FolderSelector` et `ScriptList` ; le panel droit (flex:1, scroll interne) contient `ScriptExecutor`. Aucune logique métier, prop, ni interface de composant existant n'a été modifié.

## Fichiers modifiés

| Fichier | Type | Description |
|---------|------|-------------|
| `ui/App.tsx` | Modifié | Layout restructuré : deux panneaux `Sidebar` + `main.main-panel` |
| `ui/App.css` | Modifié | `.app` → `.app-shell` (Flexbox row), ajout `.main-panel`, `body` sans `display:flex` centré |
| `ui/components/Sidebar.tsx` | Nouveau | Wrapper `<aside class="sidebar">` avec `children: ReactNode` |
| `ui/components/Sidebar.css` | Nouveau | Largeur fixe 260px, `overflow-y: auto`, border-right |
| `ui/components/Sidebar.test.tsx` | Nouveau | 4 tests Vitest (structure, children, multiple children, snapshot) |
| `ui/App.test.tsx` | Modifié | 5 tests remplacent les 2 anciens : structure two-panel, sidebar, main panel, ScriptList placement, snapshot |
| `ui/__snapshots__/App.test.tsx.snap` | Modifié | Snapshot régénéré — capture la nouvelle structure `aside.sidebar` + `main.main-panel` |

## Critères d'acceptation — statut

| Critère | Adressé par | Statut |
|---------|-------------|--------|
| Layout deux colonnes sidebar + main panel | `App.tsx` + `App.css` (`.app-shell { display: flex }`) | ✅ |
| Sidebar largeur fixe ~260px | `Sidebar.css` (`.sidebar { width: 260px; min-width: 260px }`) | ✅ |
| Sidebar : scroll interne | `Sidebar.css` (`overflow-y: auto`) | ✅ |
| Main panel : largeur flexible | `App.css` (`.main-panel { flex: 1 }`) | ✅ |
| Main panel : scroll interne | `App.css` (`.main-panel { overflow-y: auto }`) | ✅ |
| FolderSelector en haut de la sidebar | `App.tsx` — premier enfant de `<Sidebar>` | ✅ |
| ScriptList dans la sidebar | `App.tsx` — deuxième enfant de `<Sidebar>` | ✅ |
| ScriptExecutor dans le panel droit | `App.tsx` — enfant de `<main class="main-panel">` | ✅ |
| Utilisable à 900px sans overflow horizontal | `App.css` (`.app-shell { min-width: 900px }`) | ✅ |
| CSS Grid ou Flexbox, pas de lib tierce | Flexbox (ADR-01) | ✅ |
| `npx tsc --noEmit` passe sans erreur | Exécuté — 0 erreur | ✅ |
| `Sidebar.tsx` créé | `ui/components/Sidebar.tsx` | ✅ |
| Tests Vitest : au moins 3 cas | 9 nouveaux tests (4 Sidebar + 5 App), 36 au total | ✅ |

## Tests

| Suite | Tests | Résultat |
|-------|-------|----------|
| `Sidebar.test.tsx` | 4 (nouveaux) | ✅ Pass |
| `App.test.tsx` | 5 (remplace 2) | ✅ Pass |
| `ScriptList.test.tsx` | 10 (inchangés) | ✅ Pass |
| `ScriptExecutor.test.tsx` | 10 (inchangés) | ✅ Pass |
| `FolderSelector.test.tsx` | 7 (inchangés) | ✅ Pass |
| **Total** | **36** | **✅ Pass** |

## Commandes de vérification

```bash
# Vérifier les types TypeScript
npx tsc --noEmit

# Lancer les tests frontend
npm run test -- --run

# Mode dev (test visuel)
npm run tauri dev
```

## Notes du reviewer

- Le refactoring est purement structurel — aucune prop, aucun type, aucune logique métier n'a changé.
- Le composant `Sidebar.tsx` utilise `import type { ReactNode }` (idiomatique TypeScript 5.x avec JSX transform automatique Vite).
- Le snapshot régénéré servira de filet de sécurité pour les stories suivantes (S-09+).
- Non bloquant : `FolderSelector` n'a pas de padding interne dans le contexte sidebar — à adresser dans une story de polish.

## Décision demandée

Merge cette PR ou retours correctifs ?

⏸️ En attente de ta review. Aucune action sans ton accord.

PR GitHub : https://github.com/theoahga/ScriptLauncher/pull/17
