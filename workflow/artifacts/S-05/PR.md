# PR — S-05 : FolderSelector.tsx

## Résumé

Cette PR ajoute le composant `FolderSelector` qui permet à l'utilisateur de sélectionner un dossier via la dialog native de l'OS (Tauri plugin-dialog). Le composant remplace le placeholder `<h1>Hello ScriptLauncher</h1>` dans `App.tsx` et pose la fondation pour S-06 (ScriptList) qui recevra le chemin sélectionné via callback.

## Fichiers modifiés

| Fichier | Type | Description |
|---------|------|-------------|
| `ui/components/FolderSelector.tsx` | Nouveau | Composant de sélection de dossier |
| `ui/App.tsx` | Modifié | Intégration FolderSelector (remplace placeholder) |
| `ui/components/FolderSelector.test.tsx` | Nouveau | 7 tests Vitest |
| `ui/App.test.tsx` | Modifié | Mis à jour pour la nouvelle structure App |
| `vite.config.ts` | Modifié | Exclusion `workflow/**` des tests Vitest |
| `package.json` | Modifié | Ajout `@tauri-apps/plugin-dialog` |
| `package-lock.json` | Modifié | Lock file mis à jour |

## Critères d'acceptation — statut

| Critère | Adressé par | Statut |
|---------|-------------|--------|
| Composant `FolderSelector` dans `ui/components/FolderSelector.tsx` | FolderSelector.tsx | ✅ |
| Bouton "Sélectionner un dossier" affiché | FolderSelector.tsx:27-31 | ✅ |
| Clic → `open({ directory: true })` | FolderSelector.tsx:15 | ✅ |
| Sélection → chemin affiché + callback appelé | FolderSelector.tsx:16-18,34-36 | ✅ |
| Annulation → aucun changement, pas d'erreur | FolderSelector.tsx:16 (guard `!== null`) | ✅ |
| Intégré dans `ui/App.tsx` | App.tsx:6-13 | ✅ |
| `npx tsc --noEmit` passe | Vérifié | ✅ |
| Tests Vitest ≥ 4 cas | FolderSelector.test.tsx (7 tests) | ✅ |

## Tests

| Suite | Tests | Résultat |
|-------|-------|---------|
| FolderSelector.test.tsx | 7 | ✅ Pass |
| App.test.tsx | 2 | ✅ Pass |
| **Total** | **9** | **✅ Pass** |

## Commandes de vérification

```bash
# Vérifier les types TypeScript
npx tsc --noEmit

# Lancer les tests frontend
npm run test

# Mode dev (test visuel)
npm run tauri dev
```

## Notes du reviewer

- **Styles CSS manquants** : `.folder-selector`, `.folder-selector__button`, `.folder-selector__path` ne sont pas définis dans `App.css`. L'UI est fonctionnelle mais non stylisée. À adresser en S-08 (App layout + styles).
- **`console.log` de développement** dans `App.tsx:7` — acceptable pour S-05, à nettoyer en S-06.
- La dépendance `@tauri-apps/plugin-dialog` est ajoutée dans `package.json` (le plugin Rust était déjà dans `core/Cargo.toml` depuis S-04).

## Décision demandée

Merge cette PR ou retours correctifs ?

⏸️ En attente de ta review. Aucune action sans ton accord.

PR GitHub : https://github.com/theoahga/ScriptLauncher/pull/14
