# Audit — S-10 : Streaming stdout temps-réel + bouton Stop

## Checklist qualité

### Code Rust

- [x] Aucun .unwrap() non justifié — tous les unwrap_or(-1) sont documentés (ADR-02)
- [x] Tous les Result sont gérés — propagation via ? ou map_err
- [x] Pas de chemins absolus hardcodés
- [x] cargo check passe sans warnings — vérifié
- [x] Permissions Tauri au minimum nécessaire — pas de permission supplémentaire requise pour emit

### Code TypeScript

- [x] Aucun `any` explicite ou implicite
- [x] Dépendances useEffect complètes — [isRunning] pour les listeners, [lines] pour auto-scroll, [script] pour reset
- [x] Tous les listeners Tauri ont un cleanup — via unlistenStdoutRef/unlistenDoneRef dans le return du useEffect
- [x] Props interfaces définies pour chaque composant — ScriptExecutorProps inchangé
- [x] tsc --noEmit passe — vérifié

### Tests

- [x] Cas nominaux couverts — streaming lignes, bouton Stop, script-done
- [x] Edge cases de arch_plan.md couverts — kill sans PID, PID → None après kill
- [x] Mocks Tauri correctement configurés — invoke et listen mockés
- [x] Pas de tests qui passent pour de mauvaises raisons

### Story

- [x] run_script_stream : spawn non-bloquant, stdout ligne par ligne, script-stdout émis, script-done à la fin
- [x] kill_script : SIGTERM-équivalent via Child.kill(), PID → None
- [x] run_script bloquant conservé (pas de breaking change)
- [x] Frontend ScriptExecutor : listen, auto-scroll, bouton Stop, zone vidée au nouveau run
- [x] Rien hors du périmètre Out of scope n'a été implémenté

## Problèmes détectés

### Bloquants (empêchent le merge)

Aucun.

### Non bloquants (à corriger dans une story ultérieure)

1. `script_runner.rs:288` — La commande `.ts` n'a pas de fallback npx dans `run_script_stream` (contrairement à `run_script`). Pour la cohérence, la même logique devrait être appliquée. Non bloquant car la story ne mentionne pas TypeScript dans le périmètre streaming.

2. `ScriptExecutor.tsx:128` — `hasOutput` dépend de `lines.length > 0 || exitCode !== null`. Si le script produit uniquement stderr (pas de stdout), la zone `Sortie standard` affichera `(vide)` mais ne sera visible qu'après script-done. Comportement acceptable mais potentiellement confusant.

### Observations (informatif)

1. La gestion du `stderr` collecté en bloc est conforme à la story (out of scope = streaming stderr).
2. Le pattern `useRef` pour les unlisten (ADR modernizer) est plus robuste que les variables locales.
3. L'interaction story/S-09 (branche parallèle) a causé des conflits de fichiers (config.rs manquant sur S-10) — résolu correctement par le Test Writer.

## Verdict

APPROUVÉ

Justification : tous les critères d'acceptation de la story sont adressés, les checks cargo check / tsc / cargo test / npm test passent. Le code est propre, idiomatique, et les tests couvrent les cas critiques de la story.
