# Prompt PR — PPR-01 : Intégration git/GitHub dans le pipeline

> Version : 1.0  
> Produite par : Agent Méta  
> Date : 2026-06-04  
> Déclencheur : Demande utilisateur (thread `meta-req-001`, bus S-01)

---

## Résumé

Cette PR étend le pipeline d'agents pour qu'il gère le cycle git complet d'une story :
création de branche, commits incrémentaux et soumission d'une PR GitHub sur `main` à la fin
du pipeline. Elle affine les règles de gouvernance sans les supprimer : les agents gagnent le
droit de committer sur une branche story isolée, mais le merge sur `main` reste exclusivement
humain.

---

## Analyse des options

### Décision 1 — Qui crée la branche git ?

| Option | Avantages | Inconvénients |
|--------|-----------|---------------|
| **A — Orchestrateur au démarrage de la phase Dev** | Vue centralisée, branche créée une seule fois, pas de risque de doublon | L'Orchestrateur touche git alors qu'il ne code pas |
| B — Dev au premier commit | Naturel du point de vue Dev | Le Dev gère deux responsabilités ; si le Dev est relancé en reprise, risque de branche dupliquée |
| C — Orchestrateur dès le début de la story (avant l'Architecte) | Branche disponible pour tout commit | Prématuré : la branche ne sert qu'à partir du Dev |

**Option retenue : A — Orchestrateur, juste avant d'activer le Dev.**

Justification : l'Orchestrateur est le chef d'orchestre du cycle de vie de la story. Centraliser
la création de branche dans son prompt évite de multiplier les responsabilités git sur les agents
producteurs. Une seule instruction git au bon moment, dans le bon agent.

---

### Décision 2 — Qui pousse le code et crée la PR GitHub ?

| Option | Avantages | Inconvénients |
|--------|-----------|---------------|
| **A — Reviewer après verdict APPROUVÉ ou APPROUVÉ AVEC RÉSERVES** | Logique de bout en bout : pas de PR si REFUSÉ ; le Reviewer a déjà tous les artefacts en mémoire | Le Reviewer touche git (push + gh pr create) |
| B — Orchestrateur après réception du verdict Reviewer | L'Orchestrateur centralise toutes les actions git | L'Orchestrateur doit parser le verdict pour décider — ajoute de la logique conditionnelle complexe |
| C — Un agent dédié "GitOps" | Séparation des responsabilités claire | Nouveau agent à créer, surcharge du réseau pour S-01 |

**Option retenue : A — Reviewer, conditionnel au verdict.**

Justification : le Reviewer est le dernier maillon du pipeline et dispose déjà de l'évaluation
complète. Le push + la création de PR GitHub sont une extension naturelle de son rôle de
"gatekeeper" : si le code ne passe pas, ni le push ni la PR n'ont lieu.

---

### Décision 3 — Qui committe les artefacts de code intermédiaires ?

| Option | Avantages | Inconvénients |
|--------|-----------|---------------|
| **A — Dev committe son code sur la branche story** | Le code versionné dès production | Le Dev gère git en plus du code |
| B — Orchestrateur committe après chaque étape | Centralisé | L'Orchestrateur doit manipuler des fichiers code |
| C — Aucun commit intermédiaire, push unique par le Reviewer | Simplifié | En cas d'interruption, rien n'est sauvegardé dans git |

**Option retenue : A — Dev committe son code après implémentation.**

Justification : le code vit dans le dépôt git, pas seulement dans `artifacts/`. Committer après
la phase Dev garantit un point de sauvegarde avant la modernisation, et produit un historique
git lisible story par story.

---

## Propositions incluses

| # | Changement | Agent cible | Type |
|---|------------|-------------|------|
| 1 | Création de branche `story/S-XX` avant activation du Dev | `00_orchestrator.md` | `structural_change` |
| 2 | Commit du code produit sur la branche story | `02_dev.md` | `rule_addition` |
| 3 | Push + création PR GitHub après verdict positif | `05_reviewer.md` | `structural_change` |
| 4 | Mise à jour des règles de gouvernance | `CLAUDE.md` | `rule_change` |

---

## Changements proposés

### agents/00_orchestrator.md

**Section** : `## Activation des agents` — règle de séquence Dev  
**Changement** : Ajouter une étape explicite de création de branche git juste avant l'activation
du Dev. Ajouter la commande exacte et la règle dans les "Règles absolues".

```diff
 Dev           → peut démarrer quand arch_plan.md est produit
```
```diff
+Dev           → peut démarrer quand arch_plan.md est produit
+               AVANT d'activer le Dev : créer la branche story/S-XX
+               git checkout -b story/S-XX
+               (si la branche existe déjà : git checkout story/S-XX)
```

**Section** : `## Règles absolues`  
**Changement** : Remplacer la règle 1 trop absolue par une formulation qui distingue branche
story vs `main`.

```diff
-1. Jamais de commit direct, jamais de merge
+1. Jamais de commit direct sur main, jamais de merge
+   Les agents peuvent committer sur leur branche story/S-XX
+   Le merge de story/S-XX → main reste exclusivement humain
```

**Section** : `## Format de rapport à l'utilisateur` — message de fin de pipeline  
**Changement** : Mettre à jour le template pour indiquer la PR GitHub créée.

```diff
-⏸️ PR disponible dans artifacts/S-XX/PR.md — en attente de ta review.
+⏸️ PR GitHub créée : [URL retournée par gh pr create]
+   PR.md disponible dans artifacts/S-XX/PR.md — en attente de ta review.
```

---

### agents/02_dev.md

**Section** : `## Ce que tu produis` — après la liste des fichiers  
**Changement** : Ajouter une sous-section "Commit sur la branche story" avec les commandes
exactes à exécuter après avoir produit les fichiers.

```diff
+## Commit sur la branche story
+
+Après avoir produit tous les fichiers dans le projet ET dans artifacts/S-XX/code/ :
+
+```bash
+# Stager uniquement les fichiers produits par cette story
+git add src-tauri/src/ src/ tauri.conf.json Cargo.toml package.json
+# (adapter selon les fichiers réellement modifiés)
+
+# Committer avec un message conventionnel
+git commit -m "feat(S-XX): [titre de la story en snake_case]"
+```
+
+Règles :
+- Ne stager que les fichiers listés dans arch_plan.md comme périmètre de la story
+- Ne jamais stager : .env, node_modules/, target/, artifacts/ (sauf si explicitement demandé)
+- Si git commit échoue (hook pre-commit) → émettre un BLOCKER, ne pas bypasser avec --no-verify
```

---

### agents/05_reviewer.md

**Section** : `## Ce que tu produis` — après les deux fichiers existants  
**Changement** : Ajouter une sous-section "PR GitHub" décrivant la création de PR conditionnelle.

```diff
+### 3. PR GitHub — conditionnelle au verdict
+
+Si le verdict est **APPROUVÉ** ou **APPROUVÉ AVEC RÉSERVES** :
+
+```bash
+# Pousser la branche story sur le remote
+git push -u origin story/S-XX
+
+# Créer la PR GitHub
+gh pr create \
+  --base main \
+  --head story/S-XX \
+  --title "feat(S-XX): [titre de la story]" \
+  --body "$(cat artifacts/S-XX/PR.md)"
+```
+
+Ajoute l'URL retournée par `gh pr create` dans le dernier paragraphe de `PR.md` :
+```
+PR GitHub : https://github.com/[owner]/[repo]/pull/[number]
+```
+
+Si le verdict est **REFUSÉ** :
+- Ne pas pousser, ne pas créer de PR GitHub
+- La branche story/S-XX reste locale, les corrections se feront en reprise
```

**Section** : `## Règles`  
**Changement** : Ajouter une règle sur la gestion d'échec de push.

```diff
+- Si `gh pr create` échoue (remote absent, auth manquante, PR déjà existante) → émettre
+  un BLOCKER avec l'erreur exacte. Ne pas réessayer seul.
```

---

### CLAUDE.md

**Section** : `## Gouvernance — rappel pour Claude Code`  
**Changement** : Affiner les règles de gouvernance pour refléter les droits distincts branche
story vs `main`.

```diff
-JAMAIS de commit direct
-JAMAIS de merge
+JAMAIS de commit direct sur main
+JAMAIS de merge (le merge story → main reste humain)
+Les agents PEUVENT committer sur story/S-XX et créer des PRs GitHub
 JAMAIS de modification de agents/*.md sans PPR validée par toi
 TOUJOURS attendre ✅ après un BLOCKER
```

---

## Ce qui NE change PAS

- **Le merge sur `main` reste humain** : aucun agent ne merge, jamais. La PR GitHub est créée
  pour soumission à l'utilisateur, pas pour auto-merge.
- **Les modifications de prompts restent soumises à PPR** : la règle "JAMAIS de modification de
  `agents/*.md` sans PPR validée" est préservée intacte.
- **Le bus `agent-bus.jsonl` reste append-only** : aucun changement de protocole.
- **Le format des artefacts `artifacts/S-XX/`** est inchangé.
- **La règle EVOLVE** : les propositions d'évolution continuent d'être traitées après merge,
  jamais en cours de story.
- **Les agents Architecte, Modernizer et Test Writer** : aucun changement dans leurs prompts —
  ils ne touchent pas git.
- **L'Agent Méta** : son cycle de vie (activé après merge, batch post-story) est inchangé.
- **La gouvernance multi-agents** : BLOCKER, CHALLENGE/DEFEND/RESOLVE, PAIR — aucun changement.

---

## Impact sur les stories futures

Après validation de cette PPR et application des changements, le pipeline pour chaque story
S-XX se déroulera ainsi :

```
[Orchestrateur]  git checkout -b story/S-XX
[Architecte]     → arch_plan.md   (pas de git)
[Dev]            → code + git add + git commit -m "feat(S-XX): ..."
[Modernizer]     → modernized/    (pas de git)
[Test Writer]    → tests/         (pas de git)
[Reviewer]       → review.md + PR.md
                   si APPROUVÉ ou APPROUVÉ AVEC RÉSERVES :
                     git push -u origin story/S-XX
                     gh pr create --base main --head story/S-XX ...
[Utilisateur]    review la PR GitHub + merge si accord
[Méta]           batch EVOLVE après merge
```

Bénéfices concrets :
- L'utilisateur reçoit une vraie PR GitHub cliquable, pas seulement un fichier markdown local
- L'historique git est propre : une branche par story, un commit par Dev
- Si le pipeline est REFUSÉ, la branche story/S-XX reste locale — propre, sans pollution de
  l'historique remote

---

## Commandes de vérification

Pour valider la cohérence des changements après application :

```bash
# Vérifier que les règles absolues de l'Orchestrateur sont cohérentes avec CLAUDE.md
grep -n "commit\|merge\|branch" agents/00_orchestrator.md CLAUDE.md

# Vérifier que le Dev cite les fichiers à ne pas stager
grep -n "git add\|git commit\|artifacts\|node_modules" agents/02_dev.md

# Vérifier que le Reviewer a bien la condition REFUSÉ → pas de push
grep -n "REFUSÉ\|push\|gh pr" agents/05_reviewer.md

# Vérifier que gh est disponible dans l'environnement CI/agents
gh auth status
```

---

⏸️ En attente de ta validation. Aucun prompt ne sera modifié sans ton accord.
