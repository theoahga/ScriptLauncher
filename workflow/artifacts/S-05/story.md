# Story S-05 — FolderSelector.tsx

**ID :** S-05  
**Titre :** FolderSelector.tsx  
**Dépend de :** S-04 (dialog:allow-open configuré dans capabilities/default.json)  
**Branche :** story/S-05

## Description

En tant qu'utilisateur,
je veux pouvoir sélectionner un dossier depuis l'interface de l'application,
afin que l'app puisse lister les scripts qu'il contient (S-06).

## Critères d'acceptation

- Un composant `FolderSelector` est créé dans `ui/components/FolderSelector.tsx`
- Il affiche un bouton "Sélectionner un dossier"
- Au clic, il ouvre la dialog native via `@tauri-apps/plugin-dialog` (`open({ directory: true })`)
- Si l'utilisateur sélectionne un dossier → le chemin est affiché sous le bouton et `onFolderSelected(path)` est appelé
- Si l'utilisateur annule → aucun changement d'état, pas d'erreur affichée
- Le composant est intégré dans `ui/App.tsx` (remplace le placeholder)
- `npx tsc --noEmit` passe sans erreur
- Tests Vitest : au moins 4 cas (affichage initial, clic → dialog, sélection → callback + affichage, annulation → pas de changement)

## Interface du composant

```tsx
interface FolderSelectorProps {
  onFolderSelected: (path: string) => void;
}

export default function FolderSelector({ onFolderSelected }: FolderSelectorProps): JSX.Element
```

## Out of scope

- Validation que le dossier contient des scripts (S-06)
- Persistance du chemin entre sessions
- Affichage de la liste des scripts (S-06)
- Exécution de scripts (S-07)

## Contexte technique

Structure actuelle du frontend :
```
ui/
├── App.tsx          # placeholder : <h1>Hello ScriptLauncher</h1>
├── App.css          # styles existants
├── main.tsx         # point d'entrée React
└── test/
    └── setup.ts     # config Vitest
```

Dépendance Tauri déjà disponible (installée via S-04) :
- `@tauri-apps/plugin-dialog` — `open({ directory: true })` retourne `string | null`

Chemin du projet : `/Users/theoclere/Development/ScriptLauncher`  
Branche de départ : `story/S-04` (ou `main` si S-04 mergée)

**Note :** Créer le dossier `ui/components/` si nécessaire. Utiliser le composant `FolderSelector` directement dans `App.tsx` pour rendre l'app fonctionnelle.
