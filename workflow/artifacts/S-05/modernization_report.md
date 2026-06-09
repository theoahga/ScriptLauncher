# Rapport de modernisation — S-05

> Produit par : Modernizer | Date : 2026-06-09

## Fichiers modifiés

- `ui/components/FolderSelector.tsx` — 2 changements
- `ui/App.tsx` — 2 changements

## Changements

### FolderSelector.tsx

**Changement 1** — ligne 1 (imports) et ligne 14 (handleClick)
- Règle : `useCallback` pour stabiliser les références de fonction
- Avant : `handleClick` définie sans `useCallback`, recréée à chaque render
- Après : `handleClick` wrappée dans `useCallback([onFolderSelected])` — dépendance correcte sur `onFolderSelected`
- Impact comportemental : aucun (uniquement optimisation de référence — évite re-renders si le parent mémoïse)

**Changement 2** — balise `<button>`
- Règle : attribut `type="button"` explicite sur tout `<button>` hors formulaire
- Avant : `<button className="..." onClick={handleClick}>` — type implicite "submit" dans certains contextes
- Après : `<button type="button" ...>` — type explicite "button"
- Impact comportemental : prévient un comportement inattendu si le composant est placé dans un `<form>` futur

### App.tsx

**Changement 1** — import `useCallback` ajouté
- Règle : importer uniquement les hooks utilisés, ne pas mélanger les imports React
- Avant : pas d'import `useCallback`
- Après : `import { useCallback } from "react"` ajouté

**Changement 2** — `handleFolderSelected` wrappée dans `useCallback`
- Règle : les callbacks passés en props doivent avoir une référence stable pour éviter les re-renders inutiles de `FolderSelector`
- Avant : `const handleFolderSelected = (path: string) => { ... }` — recréée à chaque render d'App
- Après : `const handleFolderSelected = useCallback((path: string) => { ... }, [])` — dépendances vides car pas d'état externe capturé
- Impact comportemental : aucun (FolderSelector ne mémoïse pas encore, mais le pattern est établi pour S-06+)

## Aucun BLOQUANT détecté

La logique métier est correcte :
- Annulation (`null`) gérée silencieusement ✅
- Erreur catchée avec `console.error` ✅
- Pas de `.unwrap()` ni de side effects globaux ✅
- Types stricts, pas de `any` ✅

## Aucun changement appliqué à

Aucun autre fichier dans le périmètre S-05.
