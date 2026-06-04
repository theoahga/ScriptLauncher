#!/usr/bin/env bash
# scripts/gh-create-pr.sh
# Usage : ./scripts/gh-create-pr.sh S-02 "Backend list_scripts"
#
# Crée une branche feat/S-XX-slug, pousse les fichiers du dossier
# artifacts/S-XX/code/ dans le repo, puis ouvre la PR avec le corps
# issu de artifacts/S-XX/PR.md.
#
# Prérequis : GITHUB_TOKEN dans l'environnement, gh installé, repo cloné.

set -euo pipefail

STORY_ID="${1:?Usage: $0 <story-id> <title>  ex: S-02 'Backend list_scripts'}"
TITLE="${2:?Usage: $0 <story-id> <title>}"

SLUG=$(echo "$TITLE" | tr '[:upper:]' '[:lower:]' | tr ' ' '-' | tr -cd '[:alnum:]-')
BRANCH="feat/${STORY_ID}-${SLUG}"
ARTIFACT_DIR="artifacts/${STORY_ID}"
PR_BODY="${ARTIFACT_DIR}/PR.md"
CODE_DIR="${ARTIFACT_DIR}/code"

# Vérifications
if [[ ! -f "$PR_BODY" ]]; then
  echo "ERREUR : $PR_BODY introuvable. Le Reviewer a-t-il produit la PR ?" >&2
  exit 1
fi

if [[ ! -d "$CODE_DIR" ]]; then
  echo "ERREUR : $CODE_DIR introuvable." >&2
  exit 1
fi

# Branche
git checkout -b "$BRANCH"

# Copie les fichiers de l'agent dans le repo (en respectant les chemins)
rsync -av --exclude='*.md' "$CODE_DIR/" .

# Commit
git add -A
git commit -m "feat(${STORY_ID}): ${TITLE}

Généré par le pipeline multi-agents.
Story : ${STORY_ID}
Artefacts : ${ARTIFACT_DIR}"

# Push
git push origin "$BRANCH"

# PR
gh pr create \
  --title "${STORY_ID} : ${TITLE}" \
  --body-file "$PR_BODY" \
  --base main \
  --head "$BRANCH" \
  --label "agent-pr"

echo ""
echo "PR créée : $(gh pr view --json url -q .url)"
