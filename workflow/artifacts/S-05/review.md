# Audit — S-05 : FolderSelector.tsx

> Produit par : Reviewer | Date : 2026-06-09

## Checklist qualité

### Code Rust
- N/A — aucun code Rust dans cette story

### Code TypeScript
- [x] Aucun `any` explicite ou implicite
- [x] Dépendances useEffect complètes (aucun useEffect dans cette story)
- [x] Tous les listeners Tauri ont un cleanup (aucun `listen()` dans cette story)
- [x] Props interfaces définies pour chaque composant (`FolderSelectorProps`)
- [x] `tsc --noEmit` passe sans erreur (vérifié)

### Tests
- [x] Cas nominaux couverts (affichage initial, clic, sélection)
- [x] Edge cases de arch_plan.md couverts (annulation, erreur, sélection successive)
- [x] Mocks Tauri (`@tauri-apps/plugin-dialog`) correctement configurés
- [x] Pas de tests qui passent pour de mauvaises raisons (assertions précises)

### Story
- [x] Composant `FolderSelector` créé dans `ui/components/FolderSelector.tsx`
- [x] Bouton "Sélectionner un dossier" affiché
- [x] Au clic → `open({ directory: true })` appelé
- [x] Sélection → chemin affiché + `onFolderSelected(path)` appelé
- [x] Annulation (`null`) → aucun changement d'état, pas d'erreur affichée
- [x] Composant intégré dans `ui/App.tsx`
- [x] `npx tsc --noEmit` passe sans erreur
- [x] Tests Vitest : 7 cas (> 4 minimum requis)
- [x] Interface `FolderSelectorProps` exactement conforme à la story

### Out of scope vérifié
- [x] Pas de validation de scripts (S-06)
- [x] Pas de persistance du chemin
- [x] Pas d'affichage de liste de scripts (S-06)
- [x] Pas d'exécution de scripts (S-07)

## Problèmes détectés

### Bloquants (empêchent le merge)

Aucun.

### Non bloquants (à corriger dans une story ultérieure)

1. **Pas de styles CSS pour `.folder-selector`, `.folder-selector__button`, `.folder-selector__path`** — `ui/App.css` ne définit pas ces classes BEM. L'app est fonctionnelle mais sans styles sur le composant. À adresser en S-08 (App layout + styles).

2. **`console.log` en production dans `App.tsx` ligne 7** — `console.log("Dossier sélectionné :", path)` est un log de développement qui restera en prod si non retiré. Acceptable pour une story de scaffolding (S-05), à nettoyer en S-06 ou S-07.

### Observations (informatif)

1. **`useCallback` avec dépendance sur `onFolderSelected`** — correct et idiomatique. Si le parent (App.tsx) ne mémoïse pas `handleFolderSelected`, le callback serait recréé et `handleClick` aussi. La modernisation a adressé cela dans App.tsx avec `useCallback([])`. Pattern solide.

2. **Typage `string | null` pour `selectedPath`** — conforme à la signature de `open({ directory: true })`. Le garde `result !== null` est explicite et correct.

3. **Fix `vite.config.ts`** — l'ajout de `"workflow/**"` dans `exclude` est une amélioration du projet. Risque zéro d'impact sur les tests de prod.

## Verdict

**APPROUVÉ**

Justification : Le composant est correct, idiomatique, bien testé (9 tests, 7 pour FolderSelector), tous les critères d'acceptation sont adressés, `tsc --noEmit` passe. Les deux points non bloquants sont cosmétiques/de développement, hors périmètre S-05.
