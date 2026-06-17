# Audit — S-08 : App Layout (two-panel layout)

> Produit par : Reviewer | Date : 2026-06-17

## Checklist qualité

### Code Rust
- [N/A] S-08 est pur frontend — aucun code Rust modifié.

### Code TypeScript
- [x] Aucun `any` explicite ou implicite — vérifié dans App.tsx, Sidebar.tsx
- [x] Dépendances useEffect complètes — App.tsx : `useCallback` sans useEffect problématique
- [x] Tous les listeners Tauri ont un cleanup — aucun nouveau listener dans S-08
- [x] Props interfaces définies pour chaque composant — `SidebarProps` avec `children: ReactNode`
- [x] tsc --noEmit passera — exécuté avec succès (0 erreur)

### Tests
- [x] Cas nominaux couverts — structure two-panel, sidebar, main panel
- [x] Edge cases de arch_plan.md couverts — script non sélectionné, ScriptList dans sidebar, FolderSelector dans sidebar
- [x] Mocks Tauri correctement configurés — `@tauri-apps/plugin-dialog` et `@tauri-apps/api/core` mockés dans App.test.tsx
- [x] Pas de tests qui passent pour de mauvaises raisons — assertions structurelles précises (`closest('aside.sidebar')`, `closest('main.main-panel')`)

### Story
- [x] Layout deux colonnes (sidebar 260px + main panel flex:1) — implémenté
- [x] FolderSelector déplacé en haut de la sidebar — vérifié dans App.tsx
- [x] ScriptList dans la sidebar — vérifié
- [x] ScriptExecutor dans le panel droit — vérifié
- [x] CSS Grid ou Flexbox, pas de bibliothèque tierce — Flexbox (ADR-01)
- [x] App utilisable à 900px (min-width: 900px sur .app-shell) — implémenté
- [x] npx tsc --noEmit passe sans erreur — vérifié
- [x] Tests Vitest : au moins 3 cas — 9 nouveaux cas (4 Sidebar + 5 App), 36 au total
- [x] Sidebar.tsx créé — présent dans ui/components/
- [x] Rien hors du périmètre Out of scope n'a été implémenté — vérifié : pas de thème, pas de drag-to-resize, pas de multi-catégories

## Problèmes détectés

### Bloquants (empêchent le merge)
Aucun.

### Non bloquants (à corriger dans une story ultérieure)
1. **FolderSelector — pas de styles sidebar** : `FolderSelector.tsx` rend un `<div class="folder-selector">` sans padding interne dans le contexte sidebar. Dans la sidebar, cela peut créer un rendu serré contre le bord. À adresser dans S-09 (thème/design system) ou une story de polish.
2. **`body` a encore `display: flex` supprimé mais `overflow: hidden`** : La transition de `body { min-height: 100vh; display: flex; align-items: center; justify-content: center }` vers `body { height: 100vh; overflow: hidden }` est correcte techniquement mais le commentaire "thème sombre" en tête de `App.css` mérite d'être mis à jour pour refléter que c'est aussi le layout shell. Non bloquant — cosmétique.

### Observations (informatif)
1. L'import `import type { ReactNode } from "react"` par le Modernizer est la forme idiomatique TypeScript 5.x avec `isolatedModules` — bonne pratique.
2. Le snapshot `App.test.tsx.snap` capture correctement la structure `aside.sidebar` + `main.main-panel` — servira de filet de sécurité pour S-09+.
3. `ui/components/Sidebar.css` est minimal et correct. La `border-right` crée la séparation visuelle attendue sans lib CSS externe.

## Verdict

**APPROUVÉ**

Justification : Tous les critères d'acceptation de la story sont satisfaits. Le code est propre (tsc OK, 36 tests OK, aucun any, aucun unwrap). Les ADR sont respectés. Aucun problème bloquant détecté.
