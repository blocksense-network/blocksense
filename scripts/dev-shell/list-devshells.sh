#!/usr/bin/env bash
set -euo pipefail

source "${BASH_SOURCE%/*}/../utils/ansi.sh"

# Script to list available dev shell environments
# Shows which shell is currently active

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="$ROOT_DIR/.env"

echo "🐚 Available dev shell environments:"
echo

# Get available shells using helper script
AVAILABLE_SHELLS=$("$ROOT_DIR/scripts/dev-shell/get-available-shells.sh")

echo "$AVAILABLE_SHELLS" | while read -r shell; do
    if [[ -f "$ENV_FILE" ]] && grep -q "^DEV_SHELL=$shell$" "$ENV_FILE"; then
        echo -e "  • ${BOLD}$shell${RESET} (currently active)"
    else
        echo -e "  • ${BOLD}$shell${RESET}"
    fi
done

echo
echo "💡 Switch to a shell with: just change-devshell <shell-name>"
