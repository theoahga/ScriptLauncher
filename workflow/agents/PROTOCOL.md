# Protocole du bus inter-agents

> Ce document est partagé par tous les agents. Il définit comment communiquer
> sur le bus, comment interagir, et comment proposer des évolutions de prompt.
> Chaque agent doit le lire avant toute action.

---

## Le bus — agent-bus.jsonl

Tous les échanges inter-agents passent par un fichier append-only :

```
artifacts/S-XX/agent-bus.jsonl
```

Chaque ligne est un message JSON :

```json
{
  "ts": "2024-01-15T10:23:41Z",
  "story": "S-02",
  "from": "dev",
  "to": "arch",
  "mode": "ASK",
  "thread": "dev-arch-001",
  "body": "Le plan ne précise pas si ScriptInfo doit dériver Clone. Nécessaire pour les tests ?"
}
```

### Champs obligatoires

| Champ | Valeurs | Description |
|-------|---------|-------------|
| `ts` | ISO 8601 | Timestamp |
| `story` | `S-XX` | Story concernée |
| `from` | `arch` `dev` `modernizer` `test` `reviewer` `meta` `orchestrator` `human` | Émetteur |
| `to` | idem + `all` | Destinataire |
| `mode` | voir ci-dessous | Type d'interaction |
| `thread` | string unique | Pour regrouper un échange |
| `body` | string | Contenu du message |

### Modes

| Mode | Usage | Règles |
|------|-------|--------|
| `ASK` | Consultation ponctuelle | Réponse attendue sous `REPLY`, puis échange terminé |
| `REPLY` | Réponse à un `ASK` | Même `thread` que le `ASK` |
| `CHALLENGE` | Débat sur un artefact | Max 3 tours (`CHALLENGE` → `DEFEND` → `CHALLENGE` → `RESOLVE`) |
| `DEFEND` | Réponse à un `CHALLENGE` | Même `thread` |
| `RESOLVE` | Clôture d'un débat | Émis par l'orchestrateur si non résolu au bout de 3 tours |
| `PAIR` | Pair programming | Deux agents sur un thread simultané, orchestré explicitement |
| `BLOCKER` | Bloquant technique | Remonte à l'orchestrateur, stoppe le thread |
| `EVOLVE` | Proposition d'évolution de prompt | Remonte à l'agent Méta |
| `NOTIFY` | Information sans réponse attendue | Log d'état, artefact produit |

---

## Trois modes d'interaction

### 1. Consultation — `ASK` / `REPLY`

Un agent a besoin d'un avis ponctuel pour continuer son travail.

**Règles :**
- 1 question précise, 1 réponse, terminé
- Si la réponse génère une nouvelle question → nouveau thread, pas d'enchaînement
- Timeout implicite : si pas de `REPLY` après 2 tentatives → `BLOCKER`

**Exemple :**
```json
{"from":"dev","to":"arch","mode":"ASK","thread":"dev-arch-001",
 "body":"ScriptInfo doit-il dériver Clone ? Nécessaire pour les tests unitaires."}

{"from":"arch","to":"dev","mode":"REPLY","thread":"dev-arch-001",
 "body":"Oui, ajoute #[derive(Clone)] sur ScriptInfo. Pas dans le plan initial, ma faute."}
```

### 2. Débat — `CHALLENGE` / `DEFEND` / `RESOLVE`

Un agent conteste un artefact produit par un autre.

**Règles :**
- Maximum 3 échanges (challenge + defend + challenge final)
- Si non résolu après 3 tours → l'orchestrateur émet `RESOLVE` avec sa décision
- Le challenger doit citer l'artefact contesté (fichier + ligne si applicable)
- Le défenseur doit répondre sur le fond, pas sur la forme

**Exemple :**
```json
{"from":"modernizer","to":"dev","mode":"CHALLENGE","thread":"mod-dev-001",
 "body":"file_system.rs:34 — tu utilises .unwrap() sur read_dir. Si le dossier est supprimé entre list et open, panic en prod."}

{"from":"dev","to":"modernizer","mode":"DEFEND","thread":"mod-dev-001",
 "body":"Intentionnel : arch_plan.md#ADR-01 dit que les erreurs FS doivent remonter comme BLOCKER, pas être silencieuses. Le unwrap est un signal fort."}

{"from":"modernizer","to":"dev","mode":"CHALLENGE","thread":"mod-dev-001",
 "body":"ADR-01 parle des erreurs métier, pas des panics Rust. Un panic kill le thread Tauri. Suggère .map_err(|e| e.to_string())? à la place."}

{"from":"orchestrator","to":"all","mode":"RESOLVE","thread":"mod-dev-001",
 "body":"Modernizer a raison sur la distinction panic/erreur. Dev: remplace unwrap par ?. Modernizer: mets à jour le rapport."}
```

### 3. Pair programming — `PAIR`

Deux agents travaillent ensemble sur un même problème, orchestré explicitement.

**Règles :**
- Déclenché uniquement par l'orchestrateur (`{"from":"orchestrator","mode":"PAIR","to":"dev+arch"}`)
- Les deux agents partagent le même thread et alternent les messages
- L'orchestrateur clôt le thread avec `NOTIFY` quand le travail est terminé
- Utilisé pour : story trop complexe pour un seul agent, refactoring cross-couches, debug d'un bug subtil

---

## Proposer une évolution de prompt — `EVOLVE`

N'importe quel agent peut émettre une proposition d'évolution à tout moment.

### Quand émettre un `EVOLVE`

- Tu as répété la même action manuelle 2+ fois dans des stories différentes → automatiser via script
- Tu as contourné une règle de ton prompt parce qu'elle ne couvrait pas ce cas → améliorer la règle
- Tu as détecté un pattern récurrent dans les artefacts que tu reçois → améliorer le prompt de l'émetteur
- Tu as échoué à faire quelque chose que tu aurais dû pouvoir faire → combler un angle mort

### Format du message EVOLVE

```json
{
  "from": "dev",
  "to": "meta",
  "mode": "EVOLVE",
  "thread": "evolve-dev-003",
  "body": {
    "target_agent": "dev",
    "type": "rule_addition",
    "trigger": "3ème story où j'ai dû manuellement vérifier que unlisten() est appelé dans useEffect",
    "proposal": "Ajouter dans les standards TypeScript : 'Tout listen() Tauri doit avoir son unlisten() dans le return du useEffect. Vérifier systématiquement avant de passer l'artefact.'",
    "rationale": "Cette vérification est systématique et oubliée régulièrement. Une règle explicite l'élimine.",
    "scope": "rule",
    "effort": "low"
  }
}
```

### Champs `body` pour EVOLVE

| Champ | Valeurs | Description |
|-------|---------|-------------|
| `target_agent` | nom de l'agent | Quel prompt modifier (peut être soi-même) |
| `type` | `rule_addition` `rule_change` `script_automation` `structural_change` | Nature du changement |
| `trigger` | string | Ce qui a déclenché la proposition |
| `proposal` | string | Le changement proposé, formulé précisément |
| `rationale` | string | Pourquoi c'est une bonne idée |
| `scope` | `rule` `script` `structure` | Ampleur |
| `effort` | `low` `medium` `high` | Estimation de l'effort d'implémentation |

### Types de propositions

**`rule_addition` / `rule_change`** — modifier le texte d'un prompt  
Exemple : ajouter une règle, clarifier une définition ambiguë, supprimer une règle obsolète

**`script_automation`** — créer ou modifier un script pour automatiser une tâche répétitive  
Exemple : script de vérification des cleanup useEffect, script de génération du squelette d'artefact

**`structural_change`** — modifier la structure du bus, des artefacts, ou des interactions  
Exemple : ajouter un nouveau champ au format de message, créer un nouveau type d'agent

---

## Règles communes à tous les agents

```
1. Chaque message sur le bus a un thread unique — ne pas réutiliser un thread fermé
2. Un CHALLENGE ne bloque pas ton travail — tu continues et signales dans ton artefact
   que le point est contesté (marqué [CONTESTED:thread-id])
3. Ne jamais émettre un EVOLVE en cours de travail sur une story — attends la fin
4. Limiter à 2 interactions actives simultanées — au-delà, émettre un BLOCKER
5. Tout ce qui passe par le bus est visible de l'orchestrateur — pas de canaux privés
```
