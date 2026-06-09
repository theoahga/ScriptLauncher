# Plan technique — S-06 : ScriptList.tsx

> Produit par : Architecte | Date : 2026-06-09

## Compréhension de la story

Créer le composant `ScriptList` qui interroge la commande Tauri `list_scripts` pour afficher les scripts du dossier sélectionné, avec gestion de tous les états (null, loading, vide, liste, erreur). Mettre à jour `App.tsx` pour câbler `FolderSelector` → `ScriptList` via état partagé. Créer `ui/types.ts` avec l'interface `ScriptInfo`.

## Périmètre technique

- Fichiers Rust à créer/modifier : **aucun** (list_scripts est disponible depuis S-02)
- Fichiers TypeScript à créer/modifier :
  - `ui/types.ts` — nouveau fichier, interface `ScriptInfo`
  - `ui/components/ScriptList.tsx` — nouveau composant
  - `ui/App.tsx` — mise à jour pour intégrer ScriptList avec état `folderPath`
- Fichiers de config à modifier : **aucun**

## Interfaces et contrats

### Commandes Tauri (Rust → Frontend)

#### `list_scripts`

```typescript
invoke<ScriptInfo[]>('list_scripts', { folder: folderPath })
// Succès : ScriptInfo[]
// Erreur : invoke rejette avec un string (message Rust)
```

**Comportement attendu :**
- Retourne la liste des scripts du dossier passé en paramètre
- Retourne un tableau vide si le dossier ne contient aucun script reconnu
- Rejette la promesse avec un message string si le chemin est invalide ou erreur FS

**Paramètre :**
- `folder: string` — chemin absolu vers le dossier sélectionné

### Events Tauri (Rust → Frontend)

Aucun event pour cette story.

### Types partagés

#### `ScriptInfo` — `ui/types.ts`

```typescript
export interface ScriptInfo {
  name: string;       // nom du fichier (ex: "deploy.sh")
  path: string;       // chemin absolu complet (ex: "/scripts/deploy.sh")
  extension: string;  // extension sans point (ex: "sh", "py", "js")
}
```

**Note :** Ce type correspond exactement au struct Rust `ScriptInfo` dans `file_system.rs` (sérialisé via serde). Le champ `extension` ne contient pas de point.

### Props des composants React

#### ScriptList

```typescript
interface ScriptListProps {
  folderPath: string | null;
  onScriptSelected: (script: ScriptInfo) => void;
}

export default function ScriptList({ folderPath, onScriptSelected }: ScriptListProps): JSX.Element
```

**Comportement interne :**
- États locaux :
  - `scripts: ScriptInfo[]` (initialement `[]`)
  - `loading: boolean` (initialement `false`)
  - `error: string | null` (initialement `null`)
- Quand `folderPath` est `null` → affiche "Aucun dossier sélectionné" (pas d'invoke)
- Quand `folderPath` change (et est non-null) → lancer `loadScripts` dans un `useEffect`
- `loadScripts` :
  1. `setLoading(true)`, `setError(null)`, `setScripts([])`
  2. `await invoke<ScriptInfo[]>('list_scripts', { folder: folderPath })`
  3. Succès : `setScripts(result)`, `setLoading(false)`
  4. Erreur : `setError(String(err))`, `setLoading(false)`
- Rendu conditionnel :
  1. `folderPath === null` → `<p className="script-list__empty">Aucun dossier sélectionné</p>`
  2. `loading === true` → `<p className="script-list__loading">Chargement...</p>`
  3. `error !== null` → `<p className="script-list__error">{error}</p>`
  4. `scripts.length === 0` → `<p className="script-list__empty">Aucun script trouvé dans ce dossier</p>`
  5. Sinon → `<ul>` avec un `<li>` par script (cliquable)

**Format d'un item de liste :**
```tsx
<li
  key={script.path}
  className="script-list__item"
  onClick={() => onScriptSelected(script)}
>
  <span className="script-list__item-name">{script.name}</span>
  <span className="script-list__item-ext">.{script.extension}</span>
</li>
```

**Note ADR-01 :** L'extension est affichée séparément avec un point préfixé (`.{script.extension}`) pour permettre un styling distinct de l'extension vs le nom de base.

#### App.tsx mis à jour

```typescript
import { useState, useCallback } from 'react';
import FolderSelector from './components/FolderSelector';
import ScriptList from './components/ScriptList';
import { ScriptInfo } from './types';

export default function App(): JSX.Element {
  const [folderPath, setFolderPath] = useState<string | null>(null);

  const handleFolderSelected = useCallback((path: string) => {
    setFolderPath(path);
  }, []);

  const handleScriptSelected = useCallback((script: ScriptInfo) => {
    console.log('Script sélectionné :', script);
    // Sera étendu en S-07 pour exécuter le script
  }, []);

  return (
    <div className="app">
      <FolderSelector onFolderSelected={handleFolderSelected} />
      <ScriptList folderPath={folderPath} onScriptSelected={handleScriptSelected} />
    </div>
  );
}
```

## Dépendances

### Crates Rust à ajouter

Aucune.

### Packages npm à ajouter

Aucun — `@tauri-apps/api` est déjà présent.

## Décisions architecturales (ADR)

### ADR-01 : Séparation nom de base / extension dans l'affichage

- **Contexte :** La story dit "rendu sous forme d'item cliquable avec son nom et son extension". Deux options : afficher `name` complet (inclut l'extension) ou afficher séparément.
- **Options considérées :**
  1. Afficher `script.name` tel quel (nom complet avec extension)
  2. Afficher séparément nom de base et extension avec classes CSS différentes
- **Décision retenue :** Option 2 — `script.name` contient déjà l'extension (ex: `deploy.sh`). Afficher `.{script.extension}` dans un span séparé permet un style distinct (couleur accent) sans logique de parsing. Le nom de base `script.name` est affiché entier dans le premier span (lisibilité complète).
- **Conséquences :** Le CSS devra styler `.script-list__item-ext` séparément. L'extension est prefixée par un `.` dans le rendu.

### ADR-02 : Reset des états à chaque changement de folderPath

- **Contexte :** Quand l'utilisateur change de dossier, les states `scripts`, `loading`, `error` doivent être réinitialisés.
- **Options considérées :**
  1. Reset dans le `useEffect` avant l'invoke (dans la même fonction)
  2. Reset dans le `useEffect` via un effet séparé sur `folderPath`
- **Décision retenue :** Option 1 — Reset synchrone au début de `loadScripts` : `setLoading(true)`, `setError(null)`, `setScripts([])` avant l'invoke. Simple, prévisible, pas de flash d'état intermédiaire.
- **Conséquences :** À chaque changement de `folderPath`, il y aura un bref état `loading=true, scripts=[]`. C'est le comportement attendu.

### ADR-03 : useCallback pour onScriptSelected

- **Contexte :** `onScriptSelected` est passé en prop. Le Modernizer pourrait vouloir mémoïser les callbacks dans ScriptList.
- **Options considérées :**
  1. Passer `onScriptSelected` directement dans le onClick
  2. Mémoïser avec `useCallback` dans ScriptList
- **Décision retenue :** Option 1 dans ScriptList — la mémoïsation est responsabilité du parent (App.tsx utilise `useCallback`). ScriptList ne doit pas mémoïser des props venant du parent (anti-pattern).
- **Conséquences :** App.tsx DOIT utiliser `useCallback` pour `handleScriptSelected` (déjà prévu dans le contrat App.tsx).

### ADR-04 : Gestion d'erreur — cast de l'erreur catch

- **Contexte :** `invoke` rejette avec une valeur de type `unknown` en TypeScript strict.
- **Options considérées :**
  1. `setError((err as string))` — cast direct, risqué
  2. `setError(String(err))` — coerce en string, sûr
  3. `setError(err instanceof Error ? err.message : String(err))`
- **Décision retenue :** Option 2 — `String(err)`. Tauri rejette invoke avec un `string` Rust (pas un `Error` JS). `String(err)` coerce correctement `"message d'erreur"` sans brackets supplémentaires. Pas besoin de la complexité de l'option 3.
- **Conséquences :** Le message d'erreur affiché est le string Rust tel quel. Clair pour le debug.

## Edge cases à gérer

1. **folderPath null** → pas d'invoke, afficher "Aucun dossier sélectionné"
2. **Dossier vide** → invoke retourne `[]`, afficher "Aucun script trouvé dans ce dossier"
3. **Chemin invalide / dossier supprimé** → invoke rejette, afficher l'erreur Rust
4. **Changement rapide de dossier** → si l'utilisateur change de dossier pendant un chargement en cours, le résultat du premier invoke ne doit pas écraser le second. Gérer via cleanup `useEffect` (variable `cancelled`).
5. **Scripts avec noms longs** → le CSS doit gérer `overflow: hidden` / `text-overflow: ellipsis`
6. **ScriptInfo sans extension** → `extension` peut être vide string `""` → dans ce cas afficher seulement le nom sans le span extension (ou afficher `.` seul — à éviter)

## Contraintes de sécurité

- `core:default` permissions déjà configurées (S-04) permettent `invoke`
- Pas de nouvelle permission nécessaire — `list_scripts` est déjà exposée
- Le `folderPath` vient de `open({ directory: true })` Tauri — validé côté OS, pas de sanitization supplémentaire nécessaire
- Ne pas exposer le chemin dans le DOM au-delà de ce qui est nécessaire

## CSS requis

Classes CSS à créer dans `App.css` ou un fichier `ScriptList.css` :

```css
.script-list { /* conteneur */ }
.script-list__empty { /* message état vide */ }
.script-list__loading { /* message chargement */ }
.script-list__error { /* message erreur — couleur rouge/orange */ }
.script-list__items { /* liste ul */ }
.script-list__item { /* li cliquable */ }
.script-list__item:hover { /* hover state */ }
.script-list__item-name { /* nom du script */ }
.script-list__item-ext { /* extension — couleur accent */ }
```

**Choix :** Fichier séparé `ScriptList.css` importé dans `ScriptList.tsx` — cohérent avec la convention CSS modulaire par composant.
