# Rapport de tests — S-08

> Produit par : Test Writer | Date : 2026-06-17

## Couverture

| Fichier | Tests ajoutés | Cas nominaux | Edge cases | Notes |
|---------|---------------|-------------|------------|-------|
| `ui/components/Sidebar.test.tsx` | 4 | ✅ | ✅ 2/2 | Nouveau fichier |
| `ui/App.test.tsx` | 5 (remplace 2) | ✅ | ✅ 2/2 | Snapshot régénéré |

**Total tests suite complète : 36 (5 fichiers) — tous passent.**

## Edge cases de arch_plan.md → couverture

| Edge case | Test correspondant | Statut |
|-----------|-------------------|--------|
| Script non sélectionné → panel droit vide | `App > rend le panel droit avec Aucun script sélectionné` | ✅ |
| ScriptList dans sidebar (pas dans main panel) | `App > rend ScriptList dans la sidebar` | ✅ |
| FolderSelector dans sidebar (pas dans main panel) | `App > rend la sidebar avec le bouton de sélection` | ✅ |
| Snapshot : détection de régression structurelle | `App > snapshot du rendu initial two-panel`, `Sidebar > snapshot` | ✅ |
| Sidebar children multiple rendus | `Sidebar > affiche plusieurs enfants sans altérer leur structure` | ✅ |

## Détail des cas de test

### Sidebar.test.tsx (4 cas)

| # | Description | Type |
|---|-------------|------|
| 1 | Rend un `<aside>` avec la classe `sidebar` | Structure HTML |
| 2 | Affiche ses children dans la sidebar | Props children |
| 3 | Affiche plusieurs enfants sans altérer leur structure | Edge case : multiple children |
| 4 | Snapshot du rendu avec un enfant | Régression |

### App.test.tsx (5 cas)

| # | Description | Type |
|---|-------------|------|
| 1 | Rend la structure two-panel avec la classe `app-shell` | Structure layout |
| 2 | Rend la sidebar avec le bouton de sélection de dossier | Sidebar visible |
| 3 | Rend le panel droit avec "Aucun script sélectionné" | Main panel visible |
| 4 | Rend ScriptList dans la sidebar (pas dans main panel) | Placement composant |
| 5 | Snapshot du rendu initial two-panel | Régression |

## Commandes de vérification

```bash
npm run test -- --run
# Résultat : 36 tests pass, 0 fail, 2 snapshots écrits
```

## Cas non couverts et justification

- **Viewport < 900px** : non testable en JSDOM (pas de rendu CSS réel). Le `min-width: 900px` est une contrainte CSS pure, vérifiable uniquement via tests E2E ou tests visuels.
- **Scroll interne sidebar/main-panel** : même raison — JSDOM ne rend pas les overflows CSS.
- **Interaction drag-to-resize** : hors scope S-08 (mentionné explicitement dans "Out of scope").

## Note : snapshot régénéré

Le snapshot `App.test.tsx.snap` a été supprimé et régénéré car la structure HTML a changé (`.app` → `.app-shell`, ajout de `<aside class="sidebar">` et `<main class="main-panel">`). Le nouveau snapshot capture la structure two-panel complète.
