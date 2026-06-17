# Story S-08 — App Layout (sidebar + output panel)

**ID :** S-08  
**Titre :** App Layout — two-panel layout  
**Dépend de :** S-07 (ScriptExecutor opérationnel)  
**Branche :** story/S-08

## Description

En tant qu'utilisateur,
je veux une interface à deux colonnes (sidebar à gauche, zone d'output à droite),
afin que la liste des scripts et la sortie soient visibles simultanément sans scroll vertical.

## Critères d'acceptation

- `App.tsx` est restructuré avec un layout CSS deux colonnes :
  - **Sidebar** (gauche, largeur fixe ~260px, scroll interne) : contient la liste des scripts
  - **Main panel** (droite, largeur flexible, scroll interne) : contient la zone d'exécution / output
- Un composant `AppShell.tsx` (ou layout inline dans `App.tsx`) encapsule la structure HTML
- La sidebar affiche toujours le contenu de `ScriptList` ; le panel droit affiche `ScriptExecutor`
- L'app est utilisable à partir de 900px de large sans overflow horizontal
- Le layout utilise CSS Grid ou Flexbox (pas de bibliothèque tierce)
- `FolderSelector` est déplacé en haut de la sidebar (ou dans une topbar minimaliste)
- `npx tsc --noEmit` passe sans erreur
- Tests Vitest : au moins 3 cas (rendu structure deux colonnes, sidebar visible, panel droit visible)

## Structure cible

```
ui/
├── App.tsx                     # restructuré
├── App.css                     # layout principal (grid/flex)
├── components/
│   ├── Sidebar.tsx             # (optionnel) wrapper sidebar
│   ├── FolderSelector.tsx      # inchangé
│   ├── ScriptList.tsx          # inchangé
│   └── ScriptExecutor.tsx      # inchangé
```

## Out of scope

- Thème / design system (couleurs, typographie) — S-08 pose uniquement la structure
- Config multi-catégories (S-09)
- Streaming stdout (S-10)
- Historique (S-11)
- Redimensionnement de la sidebar par l'utilisateur (drag-to-resize)

## Contexte technique

Structure actuelle du frontend (après S-07) :
```
ui/
├── App.tsx          # FolderSelector + ScriptList + ScriptExecutor empilés verticalement
├── App.css          # styles existants
├── components/
│   ├── FolderSelector.tsx
│   ├── ScriptList.tsx
│   ├── ScriptList.css
│   ├── ScriptExecutor.tsx
│   └── ScriptExecutor.css
├── types.ts
└── main.tsx
```

Chemin du projet : `/Users/theoclere/Development/ScriptLauncher`  
Branche de départ : `story/S-07` (ou `main` si S-07 mergée)

**Note :** S-08 est un refactoring pur CSS/structure — aucune logique métier ne change. Les props et interfaces des composants existants ne bougent pas.
