#!/usr/bin/env bash
# scripts/gh-read-review.sh
# Usage : ./scripts/gh-read-review.sh <pr-number> [story-id]
#
# Lit les commentaires de review humaine sur la PR et les écrit dans
# artifacts/S-XX/human_review.md pour que les agents puissent les lire.

set -euo pipefail

PR_NUMBER="${1:?Usage: $0 <pr-number> [story-id]}"
STORY_ID="${2:-}"

OUTPUT_FILE=""
if [[ -n "$STORY_ID" ]]; then
  mkdir -p "artifacts/${STORY_ID}"
  OUTPUT_FILE="artifacts/${STORY_ID}/human_review.md"
fi

echo "=== Review comments — PR #${PR_NUMBER} ==="
echo ""

# Statut général
gh pr view "$PR_NUMBER" --json state,reviewDecision,title \
  | jq -r '"Titre : \(.title)\nStatut : \(.state)\nDécision : \(.reviewDecision // "en attente")"'

echo ""
echo "=== Commentaires ==="

gh pr view "$PR_NUMBER" --json comments \
  | jq -r '.comments[] | "[\(.author.login)] \(.createdAt)\n\(.body)\n---"'

echo ""
echo "=== Reviews ==="

gh pr reviews "$PR_NUMBER" --json author,state,body \
  | jq -r '.[] | "[\(.author.login)] \(.state)\n\(.body)\n---"'

# Sauvegarde pour les agents
if [[ -n "$OUTPUT_FILE" ]]; then
  {
    echo "# Review humaine — PR #${PR_NUMBER}"
    echo ""
    gh pr view "$PR_NUMBER" --json state,reviewDecision,title \
      | jq -r '"**Titre** : \(.title)\n**Statut** : \(.state)\n**Décision** : \(.reviewDecision // "en attente")"'
    echo ""
    echo "## Commentaires"
    echo ""
    gh pr view "$PR_NUMBER" --json comments \
      | jq -r '.comments[] | "> [\(.author.login)] \(.createdAt)\n\n\(.body)\n"'
    echo ""
    echo "## Reviews formelles"
    echo ""
    gh pr reviews "$PR_NUMBER" --json author,state,body \
      | jq -r '.[] | "> [\(.author.login)] **\(.state)**\n\n\(.body)\n"'
  } > "$OUTPUT_FILE"
  echo ""
  echo "Sauvegardé dans $OUTPUT_FILE"
fi
