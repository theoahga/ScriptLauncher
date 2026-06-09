# Retrospective — S-05 : FolderSelector.tsx

> Produite par : Orchestrateur | Date : 2026-06-09
> Note de fluidité : 5/5

## Ce qui a bien fonctionné

- Story purement frontend sans code Rust : périmètre très clair, zéro ambiguïté architecturale
- L'arch_plan.md était complet avec 3 ADR pertinents, 5 edge cases documentés — le Dev n'a pas eu à improviser
- Le mock `@tauri-apps/plugin-dialog` est propre et couvre tous les cas (null, string, exception)
- Le Modernizer a identifié exactement les bons points (`useCallback`, `type="button"`) sans sur-moderniser
- Les 7 tests FolderSelector couvrent tous les edge cases de l'arch_plan.md

## Frictions identifiées

| # | Friction | Impact | Threads concernés |
|---|---------|--------|------------------|
| 1 | `@tauri-apps/plugin-dialog` absent de `package.json` malgré S-04 | Ralentissement mineur — installation en cours de pipeline | — |
| 2 | `vite.config.ts` excluait `artifacts/**` mais pas `workflow/artifacts/**` | Ralentissement mineur — 3 suites de tests artifacts échouaient | — |

### Analyse narrative

**Friction 1 — Plugin manquant dans package.json :**
S-04 a configuré le plugin côté Rust (Cargo.toml, capabilities) mais n'a pas ajouté `@tauri-apps/plugin-dialog` dans le `package.json` frontend. Ce gap entre la couche Rust et la couche npm est un risque récurrent pour les stories qui utilisent des plugins Tauri. Le Test Writer ou le Dev devrait systématiquement vérifier la présence du package npm quand un plugin Tauri est utilisé côté frontend.

**Friction 2 — Pattern d'exclusion Vitest trop étroit :**
Le pattern `artifacts/**` dans `vite.config.ts > test.exclude` ne matche que le dossier `artifacts/` à la racine, pas `workflow/artifacts/`. Les fichiers de test artifacts (S-01, S-05) étaient ramassés par Vitest et échouaient avec des erreurs de résolution de chemins. Corrigé en ajoutant `workflow/**`.

## Suggestions d'amélioration du workflow

### Suggestion 1 : Vérification package npm pour les plugins Tauri

**Contexte** : S-05 a requis l'installation manuelle de `@tauri-apps/plugin-dialog` bien que le plugin soit configuré côté Rust depuis S-04.
**Proposition** : L'Architecte doit systématiquement lister dans "Packages npm à ajouter" tout plugin Tauri utilisé côté frontend, même si le Rust est déjà configuré.
**Agent cible** : architect (01_architect.md)
**Candidat EVOLVE** : OUI
**Priorité** : Moyenne

### Suggestion 2 : Pattern d'exclusion Vitest robuste

**Contexte** : Le pattern `artifacts/**` dans vite.config.ts ne couvre pas les sous-dossiers imbriqués comme `workflow/artifacts/`.
**Proposition** : Standardiser le pattern d'exclusion à `**/workflow/**` pour couvrir tous les artefacts du workflow, quelle que soit la profondeur.
**Agent cible** : dev (02_dev.md) — règle dans les standards de code
**Candidat EVOLVE** : OUI
**Priorité** : Basse

## Récapitulatif des candidats EVOLVE

| # | Suggestion | Agent cible | Priorité |
|---|-----------|-------------|---------|
| 1 | Vérification package npm pour les plugins Tauri dans arch_plan.md | architect | Moyenne |
| 2 | Pattern d'exclusion Vitest `**/workflow/**` dans les standards | dev | Basse |

> Ces candidats seront transmis à l'agent Méta après merge, sous forme de messages EVOLVE.

## Note de fluidité

**5/5** — Pipeline fluide sans aucun BLOCKER ni interaction inter-agents. Les deux frictions identifiées (package npm manquant, pattern Vitest) ont été résolues directement par les agents sans escalade. Le scope de la story était parfaitement délimité.

_Échelle : 1 = très chaotique (nombreux BLOCKERs, corrections majeures post-Review) ;
5 = fluide (aucun BLOCKER, pas de correction post-Review, interactions minimales)_
