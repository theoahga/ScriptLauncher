# Plan technique — S-05 : FolderSelector.tsx

> Produit par : Architecte | Date : 2026-06-09

## Compréhension de la story

Créer un composant React `FolderSelector` qui permet à l'utilisateur de sélectionner un dossier via la dialog native Tauri, puis notifie le parent via callback. Ce composant remplace le placeholder actuel dans `App.tsx`.

## Périmètre technique

- Fichiers Rust à créer/modifier : **aucun** (S-04 a déjà configuré `dialog:allow-open`)
- Fichiers TypeScript à créer/modifier :
  - `ui/components/FolderSelector.tsx` — nouveau composant
  - `ui/App.tsx` — intégration du composant (remplace le placeholder)
- Fichiers de config à modifier : **aucun**

## Interfaces et contrats

### Commandes Tauri (Rust → Frontend)

Aucune nouvelle commande Tauri nécessaire. La story utilise directement le plugin Tauri via l'API JavaScript :

```typescript
import { open } from '@tauri-apps/plugin-dialog';
// open({ directory: true }) → Promise<string | null>
```

### Events Tauri (Rust → Frontend)

Aucun event nécessaire pour cette story.

### Types partagés

Aucun type Rust/TypeScript partagé nouveau.

### Props des composants React

#### FolderSelector

```typescript
interface FolderSelectorProps {
  onFolderSelected: (path: string) => void;
}

export default function FolderSelector({ onFolderSelected }: FolderSelectorProps): JSX.Element
```

**Comportement interne :**
- État local : `selectedPath: string | null` (initialement `null`)
- Au clic sur "Sélectionner un dossier" :
  1. Appel `open({ directory: true })`
  2. Si résultat `string` non-null → `setSelectedPath(result)` + `onFolderSelected(result)`
  3. Si résultat `null` → aucun changement (utilisateur a annulé)
- Affichage du chemin sélectionné sous le bouton (uniquement si `selectedPath !== null`)

#### App.tsx modifié

```typescript
// App.tsx — intégration FolderSelector
import FolderSelector from './components/FolderSelector';

export default function App(): JSX.Element {
  const handleFolderSelected = (path: string) => {
    console.log('Dossier sélectionné :', path);
    // Sera étendu en S-06 pour passer à ScriptList
  };

  return (
    <div className="app">
      <FolderSelector onFolderSelected={handleFolderSelected} />
    </div>
  );
}
```

## Dépendances

### Crates Rust à ajouter

Aucune.

### Packages npm à ajouter

```
@tauri-apps/plugin-dialog
```

**Statut :** Déjà installé via S-04 (configuré dans capabilities). À vérifier dans `package.json`. Si absent, ajouter via `npm install @tauri-apps/plugin-dialog`.

## Décisions architecturales (ADR)

### ADR-01 : État local vs état global pour le chemin sélectionné

- **Contexte :** Le chemin du dossier sélectionné pourrait être stocké dans un état global (Context, Zustand) ou localement dans `App.tsx`.
- **Options considérées :**
  1. État local dans `FolderSelector` → remonté via callback `onFolderSelected`
  2. Context React global
  3. État dans `App.tsx` uniquement
- **Décision retenue :** Option 1 — état local dans `FolderSelector`, callback pour notifier le parent. Simple, testable, pas de couplage fort. `App.tsx` gère l'état au niveau approprié pour S-05.
- **Conséquences :** `App.tsx` devra stocker le chemin si nécessaire pour le passer à `ScriptList` (S-06). Pattern établi pour les stories suivantes.

### ADR-02 : Gestion de l'annulation dialog

- **Contexte :** `open({ directory: true })` retourne `string | null`. Le `null` signifie annulation ou erreur.
- **Options considérées :**
  1. Ignorer le `null` silencieusement (aucun changement d'état)
  2. Afficher un message "Annulé"
  3. Distinguer annulation (null) et erreur (catch)
- **Décision retenue :** Option 3 partielle — `null` = annulation silencieuse, erreur `catch` = log console uniquement (pas d'affichage utilisateur en S-05). La story précise "si annule → aucun changement d'état, pas d'erreur affichée".
- **Conséquences :** Les erreurs inattendues (permissions OS) ne remontent pas à l'UI en S-05. À adresser en S-08 si nécessaire.

### ADR-03 : Import du plugin dialog

- **Contexte :** `@tauri-apps/plugin-dialog` doit être importé. La version 2 du plugin expose `open` depuis `@tauri-apps/plugin-dialog`.
- **Décision retenue :** `import { open } from '@tauri-apps/plugin-dialog'` — import direct de la fonction.
- **Conséquences :** Le mock Vitest devra mocker `@tauri-apps/plugin-dialog` (pas `@tauri-apps/api/core`).

## Edge cases à gérer

1. **Annulation dialog** — `open()` retourne `null` → ne pas appeler `onFolderSelected`, ne pas modifier `selectedPath`
2. **Erreur inattendue** — `open()` lance une exception → catch silencieux (console.error uniquement), pas de changement d'état
3. **Double-clic rapide** — l'utilisateur clique deux fois vite → ne pas désactiver le bouton (hors scope S-05), la dialog Tauri gère le cas nativement
4. **Chemin très long** — affichage du chemin sous le bouton → utiliser `word-break: break-all` ou `overflow: hidden` avec ellipsis en CSS
5. **Premier rendu** — `selectedPath` est `null` → l'affichage sous le bouton est absent (pas de texte vide ni de placeholder)

## Contraintes de sécurité

- `dialog:allow-open` est déjà configuré dans `capabilities/default.json` (S-04)
- Aucune nouvelle permission requise
- Ne pas exposer le chemin sélectionné en dehors du callback (pas de side effects globaux)
- Le chemin retourné par Tauri est validé côté OS — pas de sanitization supplémentaire requise pour l'affichage
