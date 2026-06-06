#!/usr/bin/env bash
# scripts/gh-create-prompt-pr.sh
# Usage : ./scripts/gh-create-prompt-pr.sh PPR-04
#
# Crée une branche prompt/PPR-XX, commit les fichiers agents/ modifiés
# selon la PPR, et ouvre la PR.

set -euo pipefail

PPR_ID="${1:?Usage: $0 <ppr-id>  ex: PPR-04}"
PPR_FILE="prompt_pr/${PPR_ID}.md"
BRANCH="prompt/${PPR_ID}"

if [[ ! -f "$PPR_FILE" ]]; then
  echo "ERREUR : $PPR_FILE introuvable." >&2
  exit 1
fi

# Extraire le titre de la PPR (première ligne H1)
TITLE=$(grep '^# ' "$PPR_FILE" | head -1 | sed 's/^# //')

git checkout -b "$BRANCH"
git add agents/ prompt_pr/
git commit -m "meta(${PPR_ID}): ${TITLE}

Évolution de prompt générée par l'agent Méta.
PPR : ${PPR_ID}"

git push origin "$BRANCH"

gh pr create \
  --title "${PPR_ID} : ${TITLE}" \
  --body-file "$PPR_FILE" \
  --base main \
  --head "$BRANCH" \
  --label "prompt-pr"

echo ""
echo "Prompt PR créée : $(gh pr view --json url -q .url)"
