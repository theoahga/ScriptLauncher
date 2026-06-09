# Rapport de tests — S-05

> Produit par : Test Writer | Date : 2026-06-09

## Couverture

| Fichier | Tests | Cas nominaux | Edge cases | Erreurs |
|---------|-------|-------------|------------|---------|
| FolderSelector.tsx | 7 | ✅ | ✅ 4/4 | ✅ |
| App.tsx | 2 | ✅ | — | — |

## Edge cases de arch_plan.md → couverture

| Edge case | Test correspondant | Statut |
|-----------|-------------------|--------|
| Annulation dialog (`null`) | "ne change pas l'état...quand l'utilisateur annule" | ✅ |
| Erreur inattendue (exception) | "gère silencieusement une erreur de la dialog" | ✅ |
| Premier rendu — selectedPath null | "n'affiche pas de chemin au rendu initial" | ✅ |
| Double-clic / sélection successive | "met à jour le chemin affiché si un nouveau dossier est sélectionné" | ✅ |

## Détail des tests — FolderSelector.test.tsx

| # | Nom du test | Type | Résultat |
|---|-------------|------|---------|
| 1 | affiche le bouton "Sélectionner un dossier" au rendu initial | nominal | ✅ |
| 2 | n'affiche pas de chemin au rendu initial | nominal (état vide) | ✅ |
| 3 | ouvre la dialog native au clic sur le bouton | interaction | ✅ |
| 4 | affiche le chemin et appelle onFolderSelected quand un dossier est sélectionné | nominal (sélection) | ✅ |
| 5 | ne change pas l'état et n'appelle pas onFolderSelected quand l'utilisateur annule | edge case annulation | ✅ |
| 6 | gère silencieusement une erreur de la dialog | edge case erreur | ✅ |
| 7 | met à jour le chemin affiché si un nouveau dossier est sélectionné après un premier | edge case sélection successive | ✅ |

## Détail des tests — App.test.tsx (mis à jour)

| # | Nom du test | Type | Résultat |
|---|-------------|------|---------|
| 1 | rend le composant FolderSelector avec le bouton de sélection | intégration | ✅ |
| 2 | snapshot du rendu initial | régression | ✅ |

## Cas non couverts et justification

- **Chemin très long** : non testé car test visuel pur (affichage CSS `word-break`), non testable via Testing Library
- **Permissions OS refusées** : couvert indirectement par le test d'erreur générique

## Note technique

- Mock `@tauri-apps/plugin-dialog` utilisé dans tous les tests (`vi.mock`)
- Pas de `listen()` Tauri dans ce composant → pas de cleanup de listener à tester
- `vite.config.ts` mis à jour : ajout de `"workflow/**"` dans `exclude` pour éviter que les artefacts de test soient ramassés par le runner Vitest
- `npm run test -- --run` : **9 tests passent, 0 échec**
