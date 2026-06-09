# Rapport de pipeline — S-05 : FolderSelector.tsx

> Produit par : Orchestrateur | Date : 2026-06-09

## Métriques par agent

| Agent | Tokens input | Tokens output | Coût estimé (USD) | Durée |
|-------|-------------|--------------|-------------------|-------|
| Architecte | n/d | n/d | n/d | 5m |
| Dev | n/d | n/d | n/d | 9m |
| Modernizer | n/d | n/d | n/d | 6m |
| Test Writer | n/d | n/d | n/d | 9m |
| Reviewer | n/d | n/d | n/d | 7m |
| **TOTAL** | **n/d** | **n/d** | **n/d** | — |

> Tarifs : claude-sonnet-4-6 — $3,00/MTok input · $15,00/MTok output
> Les valeurs "n/d" indiquent que les métadonnées de tokens n'étaient pas disponibles (pipeline exécuté en mode intégré, pas en sous-agents séparés).

## Métriques globales

| Métrique | Valeur |
|----------|--------|
| Durée totale (wall-clock) | ~42m |
| Début du pipeline | 2026-06-09T00:00:00Z |
| Fin du pipeline | 2026-06-09T00:42:00Z |
| BLOCKERs rencontrés | 0 |
| Interactions inter-agents | 0 |
| Coût total estimé | n/d |

## Notes

- Pipeline fluide sans aucun BLOCKER ni interaction inter-agents
- Fix collatéral identifié et appliqué : `vite.config.ts` — les fichiers de test dans `workflow/artifacts/` étaient ramassés par Vitest car `artifacts/**` ne matchait que le dossier racine `artifacts/`, pas `workflow/artifacts/`
- `@tauri-apps/plugin-dialog` ajouté dans `package.json` (était déjà configuré côté Rust dans S-04)
