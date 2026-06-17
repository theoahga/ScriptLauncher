# Retrospective — S-08 : App Layout (two-panel layout)

> Produite par : Orchestrateur | Date : 2026-06-17
> Note de fluidité : 5/5

## Ce qui a bien fonctionné

- **Périmètre clair** : S-08 est explicitement un refactoring pur CSS/structure — le champ "Out of scope" de la story a éliminé toute ambiguïté sur ce qui devait ou ne devait pas être fait.
- **ADR pertinents** : L'Architecte a produit 4 ADR couvrant les décisions non triviales (Flexbox vs Grid, composant Sidebar.tsx, height 100vh + scroll interne, renommage .app → .app-shell). Ces ADR ont guidé le Dev sans ambiguïté.
- **Aucun BLOCKER** : Pipeline fluide du début à la fin — aucune interaction inter-agents nécessaire.
- **Tests précis** : Le Test Writer a utilisé `closest('aside.sidebar')` et `closest('main.main-panel')` pour vérifier le placement des composants dans la structure, pas seulement leur présence dans le DOM — assertions structurelles fortes.
- **Snapshot régénéré proprement** : La suppression du snapshot stale et la régénération en un passage évite les faux positifs post-refactoring.

## Frictions identifiées

| # | Friction | Impact | Threads concernés |
|---|---------|--------|------------------|
| 1 | Le prompt Dev référence `src/` comme répertoire frontend alors que le projet utilise `ui/` | Mineur (corrigé par les instructions de mission) | — |

Détail friction 1 : le prompt `02_dev.md` liste `src/App.tsx`, `src/components/` etc. dans les exemples de structure alors que ce projet utilise `ui/`. Cette divergence était connue et corrigée dans les instructions de l'orchestrateur, mais elle pourrait induire en erreur un sous-agent spawné naïvement.

## Suggestions d'amélioration du workflow

### Suggestion 1 : Corriger les chemins `src/` → `ui/` dans les prompts Dev et Architecte

**Contexte** : Les prompts `02_dev.md` et `01_architect.md` référencent `src/` pour le frontend alors que ce projet utilise `ui/`. Cette incohérence est systématiquement compensée dans les instructions de l'orchestrateur mais représente un overhead mental à chaque story.

**Proposition** : Mettre à jour `02_dev.md` et `01_architect.md` pour utiliser `ui/` comme répertoire frontend de référence, ou introduire une variable de configuration dans CLAUDE.md.

**Agent cible** : `dev`, `architect`

**Candidat EVOLVE** : OUI

**Priorité** : Moyenne

### Suggestion 2 : Documenter la convention de snapshot dans le prompt Test Writer

**Contexte** : En S-08, le Test Writer a dû supprimer le snapshot stale et le régénérer. Ce cas (snapshot cassé par refactoring volontaire) n'est pas documenté dans `04_test_writer.md`.

**Proposition** : Ajouter dans `04_test_writer.md` une règle : "Si un refactoring de structure HTML est prévu (ex: changement de classe root, ajout de wrapper), supprimer les snapshots existants avant de lancer les tests et les régénérer avec `npm run test -- --run`."

**Agent cible** : `test_writer`

**Candidat EVOLVE** : OUI

**Priorité** : Basse

## Récapitulatif des candidats EVOLVE

| # | Suggestion | Agent cible | Priorité |
|---|-----------|-------------|---------|
| 1 | Corriger les chemins `src/` → `ui/` dans les prompts | `dev`, `architect` | Moyenne |
| 2 | Documenter la convention de snapshot pour les refactorings | `test_writer` | Basse |

> Ces candidats seront transmis à l'agent Méta après merge, sous forme de messages EVOLVE.

## Note de fluidité

**5/5** — Aucun BLOCKER, aucune interaction inter-agents, aucune correction post-Review. Le périmètre minimal et bien délimité de S-08 (refactoring pur structure, zéro Rust) a permis un pipeline parfaitement fluide.

_Échelle : 1 = très chaotique (nombreux BLOCKERs, corrections majeures post-Review) ;
5 = fluide (aucun BLOCKER, pas de correction post-Review, interactions minimales)_
