#!/usr/bin/env bash
# scripts/check-env.sh
#
# Vérifie que tous les outils nécessaires sont installés et configurés.
# Lance depuis la racine du repo : ./scripts/check-env.sh

set -uo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m'

ERRORS=0
WARNINGS=0

ok()   { echo -e "  ${GREEN}✓${NC}  $1"; }
fail() { echo -e "  ${RED}✗${NC}  $1"; ((ERRORS++)); }
warn() { echo -e "  ${YELLOW}!${NC}  $1"; ((WARNINGS++)); }
section() { echo ""; echo -e "${BOLD}$1${NC}"; }

# ─── Outils système ───────────────────────────────────────────────

section "Outils système"

if command -v git &>/dev/null; then
  GIT_VERSION=$(git --version | awk '{print $3}')
  ok "git $GIT_VERSION"
else
  fail "git non trouvé — installer via https://git-scm.com"
fi

if command -v curl &>/dev/null; then
  ok "curl $(curl --version | head -1 | awk '{print $2}')"
else
  fail "curl non trouvé"
fi

if command -v jq &>/dev/null; then
  ok "jq $(jq --version)"
else
  fail "jq non trouvé — brew install jq  /  sudo apt install jq"
fi

if command -v rsync &>/dev/null; then
  ok "rsync disponible"
else
  warn "rsync non trouvé — gh-create-pr.sh en aura besoin (brew install rsync)"
fi

# ─── GitHub CLI ───────────────────────────────────────────────────

section "GitHub CLI (gh)"

if command -v gh &>/dev/null; then
  GH_VERSION=$(gh --version | head -1 | awk '{print $3}')
  ok "gh $GH_VERSION"

  # Auth
  if gh auth status &>/dev/null 2>&1; then
    GH_USER=$(gh api user -q .login 2>/dev/null || echo "inconnu")
    ok "gh auth — connecté en tant que $GH_USER"
  else
    fail "gh non authentifié — lancer : gh auth login"
  fi

  # Token scope
  if [[ -n "${GITHUB_TOKEN:-}" ]]; then
    ok "GITHUB_TOKEN présent dans l'environnement"
  else
    warn "GITHUB_TOKEN absent — gh utilisera ses propres credentials (OK pour usage interactif)"
    warn "Pour les agents : export GITHUB_TOKEN=\$(gh auth token)"
  fi
else
  fail "gh non trouvé — https://cli.github.com"
  warn "Installation : brew install gh  /  sudo apt install gh"
fi

# ─── Node / npm ───────────────────────────────────────────────────

section "Node.js / npm"

if command -v node &>/dev/null; then
  NODE_VERSION=$(node --version)
  NODE_MAJOR=$(echo "$NODE_VERSION" | tr -d 'v' | cut -d. -f1)
  if [[ "$NODE_MAJOR" -ge 20 ]]; then
    ok "node $NODE_VERSION"
  else
    fail "node $NODE_VERSION — version 20+ requise (brew install node  /  nvm install 20)"
  fi
else
  fail "node non trouvé — https://nodejs.org"
fi

if command -v npm &>/dev/null; then
  ok "npm $(npm --version)"
else
  fail "npm non trouvé"
fi

# ─── Rust / Cargo ─────────────────────────────────────────────────

section "Rust / Cargo"

if command -v rustc &>/dev/null; then
  ok "rustc $(rustc --version | awk '{print $2}')"
else
  fail "rustc non trouvé — curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
fi

if command -v cargo &>/dev/null; then
  ok "cargo $(cargo --version | awk '{print $2}')"
else
  fail "cargo non trouvé — installer via rustup"
fi

if command -v rustup &>/dev/null; then
  TOOLCHAIN=$(rustup show active-toolchain 2>/dev/null | awk '{print $1}')
  ok "rustup — toolchain actif : $TOOLCHAIN"
  # Vérifier stable
  if rustup toolchain list | grep -q "stable"; then
    ok "toolchain stable disponible"
  else
    warn "toolchain stable absent — rustup toolchain install stable"
  fi
else
  warn "rustup absent — gestion des toolchains impossible"
fi

# ─── Tauri ────────────────────────────────────────────────────────

section "Tauri"

if command -v cargo-tauri &>/dev/null || cargo tauri --version &>/dev/null 2>&1; then
  ok "cargo-tauri disponible"
else
  warn "cargo-tauri absent — sera installé par npm lors du setup Tauri"
  warn "Ou : cargo install tauri-cli"
fi

# Dépendances système Tauri (Linux uniquement)
if [[ "$(uname)" == "Linux" ]]; then
  MISSING_LIBS=()
  for lib in libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev; do
    if ! dpkg -l "$lib" &>/dev/null 2>&1; then
      MISSING_LIBS+=("$lib")
    fi
  done
  if [[ ${#MISSING_LIBS[@]} -eq 0 ]]; then
    ok "dépendances système Tauri (Linux) présentes"
  else
    fail "dépendances manquantes : ${MISSING_LIBS[*]}"
    warn "sudo apt install ${MISSING_LIBS[*]}"
  fi
fi

if [[ "$(uname)" == "Darwin" ]]; then
  if xcode-select -p &>/dev/null 2>&1; then
    ok "Xcode Command Line Tools présents"
  else
    fail "Xcode CLT absent — xcode-select --install"
  fi
fi

# ─── Claude Code ──────────────────────────────────────────────────

section "Claude Code"

if command -v claude &>/dev/null; then
  CLAUDE_VERSION=$(claude --version 2>/dev/null | head -1 || echo "version inconnue")
  ok "claude — $CLAUDE_VERSION"
else
  fail "claude non trouvé"
  warn "Installation : npm install -g @anthropic-ai/claude-code"
  warn "Ou : https://docs.claude.ai/claude-code"
fi

# ─── Structure repo ───────────────────────────────────────────────

section "Structure du repo"

for f in CLAUDE.md .gitignore .github/workflows/ci.yml; do
  if [[ -f "$f" ]]; then
    ok "$f présent"
  else
    fail "$f manquant"
  fi
done

for d in agents scripts prompt_pr; do
  if [[ -d "$d" ]]; then
    ok "dossier $d/ présent"
  else
    fail "dossier $d/ manquant"
  fi
done

AGENT_COUNT=$(ls agents/*.md 2>/dev/null | grep -v history | wc -l | tr -d ' ')
if [[ "$AGENT_COUNT" -ge 7 ]]; then
  ok "$AGENT_COUNT fichiers agents présents"
else
  fail "agents incomplets — $AGENT_COUNT/7 fichiers trouvés"
fi

# Scripts exécutables
for s in scripts/gh-create-pr.sh scripts/gh-post-report.sh scripts/gh-read-review.sh scripts/gh-create-prompt-pr.sh; do
  if [[ -x "$s" ]]; then
    ok "$s exécutable"
  elif [[ -f "$s" ]]; then
    warn "$s présent mais non exécutable — chmod +x $s"
  else
    fail "$s manquant"
  fi
done

# Artifacts ignoré par git
if git check-ignore -q artifacts/ 2>/dev/null; then
  ok "artifacts/ dans .gitignore"
else
  warn "artifacts/ non ignoré par git — vérifier .gitignore"
fi

# ─── Résumé ───────────────────────────────────────────────────────

echo ""
echo "────────────────────────────────"
if [[ $ERRORS -eq 0 && $WARNINGS -eq 0 ]]; then
  echo -e "${GREEN}${BOLD}Tout est en ordre. Prêt à démarrer.${NC}"
elif [[ $ERRORS -eq 0 ]]; then
  echo -e "${YELLOW}${BOLD}$WARNINGS avertissement(s) — fonctionnel mais incomplet.${NC}"
else
  echo -e "${RED}${BOLD}$ERRORS erreur(s), $WARNINGS avertissement(s) — corriger avant de continuer.${NC}"
fi
echo "────────────────────────────────"
echo ""

exit $ERRORS
