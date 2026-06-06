# CLAUDE.md — ScriptLauncher

> Fichier de configuration Claude Code. Placé à la racine du projet, il est automatiquement
> lu par Claude Code à chaque session.

---

## Projet

ScriptLauncher — app desktop pour lancer des scripts depuis un dossier.  
Migration Electron → **Tauri 2 + React 18 + TypeScript + Vite + Rust**.  
Cibles : macOS (`.app`/`.dmg`) · Windows (`.exe`/`.msi`)

## Commandes essentielles

```bash
npm run tauri dev                    # dev avec hot-reload
npm run tauri build                  # build prod
npx tsc --noEmit                     # type-check frontend
cd core && cargo check               # compile Rust sans build
cd core && cargo clippy              # lint Rust
cd core && cargo test                # tests Rust
npm run test                         # tests frontend (Vitest)
```

## Réseau multi-agents

Ce projet utilise un réseau d'agents spécialisés qui interagissent via un bus de messages.

```
workflow/agents/
├── PROTOCOL.md          # Protocole bus — LIRE EN PREMIER
├── 00_orchestrator.md   # Pilote le réseau, route les interactions
├── 01_architect.md      # Plan technique + ADR
├── 02_dev.md            # Implémentation
├── 03_modernizer.md     # Idiomes + best practices
├── 04_test_writer.md    # Tests unitaires + intégration
├── 05_reviewer.md       # Audit + PR finale
├── 06_meta.md           # Évolution des prompts (batch post-merge)
└── history/             # Versions archivées des prompts
```

### Lancer le réseau via Claude Code

```bash
# Démarrer l'orchestrateur sur une story
claude --system-prompt workflow/agents/00_orchestrator.md \
       --input workflow/artifacts/S-XX/story.md

# Lancer un agent seul (debug / relance)
claude --system-prompt workflow/agents/01_architect.md \
       --input workflow/artifacts/S-XX/story.md \
       --output workflow/artifacts/S-XX/arch_plan.md
```

### Structure des artefacts par story

```
workflow/artifacts/S-XX/
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
├── pipeline_report.md        # Orchestrateur — télémétrie (tokens, coût, durée)
└── retrospective.md          # Orchestrateur — analyse workflow + candidats EVOLVE
```

### Évolution des prompts

```
workflow/prompt_pr/
└── PPR-XX.md    # PR de prompt produite par le Méta, à valider par toi
```

## Gouvernance — rappel pour Claude Code

```
JAMAIS de commit direct sur main
JAMAIS de merge (le merge story → main reste humain)
Les agents PEUVENT committer sur story/S-XX et créer des PRs GitHub
JAMAIS de modification de workflow/agents/*.md sans PPR validée par toi
TOUJOURS attendre ✅ après un BLOCKER
```

## État d'avancement

| Story | Statut | Notes |
|-------|--------|-------|
| S-01 · Init Tauri | ⬜ | |
| S-02 · Backend file_system.rs | ⬜ | |
| S-03 · Backend script_runner.rs | ⬜ | |
| S-04 · Tauri config + permissions | ⬜ | |
| S-05 · FolderSelector.tsx | ⬜ | |
| S-06 · ScriptList.tsx | ⬜ | |
| S-07 · ScriptExecutor.tsx | ⬜ | |
| S-08 · App layout + styles | ⬜ | |

## Versions des prompts

| Agent | Version | Dernière PPR |
|-------|---------|-------------|
| orchestrator | 2.2 | PPR-02 |
| architect | 1.0 | — |
| dev | 1.1 | PPR-01 |
| modernizer | 1.0 | — |
| test_writer | 1.0 | — |
| reviewer | 1.1 | PPR-01 |
| meta | 1.0 | — |
