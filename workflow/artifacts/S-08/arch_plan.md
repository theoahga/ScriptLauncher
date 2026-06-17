# Plan technique — S-08 : App Layout (two-panel layout)

> Produit par : Architecte | Date : 2026-06-17

## Compréhension de la story

S-08 restructure l'interface d'App.tsx pour passer d'un empilement vertical à un layout deux colonnes : sidebar gauche (FolderSelector + ScriptList) et panel droit (ScriptExecutor). Aucune logique métier ne change — c'est un refactoring pur CSS/structure.

## Périmètre technique

- Fichiers TypeScript à créer/modifier :
  - `ui/App.tsx` — restructuration du layout (ajout classes CSS two-panel)
  - `ui/App.css` — remplacement du layout centré par un grid/flex deux colonnes
  - `ui/components/Sidebar.tsx` — nouveau composant wrapper optionnel (recommandé pour lisibilité)
- Fichiers TypeScript inchangés :
  - `ui/components/FolderSelector.tsx` — aucune modification
  - `ui/components/ScriptList.tsx` — aucune modification
  - `ui/components/ScriptExecutor.tsx` — aucune modification
  - `ui/types.ts` — aucune modification
- Fichiers Rust à créer/modifier : aucun
- Fichiers de config à modifier : aucun

## Interfaces et contrats

### Commandes Tauri (Rust → Frontend)
Aucune nouvelle commande — S-08 est pur frontend.

### Events Tauri (Rust → Frontend)
Aucun nouvel event.

### Types partagés
Aucun nouveau type.

### Props des composants React

#### `Sidebar` (nouveau composant — optionnel mais recommandé)

```typescript
interface SidebarProps {
  children: React.ReactNode;
}
```

Ce composant est un simple wrapper layout : il ne gère pas d'état, ne fait pas d'invoke, ne reçoit pas de props métier. Il encapsule uniquement la structure HTML et les classes CSS de la sidebar.

#### `App` (modifié)

Pas de changement de signature — le composant ne reçoit pas de props externe (entry point). Seule la structure JSX retournée change :

```typescript
// Avant : empilement vertical
<div className="app">
  <FolderSelector ... />
  <ScriptList ... />
  <ScriptExecutor ... />
</div>

// Après : layout deux colonnes
<div className="app-shell">
  <aside className="sidebar">
    <FolderSelector ... />
    <ScriptList ... />
  </aside>
  <main className="main-panel">
    <ScriptExecutor ... />
  </main>
</div>
```

## Dépendances

### Crates Rust à ajouter
Aucune.

### Packages npm à ajouter
Aucun.

## Décisions architecturales (ADR)

### ADR-01 : Flexbox plutôt que CSS Grid pour le two-panel layout

- **Contexte** : La story autorise Grid ou Flexbox. Les deux sont valides pour un layout deux colonnes.
- **Options considérées** :
  1. CSS Grid : `grid-template-columns: 260px 1fr`
  2. CSS Flexbox : `display: flex; flex-direction: row`
- **Décision retenue** : Flexbox. Raisons : (a) le layout est simple (deux zones, pas de grille complexe), (b) les composants existants utilisent déjà flexbox, (c) le comportement responsive (min-width: 900px) est trivial à gérer.
- **Conséquences** : La sidebar a une width fixe (`260px`), le main panel prend le reste avec `flex: 1`. Overflow interne géré par `overflow-y: auto` sur chaque panneau.

### ADR-02 : `Sidebar.tsx` comme composant wrapper dédié

- **Contexte** : La story mentionne Sidebar.tsx comme optionnel.
- **Options considérées** :
  1. Tout inline dans App.tsx (plus simple)
  2. Sidebar.tsx comme composant dédié
- **Décision retenue** : Créer `Sidebar.tsx`. Raisons : (a) sépare les responsabilités, (b) facilite les tests unitaires du layout sidebar indépendamment du reste, (c) prépare S-09 (config multi-catégories) qui pourra enrichir la sidebar sans toucher App.tsx.
- **Conséquences** : Un fichier supplémentaire (`Sidebar.tsx`), mais App.tsx reste lisible et les tests couvrent chaque partie indépendamment.

### ADR-03 : `height: 100vh` sur l'app-shell, scroll interne par panneau

- **Contexte** : La story demande que l'app soit utilisable à partir de 900px sans overflow horizontal, et que chaque panneau ait son propre scroll interne.
- **Décision retenue** : L'élément root `.app-shell` prend toute la hauteur viewport (`height: 100vh`, `overflow: hidden`). Chaque panneau (`.sidebar`, `.main-panel`) a `overflow-y: auto` pour son propre scroll interne.
- **Conséquences** : Empêche le scroll global de la page. Nécessite que `body` n'ait pas `overflow: hidden` (à vérifier dans App.css actuel).

### ADR-04 : Renommer `.app` en `.app-shell` dans App.css

- **Contexte** : La classe `.app` actuelle centre le contenu avec `align-items: center; justify-content: center` — incompatible avec le layout deux colonnes.
- **Décision retenue** : Remplacer `.app` par `.app-shell` avec les nouvelles règles layout. La classe `app` dans App.tsx devient `app-shell`.
- **Conséquences** : Si d'autres fichiers référencent `.app`, ils devront être mis à jour. Vérification : seul `App.tsx` utilise cette classe.

## Edge cases à gérer

1. **Viewport étroit (< 900px)** : L'app doit rester utilisable — pas d'overflow horizontal. La sidebar garde sa largeur fixe. En dessous de 900px, un scroll horizontal peut apparaître (comportement acceptable selon la story).
2. **Script non sélectionné** : Le panel droit affiche ScriptExecutor avec son état vide ("Aucun script sélectionné") — ce cas est déjà géré par ScriptExecutor.
3. **Liste de scripts très longue** : La sidebar doit scroller verticalement sans affecter le panel droit — géré par `overflow-y: auto` sur `.sidebar`.
4. **Output script très long** : Le panel droit doit scroller verticalement sans affecter la sidebar — géré par `overflow-y: auto` sur `.main-panel`.
5. **Snapshot de test existant** : Le test `App.test.tsx` a un snapshot qui sera cassé par le changement de structure — il faudra régénérer le snapshot (`npm run test -- --update-snapshots`).

## Contraintes de sécurité

Aucune — S-08 est pur CSS/structure, aucun invoke Tauri, aucune permission Tauri.

## Checklist de validation

```bash
npx tsc --noEmit    # vérifier les types TypeScript
npm run test        # vérifier les tests Vitest (3 cas minimum requis par la story)
```
