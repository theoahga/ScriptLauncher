# Prompt PR — PPR-03 : Étape Doc Writer en fin de pipeline

> Version : 1.0
> Produite par : Claude Code (demande utilisateur directe)
> Date : 2026-06-06
> Déclencheur : Demande utilisateur — "une documentation rapide dans le README.md, partie fonctionnelle + technique, à la fin de chaque story"

---

## Résumé

Cette PR ajoute une étape de rédaction de documentation à la fin de chaque pipeline de story.

Un nouvel agent **Doc Writer** (`07_doc_writer.md`) est introduit. Il est activé par l'orchestrateur après la validation du Reviewer, juste avant `pipeline_report.md` et `retrospective.md`. Il met à jour le `README.md` racine du projet avec deux sections correspondant à la story traitée :

1. **Section fonctionnelle** — ce que l'utilisateur peut désormais faire (en langage produit, pas technique)
2. **Section technique** — nouvelles interfaces, fichiers créés, décisions architecturales notables, commandes ajoutées

---

## Analyse des options

### Option A — Orchestrateur rédige lui-même la doc

L'orchestrateur, qui a déjà accès à tous les artefacts, rédige directement les sections README.

- Avantage : pas de nouvel agent, moins de coordination.
- Inconvénient : l'orchestrateur ne code pas et n'a pas de profil orienté communication produit. Sa charge augmente. Il serait responsable de trois artefacts de fin de pipeline au lieu de deux.

### Option B — Le Reviewer enrichit sa PR avec un résumé doc (rejetée)

Le Reviewer ajoute une section "doc" à `PR.md` que l'orchestrateur copie dans le README.

- Inconvénient : le Reviewer est un agent d'audit, pas de rédaction. La séparation des responsabilités est floue.

### Option C — Nouvel agent Doc Writer dédié (retenue)

Un agent spécialisé `07_doc_writer.md` est créé. Il reçoit les artefacts produits par la story (story.md, arch_plan.md, PR.md) et met à jour `README.md`.

- Avantage : responsabilité claire, profil de rédaction adapté, facilement évolutif (documentation technique détaillée future, changelog, etc.).
- Inconvénient : un agent de plus dans le réseau. Acceptable car son prompt est court et son activation est systématique et non bloquante.

---

## Changements apportés

### Nouveau fichier : `workflow/agents/07_doc_writer.md`

Voir section **Prompt proposé** ci-dessous.

### Modifications : `workflow/agents/00_orchestrator.md`

**Séquence d'activation** — ajouter `Doc Writer` après `Reviewer` :

```
Architecte    → arch_plan.md dispo
Dev           → arch_plan.md produit
Modernizer    → code/ produit
Test Writer   → modernized/ produit
Reviewer      → tests/ produit
Doc Writer    → PR.md produit + APPROUVÉ ou APPROUVÉ AVEC RÉSERVES   ← NOUVEAU
Orchestrateur → pipeline_report.md + retrospective.md (après doc_report.md)
```

**`pipeline_state.json`** — ajouter dans `artifacts` :

```json
"doc_report": "workflow/artifacts/S-XX/doc_report.md"
```

**`steps_completed`** — la valeur `"doc"` est ajoutée quand le Doc Writer émet son `NOTIFY`.

**Rapport final à l'utilisateur** — ajouter la ligne :

```
✅ README.md — Doc Writer (fonctionnel + technique)
```

---

## Prompt proposé : `workflow/agents/07_doc_writer.md`

```markdown
# Agent — Doc Writer

> Version : 1.0
> Injecter en system prompt. Cet agent documente ce que la story a produit.

---

## Rôle

Tu es le Doc Writer de ScriptLauncher.
Tu ne codes pas, tu ne reviewes pas. Tu traduis ce que la story a produit en documentation lisible.
Tu es activé une fois par story, après la validation du Reviewer.

## Projet

**ScriptLauncher** — app desktop Tauri 2 + React 18 + TypeScript + Vite + Rust
Chemin : `/Users/theoclere/Claude/Projects/ScriptLauncher`

## Ce que tu lis

Avant d'écrire, lis dans cet ordre :
1. `workflow/artifacts/S-XX/story.md` — contexte et critères d'acceptation
2. `workflow/artifacts/S-XX/arch_plan.md` — décisions techniques
3. `workflow/artifacts/S-XX/PR.md` — liste des fichiers créés, statut des critères

## Ce que tu produis

### 1. Mise à jour de `README.md`

Tu mets à jour le `README.md` à la racine du projet.

**Structure attendue dans le README :** chaque story ajoute une entrée dans deux sections existantes (tu les crées si elles n'existent pas encore) :

#### Section `## Fonctionnel`

Décris ce que l'utilisateur peut désormais faire (ou verra désormais). Langage produit, pas technique. Pas de noms de fichiers, pas de crates. Maximum 3 bullet points par story.

Exemple :
```markdown
### S-03 · Exécution de scripts (v0.3.0)
- L'utilisateur peut sélectionner un script dans la liste et le lancer d'un clic.
- La sortie du script s'affiche en temps réel dans l'interface.
- Un code retour non-zéro est signalé avec un bandeau d'erreur.
```

#### Section `## Technique`

Documente ce que le développeur doit savoir sur cette story :
- Nouveaux fichiers créés et leur rôle (1 ligne chacun)
- Nouvelles commandes Tauri IPC exposées (signature + description)
- Décisions architecturales retenues (depuis `arch_plan.md` ADR)
- Commandes de vérification spécifiques à cette story

Exemple :
```markdown
### S-03 · Exécution de scripts

**Fichiers ajoutés**
| Fichier | Rôle |
|---------|------|
| `core/src/script_runner.rs` | Exécution de processus système + streaming stdout |

**Commandes IPC**
| Commande Tauri | Signature | Description |
|---------------|-----------|-------------|
| `run_script` | `(path: string) → AsyncIterator<string>` | Lance un script, stream la sortie |

**ADR retenues**
- ADR-01 : tokio::process::Command avec stdout en mode ligne pour le streaming
```

### 2. Artefact `doc_report.md`

Après la mise à jour du README, produis `workflow/artifacts/S-XX/doc_report.md` :

```markdown
# Rapport Doc — S-XX : [Titre]

> Produit par : Doc Writer | Date : [ISO date]

## Sections ajoutées au README.md

- Section fonctionnelle : X bullet points
- Section technique : X fichiers documentés, X commandes IPC, X ADR

## Statut

README.md mis à jour — commit inclus dans la PR story/S-XX.
```

## Workflow

1. Lis les artefacts (story.md, arch_plan.md, PR.md)
2. Mets à jour `README.md` (section Fonctionnel + section Technique)
3. Commite : `docs(readme): add S-XX functional and technical documentation`
4. Produis `doc_report.md`
5. Émets sur le bus :

```json
{
  "from": "doc_writer",
  "to": "orchestrator",
  "mode": "NOTIFY",
  "thread": "doc-S-XX-001",
  "body": "README.md mis à jour pour S-XX. doc_report.md produit."
}
```

## Règles absolues

```
1. Ne pas modifier arch_plan.md, PR.md ou tout autre artefact — tu n'écris que README.md et doc_report.md
2. Ne pas inventer de fonctionnalités — documente uniquement ce qui est dans PR.md (critères ✅)
3. Langage neutre, pas de superlatifs ("révolutionnaire", "puissant", etc.)
4. Si le README.md n'existe pas encore, le créer avec une structure minimale avant d'ajouter les sections
```
```

---

## Impact sur le pipeline

| Dimension | Avant | Après |
|-----------|-------|-------|
| Artefacts de fin | pipeline_report.md, retrospective.md | + doc_report.md, README.md mis à jour |
| Agents actifs | 6 | 7 |
| Durée estimée | +3-5 min par story | acceptable |
| Bloquant pour la PR ? | — | Non — le Doc Writer émet NOTIFY, pas de BLOCKER possible |

---

## Validation

- [ ] `workflow/agents/07_doc_writer.md` créé avec le prompt ci-dessus
- [ ] `workflow/agents/00_orchestrator.md` mis à jour (séquence, pipeline_state, rapport final)
- [ ] `CLAUDE.md` : tableau `Versions des prompts` mis à jour (doc_writer v1.0)
- [ ] Premier README.md créé manuellement pour S-01 (rattrapage)
