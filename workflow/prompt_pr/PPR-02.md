# Prompt PR — PPR-02 : Télémétrie et Retrospective IA de fin de pipeline

> Version : 1.0
> Produite par : Agent Méta
> Date : 2026-06-06
> Déclencheur : Demande utilisateur (thread meta-req-002)

---

## Résumé

Cette PR enrichit la fin de chaque pipeline de story avec deux artefacts systématiques :

1. **`pipeline_report.md`** — rapport de télémétrie lisible par l'utilisateur : tokens consommés par agent, coût estimé en USD, temps total, nombre de BLOCKERs et d'interactions inter-agents.
2. **`retrospective.md`** — analyse IA du workflow de la story : ce qui a bien fonctionné, les frictions identifiées, les suggestions d'amélioration concrètes (avec signalement des candidats EVOLVE potentiels).

Ces deux artefacts sont produits par l'orchestrateur, juste avant de présenter la PR finale à l'utilisateur. Ils ne bloquent pas le pipeline — ils l'enrichissent.

---

## Analyse des options

### Option A — Collecte des métriques par chaque agent lui-même

Chaque agent emballe ses métriques dans son message `NOTIFY` de fin. L'orchestrateur les agrège.

- Avantage : données précises à la source.
- Inconvénient : nécessite de modifier tous les prompts d'agents pour imposer un format de métriques. Coût de coordination élevé, risque de divergence de format.

### Option B — Collecte centralisée par l'orchestrateur (retenue)

L'orchestrateur note l'heure de début et de fin de chaque activation d'agent. Il estime les tokens à partir des tailles d'artefacts d'entrée/sortie si les métadonnées exactes ne sont pas disponibles.

- Avantage : zéro modification des agents spécialisés, vue centralisée cohérente.
- Inconvénient : les tokens sont des estimations si les sous-agents Claude Code ne retournent pas leurs métadonnées de manière programmatique.

**Décision retenue : Option B.** L'orchestrateur collecte les métriques. Un champ `metrics` est ajouté à `pipeline_state.json` pour accumuler les données en temps réel. En mode Claude Code CLI, les durées sont mesurées via les timestamps du bus ; les tokens sont soit issus des métadonnées de sous-agents (quand disponibles), soit estimés sur la base des tailles d'artefacts (fallback explicitement noté dans le rapport).

---

### Option A — La retrospective produite par le Reviewer

Le Reviewer intègre une section retrospective dans son audit.

- Avantage : le Reviewer a déjà une vue sur tous les artefacts.
- Inconvénient : mélange deux responsabilités (audit qualité code ≠ analyse du workflow). Le Reviewer n'a pas accès au bus ni aux métriques de pipeline.

### Option B — La retrospective produite par l'orchestrateur (retenue)

Après le verdict du Reviewer, l'orchestrateur analyse le bus complet, les métriques accumulées et le pipeline_state pour produire une vue systémique.

- Avantage : l'orchestrateur a accès à tout — bus, métriques, état, interactions. C'est la vue la plus complète pour une analyse de workflow.
- Inconvénient : l'orchestrateur devient responsable d'un troisième artefact de fin de pipeline.

**Décision retenue : Option B.** La retrospective est produite par l'orchestrateur, après le verdict du Reviewer, en même temps que le `pipeline_report.md`. Le Reviewer reste focalisé sur l'audit qualité du code.

---

### Stockage des métriques : fichier dédié vs section dans pipeline_state.json

Un fichier `pipeline_metrics.json` dédié isole les données brutes, mais crée un fichier supplémentaire à maintenir.

**Décision retenue : section `metrics` dans `pipeline_state.json`.** Les métriques sont des données d'état du pipeline. Les regrouper dans le fichier d'état existant évite la prolifération de fichiers. Le rapport lisible par l'utilisateur reste dans `pipeline_report.md`.

---

## Propositions incluses

| # | Changement | Agent cible | Type |
|---|------------|-------------|------|
| 1 | Collecte de métriques en temps réel dans `pipeline_state.json` | orchestrateur | `rule_addition` |
| 2 | Production de `pipeline_report.md` en fin de pipeline | orchestrateur | `rule_addition` |
| 3 | Production de `retrospective.md` en fin de pipeline | orchestrateur | `rule_addition` |
| 4 | Mise à jour du format de rapport à l'utilisateur | orchestrateur | `rule_change` |
| 5 | Mise à jour de `pipeline_state.json` (champ `metrics`) | orchestrateur | `structural_change` |
| 6 | Mise à jour de la section artefacts dans `CLAUDE.md` | CLAUDE.md | `rule_addition` |

---

## Changements proposés

### `agents/00_orchestrator.md`

**Section : Ce que tu maintiens → pipeline_state.json**

Remplacement du schéma actuel de `pipeline_state.json` :

```diff
 {
   "story_id": "S-XX",
   "story_title": "...",
   "status": "in_progress",
   "active_agents": ["arch", "dev"],
   "active_threads": ["dev-arch-001"],
   "artifacts": {
     "story":      "artifacts/S-XX/story.md",
     "arch_plan":  "artifacts/S-XX/arch_plan.md",
     "code":       "artifacts/S-XX/code/",
     "modernized": "artifacts/S-XX/modernized/",
     "tests":      "artifacts/S-XX/tests/",
     "review":     "artifacts/S-XX/review.md",
-    "pr":         "artifacts/S-XX/PR.md"
+    "pr":              "artifacts/S-XX/PR.md",
+    "pipeline_report": "artifacts/S-XX/pipeline_report.md",
+    "retrospective":   "artifacts/S-XX/retrospective.md"
   },
   "steps_completed": [],
   "blockers": [],
-  "pending_evolve": []
+  "pending_evolve": [],
+  "metrics": {
+    "pipeline_start_ts": null,
+    "pipeline_end_ts": null,
+    "agents": {
+      "arch":       { "start_ts": null, "end_ts": null, "tokens_in": null, "tokens_out": null },
+      "dev":        { "start_ts": null, "end_ts": null, "tokens_in": null, "tokens_out": null },
+      "modernizer": { "start_ts": null, "end_ts": null, "tokens_in": null, "tokens_out": null },
+      "test":       { "start_ts": null, "end_ts": null, "tokens_in": null, "tokens_out": null },
+      "reviewer":   { "start_ts": null, "end_ts": null, "tokens_in": null, "tokens_out": null }
+    },
+    "blocker_count": 0,
+    "interaction_count": 0
+  }
 }
```

---

**Section : Activation des agents** — ajout d'une règle de collecte

```diff
 Les agents ne se lancent pas dans un ordre rigide — tu les actives quand leurs dépendances sont satisfaites :

 Architecte    → peut démarrer dès que story.md est disponible
 Dev           → peut démarrer quand arch_plan.md est produit
 Modernizer    → peut démarrer quand code/ est produit
 Test Writer   → peut démarrer quand modernized/ est produit
 Reviewer      → peut démarrer quand tests/ est produit
 Méta          → s'active après chaque story mergée (batch EVOLVE)
+
+**Collecte des métriques à chaque activation :**
+Quand tu actives un agent, note `start_ts` dans `metrics.agents[nom]`.
+Quand tu reçois son NOTIFY de fin, note `end_ts`.
+Si les métadonnées de tokens sont disponibles dans la réponse du sous-agent Claude Code,
+récupère `tokens_in` et `tokens_out`. Sinon, laisse à `null` — le rapport l'indiquera
+explicitement comme "estimation non disponible".
+Incrémente `metrics.interaction_count` à chaque message ASK/REPLY/CHALLENGE/DEFEND/RESOLVE sur le bus.
+Incrémente `metrics.blocker_count` à chaque BLOCKER reçu.
```

---

**Section : Nouvelles responsabilités de fin de pipeline** — section à ajouter après la section "Routing des interactions"

```diff
+## Production des artefacts de fin de pipeline
+
+Après avoir reçu le verdict APPROUVÉ ou APPROUVÉ AVEC RÉSERVES du Reviewer, et avant de
+présenter la PR finale à l'utilisateur, tu produis deux artefacts supplémentaires :
+
+### 1. pipeline_report.md
+
+Calcule les métriques finales depuis `pipeline_state.json > metrics` et produis
+`artifacts/S-XX/pipeline_report.md` en utilisant ce template (voir section "Templates").
+
+Tarifs de référence pour claude-sonnet-4-6 :
+- Input : $3,00 / MTok (3 USD par million de tokens input)
+- Output : $15,00 / MTok (15 USD par million de tokens output)
+
+Formule de coût par agent :
+  coût = (tokens_in / 1_000_000 × 3.00) + (tokens_out / 1_000_000 × 15.00)
+
+Si `tokens_in` ou `tokens_out` est `null` pour un agent, indique "n/d" dans le tableau
+et exclue cet agent du total de coût.
+
+### 2. retrospective.md
+
+Analyse le bus complet (`artifacts/S-XX/agent-bus.jsonl`) et les métriques accumulées.
+Produis `artifacts/S-XX/retrospective.md` en utilisant ce template (voir section "Templates").
+
+Pour identifier les candidats EVOLVE dans la retrospective :
+- Toute friction répétée 2+ fois dans le bus (même type de BLOCKER, même type de CHALLENGE)
+- Toute étape qui a nécessité une intervention humaine non prévue dans le plan initial
+- Tout pattern positif qui pourrait être systématisé via une règle
+
+Après avoir produit les deux artefacts, émets un NOTIFY sur le bus :
+```json
+{
+  "from": "orchestrator",
+  "to": "all",
+  "mode": "NOTIFY",
+  "thread": "orch-close-S-XX",
+  "body": "pipeline_report.md et retrospective.md produits pour S-XX."
+}
+```
```

---

**Section : Format de rapport à l'utilisateur** — mise à jour

```diff
 Quand la PR est prête :
 ```
 Pipeline S-XX terminé.

 Artefacts produits :
   ✅ arch_plan.md — Architecte
   ✅ code/ — Dev (2 ASK résolus avec Architecte)
   ✅ modernized/ — Modernizer (1 CHALLENGE résolu)
   ✅ tests/ — Test Writer
   ✅ PR.md — Reviewer
+  ✅ pipeline_report.md — Orchestrateur (télémétrie)
+  ✅ retrospective.md — Orchestrateur (analyse workflow)

 Interactions notables :
   - dev-arch-001 : Dev a consulté Architecte sur ScriptInfo::Clone → résolu
   - mod-dev-001 : Modernizer a challengé unwrap() → résolu en faveur du Modernizer

+Résumé télémétrie :
+  Coût estimé : $X.XX USD | Tokens totaux : XXX k input / XXX k output | Durée : XXm
+  BLOCKERs : X | Interactions inter-agents : X

 EVOLVE en attente pour le Méta : 2 propositions (evolve-dev-003, evolve-test-001)
 Seront traitées après ton merge.
+Candidats EVOLVE détectés dans la retrospective : X (voir retrospective.md)

 ⏸️ PR disponible dans artifacts/S-XX/PR.md — en attente de ta review.
 ```
```

---

**Section : Templates des nouveaux artefacts** — section à ajouter en fin du prompt

````diff
+## Templates des artefacts de fin de pipeline
+
+### Template : artifacts/S-XX/pipeline_report.md
+
+```markdown
+# Rapport de pipeline — S-XX : [Titre de la story]
+
+> Produit par : Orchestrateur
+> Date : [ISO date]
+
+## Métriques par agent
+
+| Agent | Tokens input | Tokens output | Coût estimé (USD) | Durée |
+|-------|-------------|--------------|-------------------|-------|
+| Architecte | X k | X k | $X.XX | Xm Xs |
+| Dev | X k | X k | $X.XX | Xm Xs |
+| Modernizer | X k | X k | $X.XX | Xm Xs |
+| Test Writer | X k | X k | $X.XX | Xm Xs |
+| Reviewer | X k | X k | $X.XX | Xm Xs |
+| **TOTAL** | **X k** | **X k** | **$X.XX** | — |
+
+> Tarifs de référence : claude-sonnet-4-6 — $3,00/MTok input · $15,00/MTok output
+> Les valeurs marquées "n/d" indiquent que les métadonnées de tokens n'étaient pas
+> disponibles pour cet agent (estimation non réalisée).
+
+## Métriques globales
+
+| Métrique | Valeur |
+|----------|--------|
+| Durée totale (wall-clock) | Xh Xm |
+| Début du pipeline | [ISO timestamp] |
+| Fin du pipeline | [ISO timestamp] |
+| BLOCKERs rencontrés | X |
+| Interactions inter-agents (ASK/REPLY/CHALLENGE/DEFEND/RESOLVE) | X |
+| Coût total estimé | $X.XX USD |
+```
+
+---
+
+### Template : artifacts/S-XX/retrospective.md
+
+```markdown
+# Retrospective — S-XX : [Titre de la story]
+
+> Produite par : Orchestrateur (analyse du bus complet + métriques)
+> Date : [ISO date]
+> Note de fluidité : [X/5]
+
+## Ce qui a bien fonctionné
+
+[Liste de patterns positifs détectés dans le bus — ex: "L'Architecte a fourni un plan
+suffisamment détaillé pour que le Dev n'ait émis qu'un seul ASK", "Aucun CHALLENGE sur
+le code Rust — les standards étaient clairs"]
+
+## Frictions identifiées
+
+| # | Friction | Impact | Threads concernés |
+|---|---------|--------|------------------|
+| 1 | [Description de la friction] | [Bloquant / Ralentissement / Mineur] | [thread-id] |
+
+[Analyse narrative des frictions : qu'est-ce qui a causé chaque BLOCKER, combien d'allers-retours
+ont été nécessaires, quelles corrections ont été faites après le Review]
+
+## Suggestions d'amélioration du workflow
+
+[Liste de suggestions concrètes, avec pour chacune :]
+
+### Suggestion 1 : [Titre court]
+
+**Contexte** : [Ce qui s'est passé dans cette story qui motive la suggestion]
+**Proposition** : [Changement concret à apporter]
+**Agent cible** : [Quel prompt ou processus modifier]
+**Candidat EVOLVE** : OUI / NON
+**Priorité** : Haute / Moyenne / Basse
+
+[Répéter pour chaque suggestion]
+
+## Récapitulatif des candidats EVOLVE
+
+| # | Suggestion | Agent cible | Priorité |
+|---|-----------|-------------|---------|
+| 1 | [titre] | [agent] | Haute |
+
+> Ces candidats seront transmis à l'agent Méta après merge de la story,
+> sous forme de messages EVOLVE sur le bus.
+
+## Note de fluidité
+
+**[X/5]** — [Justification en 1-2 phrases : pourquoi cette note]
+
+_Échelle : 1 = pipeline très chaotique (nombreux BLOCKERs, corrections majeures post-Review) ;
+5 = pipeline fluide (aucun BLOCKER, pas de correction post-Review, interactions minimales)_
+```
````

---

### `CLAUDE.md`

**Section : Structure des artefacts par story**

```diff
 artifacts/S-XX/
 ├── story.md                  # fournie par toi
 ├── agent-bus.jsonl           # bus append-only de la story
 ├── pipeline_state.json       # état maintenu par l'orchestrateur
 ├── arch_plan.md              # Architecte
 ├── code/                     # Dev
 ├── modernized/               # Modernizer
 ├── modernization_report.md
 ├── tests/                    # Test Writer
 ├── test_report.md
 ├── review.md                 # Reviewer — audit interne
 ├── PR.md                     # Reviewer — PR pour toi
+├── pipeline_report.md        # Orchestrateur — télémétrie (tokens, coût, durée)
+└── retrospective.md          # Orchestrateur — analyse workflow + candidats EVOLVE
```

---

## Format exact de pipeline_state.json (avec champ metrics)

Schéma complet après cette PPR :

```json
{
  "story_id": "S-XX",
  "story_title": "...",
  "status": "in_progress",
  "active_agents": [],
  "active_threads": [],
  "artifacts": {
    "story":           "artifacts/S-XX/story.md",
    "arch_plan":       "artifacts/S-XX/arch_plan.md",
    "code":            "artifacts/S-XX/code/",
    "modernized":      "artifacts/S-XX/modernized/",
    "tests":           "artifacts/S-XX/tests/",
    "review":          "artifacts/S-XX/review.md",
    "pr":              "artifacts/S-XX/PR.md",
    "pipeline_report": "artifacts/S-XX/pipeline_report.md",
    "retrospective":   "artifacts/S-XX/retrospective.md"
  },
  "steps_completed": [],
  "blockers": [],
  "pending_evolve": [],
  "metrics": {
    "pipeline_start_ts": null,
    "pipeline_end_ts": null,
    "agents": {
      "arch":       { "start_ts": null, "end_ts": null, "tokens_in": null, "tokens_out": null },
      "dev":        { "start_ts": null, "end_ts": null, "tokens_in": null, "tokens_out": null },
      "modernizer": { "start_ts": null, "end_ts": null, "tokens_in": null, "tokens_out": null },
      "test":       { "start_ts": null, "end_ts": null, "tokens_in": null, "tokens_out": null },
      "reviewer":   { "start_ts": null, "end_ts": null, "tokens_in": null, "tokens_out": null }
    },
    "blocker_count": 0,
    "interaction_count": 0
  }
}
```

---

## Ce qui NE change PAS

- Les prompts des agents spécialisés (Architecte, Dev, Modernizer, Test Writer, Reviewer) restent inchangés — ils ne collectent pas de métriques, cette responsabilité reste centralisée dans l'orchestrateur.
- Le protocole du bus (`PROTOCOL.md`) reste inchangé — aucun nouveau mode de message, aucun nouveau champ obligatoire.
- La gouvernance reste identique : JAMAIS de commit direct, JAMAIS de merge sans accord utilisateur.
- Le Reviewer ne produit pas la retrospective — sa responsabilité reste l'audit qualité du code uniquement.
- Les EVOLVE restent traités en batch après merge, pas en temps réel.
- Le flux de validation utilisateur (⏸️ avant merge) reste inchangé.

---

## Impact sur les stories futures

À partir de la story suivante traitée par l'orchestrateur mis à jour :

1. **Visibilité immédiate sur les coûts** — après chaque story, l'utilisateur voit le coût estimé en USD et peut ajuster la stratégie d'utilisation des agents (parallélisation, granularité des stories, etc.).

2. **Amélioration continue du workflow** — chaque `retrospective.md` alimente le Méta avec des candidats EVOLVE priorisés. Au lieu d'attendre que les agents détectent eux-mêmes les frictions, l'orchestrateur les identifie de manière systémique à partir du bus.

3. **Traçabilité des frictions** — les patterns répétés entre stories seront visibles en comparant les retrospectives. Un même type de BLOCKER sur 3 stories consécutives est un signal fort pour une PPR.

4. **Calibrage de la note de fluidité** — la note 1-5 permet de suivre l'évolution de la maturité du pipeline story après story. Objectif à terme : toutes les stories à 4/5 ou 5/5.

---

⏸️ En attente de ta validation. Aucun prompt ne sera modifié sans ton accord.
