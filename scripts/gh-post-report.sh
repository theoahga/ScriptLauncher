#!/usr/bin/env bash
# scripts/gh-post-report.sh
# Usage : ./scripts/gh-post-report.sh <pr-number> <story-id>
#
# Poste le rapport de tests comme commentaire sur la PR.

set -euo pipefail

PR_NUMBER="${1:?Usage: $0 <pr-number> <story-id>  ex: 42 S-02}"
STORY_ID="${2:?Usage: $0 <pr-number> <story-id>}"

REPORT="artifacts/${STORY_ID}/test_report.md"
MOD_REPORT="artifacts/${STORY_ID}/modernization_report.md"

if [[ ! -f "$REPORT" ]]; then
  echo "ERREUR : $REPORT introuvable." >&2
  exit 1
fi

# Rapport de tests
gh pr comment "$PR_NUMBER" --body-file "$REPORT"

# Rapport de modernisation (si présent)
if [[ -f "$MOD_REPORT" ]]; then
  gh pr comment "$PR_NUMBER" --body-file "$MOD_REPORT"
fi

echo "Rapports postés sur PR #${PR_NUMBER}"
