# Audit — S-06 : ScriptList.tsx

> Produit par : Reviewer | Date : 2026-06-09

## Checklist qualité

### Code Rust
- N/A — Aucun code Rust dans cette story.

### Code TypeScript
- [x] Aucun `any` explicite ou implicite
- [x] Dépendances useEffect complètes (`[folderPath]` — correct)
- [x] Pas de listeners Tauri dans cette story — N/A pour cleanup
- [x] Props interfaces définies pour chaque composant (`ScriptListProps` dans ScriptList.tsx, `ScriptInfo` dans types.ts)
- [x] `tsc --noEmit` passe — vérifié (aucune erreur)

### Tests
- [x] Cas nominaux couverts (loading, liste avec items, clic → callback)
- [x] Edge cases de arch_plan.md couverts (folderPath null, dossier vide, erreur Rust, changement de dossier, script sans extension)
- [x] Mock Tauri (`@tauri-apps/api/core`) correctement configuré avec `vi.mock`
- [x] Assertions précises (vérification des paramètres invoke, du script passé à onScriptSelected)

### Story
- [x] `ScriptList` créé dans `ui/components/ScriptList.tsx` ✅
- [x] Reçoit `folderPath: string | null` en prop ✅
- [x] `folderPath === null` → "Aucun dossier sélectionné" ✅
- [x] Appelle `list_scripts` via `invoke` quand `folderPath` non-null ✅
- [x] Pendant chargement → "Chargement..." ✅
- [x] Liste vide → "Aucun script trouvé dans ce dossier" ✅
- [x] Erreur → affiche le message Rust ✅
- [x] Script → item cliquable avec nom et extension ✅
- [x] Clic → `onScriptSelected(script)` appelé ✅
- [x] `npx tsc --noEmit` passe ✅
- [x] Tests Vitest ≥ 5 cas — 10 tests produits ✅
- [x] Rien hors du périmètre Out of scope implémenté — vérifié ✅

## Problèmes détectés

### Bloquants (empêchent le merge)

Aucun bloquant identifié.

### Non bloquants (à corriger dans une story ultérieure)

1. **ScriptList.tsx — accessibilité** : Les `<li>` cliquables n'ont pas de `role="button"` ni de gestion clavier (`onKeyDown`). Un utilisateur clavier ne peut pas sélectionner un script. À adresser en S-08 (accessibilité globale) ou comme amélioration dans une story dédiée.

2. **App.css — layout** : Le `.app` est `display: flex; align-items: center; justify-content: center` centrant tout verticalement au milieu de l'écran. Avec ScriptList ajouté, l'ensemble FolderSelector + ScriptList sera centré mais sans direction de colonne explicite (`flex-direction: column` manquant). En pratique les éléments se disposent en ligne — à ajuster en S-08 pour le layout final.

### Observations (informatif)

1. **Race condition correctement gérée** : Le flag `cancelled` dans le useEffect cleanup est un pattern robuste. Bien implémenté.

2. **key={script.path}** : Utiliser le chemin complet comme clé React est un bon choix — unique par définition pour des fichiers sur le même FS.

3. **`String(err)` pour les erreurs Tauri** : Choix conforme à ADR-04. Le message d'erreur Rust est passé tel quel — utile pour le debug en S-06, à éventuellement nettoyer/localiser en S-08.

## Verdict

**APPROUVÉ**

Justification : Tous les critères d'acceptation de la story sont implémentés. TypeScript sans erreur, 10 tests passent, code idiomatique. Deux non-bloquants d'accessibilité/layout à adresser en S-08 n'empêchent pas le merge.
