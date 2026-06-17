# Retrospective — S-10 : Streaming stdout temps-réel + bouton Stop

> Produite par : Orchestrateur | Date : 2026-06-17
> Note de fluidité : 3/5

## Ce qui a bien fonctionné

- La décision ADR-02 (stocker `Child` tokio plutôt que PID u32) s'est révélée excellente : kill cross-plateforme sans dépendance `nix`, code plus propre.
- Le modernizer a identifié un vrai problème de pattern (unlisten via variables locales → race condition potentielle) et l'a corrigé proprement avec useRef.
- Les tests Rust async (tokio::test) pour kill_script ont bien fonctionné avec la logique extraite directement du state.
- cargo check et tsc --noEmit ont validé chaque étape sans erreur (après le fix de l'import Emitter).

## Frictions identifiées

| # | Friction | Impact | Threads concernés |
|---|---------|--------|------------------|
| 1 | Branche story/S-09 tournant en parallèle → switch automatique de branche entre les opérations | Ralentissement significatif | Tous |
| 2 | lib.rs contenant `mod config` (S-09) commité sur story/S-10 par confusion de contexte | Bloquant compilateur résolu manuellement | test-done-S-10 |
| 3 | Import `tauri::Emitter` absent → erreur cargo check au premier run | Mineur (1 correction) | dev-done-S-10 |
| 4 | Test Vitest Cas 6 (zone vidée) : assertion incorrecte sur pre absent vs pre vide | Mineur (1 correction de test) | test-done-S-10 |

## Suggestions d'amélioration du workflow

### Suggestion 1 : Isoler le contexte de branche dans les pipelines parallèles

**Contexte** : Une story S-09 tournait en parallèle, causant des conflits de branches git.
**Proposition** : Documenter dans 00_orchestrator.md que le pipeline doit vérifier l'absence de stash/branches modifiées avant chaque opération git.
**Agent cible** : orchestrator
**Candidat EVOLVE** : OUI
**Priorité** : Haute

### Suggestion 2 : Vérifier l'absence de modules fantômes avant implémentation Dev

**Contexte** : lib.rs a été contaminé par une référence à `mod config` (issue parallèle) et ça n'a été détecté qu'à l'étape Test.
**Proposition** : Dev doit exécuter `cargo check` immédiatement après avoir modifié lib.rs, avant de continuer.
**Agent cible** : dev
**Candidat EVOLVE** : NON (déjà dans les standards : cargo check après chaque modification)
**Priorité** : Basse

### Suggestion 3 : Tests async Rust → préciser que tokio::test est disponible

**Contexte** : Les tests kill_script sont async et nécessitent `#[tokio::test]`. Ce n'est pas documenté dans 04_test_writer.md.
**Proposition** : Ajouter dans les standards Test Writer : "Pour les tests async Rust utilisant tokio, utiliser `#[tokio::test]` au lieu de `#[test]`."
**Agent cible** : test_writer
**Candidat EVOLVE** : OUI
**Priorité** : Moyenne

## Récapitulatif des candidats EVOLVE

| # | Suggestion | Agent cible | Priorité |
|---|-----------|-------------|---------|
| 1 | Isoler contexte branche dans pipelines parallèles | orchestrator | Haute |
| 2 | Documenter #[tokio::test] pour tests async Rust | test_writer | Moyenne |

> Ces candidats seront transmis à l'agent Méta après merge, sous forme de messages EVOLVE.

## Note de fluidité

**3/5** — Pipeline techniquement réussi (0 BLOCKER formel, tous les critères adressés, 96 tests passent), mais significativement perturbé par la concurrence de la branche story/S-09 qui a causé 3 interventions manuelles (stash, reset, fix lib.rs). Sans cette friction externe, le pipeline aurait été 5/5.

_Échelle : 1 = très chaotique ; 5 = fluide_
