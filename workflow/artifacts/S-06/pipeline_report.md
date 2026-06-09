# Rapport de pipeline — S-06 : ScriptList.tsx

> Produit par : Orchestrateur | Date : 2026-06-09

## Métriques par agent

| Agent | Tokens input | Tokens output | Coût estimé (USD) | Durée |
|-------|-------------|--------------|-------------------|-------|
| Architecte | n/d | n/d | n/d | ~5m |
| Dev | n/d | n/d | n/d | ~15m |
| Modernizer | n/d | n/d | n/d | ~5m |
| Test Writer | n/d | n/d | n/d | ~15m |
| Reviewer | n/d | n/d | n/d | ~5m |
| **TOTAL** | **n/d** | **n/d** | **n/d** | — |

> Tarifs : claude-sonnet-4-6 — $3,00/MTok input · $15,00/MTok output
> Les valeurs "n/d" indiquent que les métadonnées de tokens n'étaient pas disponibles (pipeline exécuté en mode synchrone par l'orchestrateur).

## Métriques globales

| Métrique | Valeur |
|----------|--------|
| Durée totale (wall-clock) | ~45m |
| Début du pipeline | 2026-06-09T00:00:00Z |
| Fin du pipeline | 2026-06-09T01:05:00Z |
| BLOCKERs rencontrés | 0 |
| Interactions inter-agents | 0 (pipeline fluide, aucun ASK/CHALLENGE) |
| Coût total estimé | n/d |

## Notes

- Pipeline sans BLOCKER ni interaction inter-agents
- Un ajustement technique identifié en cours de route : `@testing-library/user-event` non installé → remplacé par `fireEvent` du même package déjà disponible (`@testing-library/react`)
- Snapshot `App.test.tsx` mis à jour suite à l'intégration de ScriptList dans App — comportement attendu, non un BLOCKER
