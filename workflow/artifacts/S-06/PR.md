# PR — S-06 : ScriptList.tsx

## Résumé

Cette PR ajoute le composant `ScriptList` qui affiche la liste des scripts du dossier sélectionné en appelant la commande Tauri `list_scripts`. Elle crée également `ui/types.ts` avec l'interface `ScriptInfo` partagée, et met à jour `App.tsx` pour câbler `FolderSelector` → `ScriptList` via l'état local `folderPath`.

## Fichiers modifiés

| Fichier | Type | Description |
|---------|------|-------------|
| `ui/types.ts` | Nouveau | Interface `ScriptInfo` partagée (name, path, extension) |
| `ui/components/ScriptList.tsx` | Nouveau | Composant liste des scripts avec gestion loading/erreur/vide |
| `ui/components/ScriptList.css` | Nouveau | Styles thème sombre terminal pour ScriptList |
| `ui/components/ScriptList.test.tsx` | Nouveau | 10 tests Vitest couvrant tous les états et edge cases |
| `ui/App.tsx` | Modifié | Intégration ScriptList avec useState folderPath |
| `ui/__snapshots__/App.test.tsx.snap` | Modifié | Snapshot mis à jour (App intègre ScriptList) |

## Critères d'acceptation — statut

| Critère | Adressé par | Statut |
|---------|-------------|--------|
| Composant ScriptList dans `ui/components/ScriptList.tsx` | ScriptList.tsx:11 | ✅ |
| Reçoit `folderPath: string \| null` en prop | ScriptList.tsx:7 | ✅ |
| `folderPath === null` → "Aucun dossier sélectionné" | ScriptList.tsx:59-64 | ✅ |
| Appelle `list_scripts` via invoke | ScriptList.tsx:35 | ✅ |
| Pendant chargement → "Chargement..." | ScriptList.tsx:67-72 | ✅ |
| Liste vide → "Aucun script trouvé dans ce dossier" | ScriptList.tsx:83-88 | ✅ |
| Erreur → affiche message Rust | ScriptList.tsx:75-80 | ✅ |
| Item cliquable avec nom et extension | ScriptList.tsx:94-104 | ✅ |
| Clic → `onScriptSelected(script)` | ScriptList.tsx:98 | ✅ |
| `npx tsc --noEmit` passe | Vérifié — 0 erreur | ✅ |
| ≥ 5 tests Vitest | 10 tests | ✅ |

## Tests

| Suite | Tests | Résultat |
|-------|-------|---------|
| ScriptList.test.tsx (Vitest) | 10 | ✅ Pass |
| App.test.tsx (Vitest) | 2 | ✅ Pass (snapshot mis à jour) |
| FolderSelector.test.tsx (Vitest) | 7 | ✅ Pass (non-régression) |

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

- **Accessibilité (non bloquant)** : Les `<li>` cliquables n'ont pas de gestion clavier. À adresser en S-08.
- **Layout (non bloquant)** : `.app` manque `flex-direction: column` pour empiler FolderSelector et ScriptList verticalement. À finaliser en S-08.
- **Race condition** : Correctement gérée via flag `cancelled` dans le cleanup useEffect.

## Décision demandée

Merge cette PR ou retours correctifs ?

⏸️ En attente de ta review. Aucune action sans ton accord.
