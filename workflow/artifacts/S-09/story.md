# Story S-09 — Config système & arborescence sidebar

**ID :** S-09  
**Titre :** Config système (catégories + chemins) + arborescence collapsible  
**Dépend de :** S-08 (layout sidebar/panel en place)  
**Branche :** story/S-09

## Description

En tant qu'utilisateur,
je veux définir des catégories de scripts dans un fichier de configuration (chaque catégorie = nom + chemin),
afin de pouvoir organiser mes scripts par thème dans une arborescence collapsible dans la sidebar, sans être limité à un seul dossier.

## Critères d'acceptation

### Config (backend Rust)

- Un fichier `config.json` est stocké dans le répertoire de données de l'app Tauri (`app_data_dir()`)
- Format JSON :
  ```json
  {
    "categories": [
      { "id": "uuid-ou-slug", "name": "Système", "path": "/Users/theo/Scripts/Système" },
      { "id": "...",          "name": "Réseau",  "path": "/Users/theo/Scripts/Réseau"  }
    ]
  }
  ```
- Commandes Tauri exposées :
  - `get_config() → Config` : lit le fichier (crée un fichier vide si absent)
  - `save_config(config: Config) → ()` : écrit le fichier (atomique via fichier temp + rename)
- Les chemins invalides (dossier inexistant) sont acceptés à la sauvegarde mais signalés côté frontend

### Sidebar (frontend)

- `FolderSelector` est **remplacé** par un composant `CategoryManager` (bouton "+" pour ajouter une catégorie, dialog native pour choisir le dossier)
- La sidebar affiche une arborescence : chaque catégorie est un nœud collapsible
  - Header de catégorie cliquable (collapse/expand) avec icône chevron
  - Sous le header : liste des scripts du dossier (réutilise la logique de `ScriptList`)
- Au démarrage, la config est chargée via `invoke('get_config')` et affichée
- Ajouter / supprimer une catégorie appelle `invoke('save_config', ...)`
- Un clic sur un script sélectionne ce script (remonte via callback `onScriptSelected`)

### Types TypeScript

```typescript
// à ajouter dans ui/types.ts
export interface Category {
  id: string;
  name: string;
  path: string;
}

export interface AppConfig {
  categories: Category[];
}
```

### Qualité

- `npx tsc --noEmit` passe sans erreur
- Tests Vitest : au moins 6 cas
  - Config vide → affichage "Aucune catégorie"
  - Catégorie affichée avec ses scripts
  - Collapse/expand d'une catégorie
  - Ajout d'une catégorie → save_config appelé
  - Suppression d'une catégorie → save_config appelé
  - Sélection d'un script → callback appelé

## Out of scope

- Édition du nom d'une catégorie in-place
- Réordonnancement des catégories par drag-and-drop
- Icônes personnalisées par catégorie
- Streaming stdout (S-10)
- Historique (S-11)

## Contexte technique

Structure frontend après S-08 :
```
ui/
├── App.tsx                     # two-panel layout
├── App.css
├── components/
│   ├── FolderSelector.tsx      # à remplacer par CategoryManager
│   ├── ScriptList.tsx          # logique de listing à réutiliser
│   ├── ScriptExecutor.tsx
│   └── Sidebar.tsx             # (si créé en S-08)
├── types.ts                    # ScriptInfo, ScriptOutput existants
└── main.tsx
```

Commandes Rust disponibles après S-09 :
```typescript
import { invoke } from '@tauri-apps/api/core';

const config: AppConfig = await invoke('get_config');
await invoke('save_config', { config });
```

Commandes Rust existantes (S-02) : `list_scripts(folder_path: string) → ScriptInfo[]`

Chemin du projet : `/Users/theoclere/Development/ScriptLauncher`  
Branche de départ : `story/S-08` (ou `main` si S-08 mergée)

**Note :** Le fichier `config.json` doit être créé dans `app_data_dir()` (Tauri), pas dans le répertoire de l'app. Sur macOS, c'est typiquement `~/Library/Application Support/com.scriptlauncher.app/config.json`. Utiliser `tauri::Manager::path().app_data_dir()` côté Rust.
