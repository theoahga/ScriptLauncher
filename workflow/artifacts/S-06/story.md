# Story S-06 — ScriptList.tsx

**ID :** S-06  
**Titre :** ScriptList.tsx  
**Dépend de :** S-05 (FolderSelector fournit le chemin de dossier), S-02 (list_scripts command Rust)  
**Branche :** story/S-06

## Description

En tant qu'utilisateur,
je veux voir la liste des scripts du dossier sélectionné,
afin de choisir lequel exécuter (S-07).

## Critères d'acceptation

- Un composant `ScriptList` est créé dans `ui/components/ScriptList.tsx`
- Il reçoit un `folderPath: string | null` en prop
- Si `folderPath` est null → affiche un message "Aucun dossier sélectionné"
- Sinon → appelle la commande Tauri `list_scripts(folder)` via `@tauri-apps/api/core` (`invoke`)
- Pendant le chargement → affiche un indicateur "Chargement..."
- Si la liste est vide → affiche "Aucun script trouvé dans ce dossier"
- Si erreur → affiche le message d'erreur retourné par Rust
- Chaque script est rendu sous forme d'item cliquable avec son nom et son extension
- Au clic sur un script → `onScriptSelected(script)` est appelé
- `npx tsc --noEmit` passe sans erreur
- Tests Vitest : au moins 5 cas (folderPath null, chargement, liste vide, liste avec items, erreur Rust)

## Interface du composant

```tsx
// Type partagé — à importer depuis ui/types.ts (à créer si inexistant)
interface ScriptInfo {
  name: string;
  path: string;
  extension: string;
}

interface ScriptListProps {
  folderPath: string | null;
  onScriptSelected: (script: ScriptInfo) => void;
}

export default function ScriptList({ folderPath, onScriptSelected }: ScriptListProps): JSX.Element
```

## Out of scope

- Sélection multiple de scripts
- Filtrage ou recherche dans la liste
- Affichage du contenu d'un script
- Exécution d'un script (S-07)
- Rafraîchissement automatique de la liste

## Contexte technique

Structure actuelle du frontend (après S-05) :
```
ui/
├── App.tsx                       # intègre FolderSelector, doit aussi intégrer ScriptList
├── components/
│   └── FolderSelector.tsx        # produit par S-05
├── types.ts                      # à créer si nécessaire (ScriptInfo)
└── main.tsx
```

Commande Tauri disponible :
```typescript
import { invoke } from '@tauri-apps/api/core';
const scripts: ScriptInfo[] = await invoke('list_scripts', { folder: folderPath });
// En cas d'erreur : invoke rejette avec un string (message Rust)
```

Type Rust correspondant (file_system.rs) :
```rust
pub struct ScriptInfo { pub name: String, pub path: String, pub extension: String }
```

Chemin du projet : `/Users/theoclere/Development/ScriptLauncher`

**Note :** `App.tsx` doit passer l'état `folderPath` (depuis FolderSelector) à ScriptList. Utiliser `useState<string | null>(null)`.
