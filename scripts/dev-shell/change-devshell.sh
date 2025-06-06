#!/usr/bin/env bash
set -euo pipefail

source "${BASH_SOURCE%/*}/../utils/ansi.sh"

# Script to change dev shell environment
# Usage: change-devshell.sh [shell-name]

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="$ROOT_DIR/.env"
SHELL_NAME="${1:-default}"
SHELL_NAME_STYLED="${BOLD}${SHELL_NAME}${RESET}"

# Get available shells
AVAILABLE_SHELLS=$("$ROOT_DIR/scripts/dev-shell/get-available-shells.sh")
SHELLS_LIST=$(echo "$AVAILABLE_SHELLS" | tr '\n' ' ')

# Validate shell option
if ! echo "$SHELLS_LIST" | grep -q "\b$SHELL_NAME\b"; then
    echo  -e "Error: Invalid shell $SHELL_NAME_STYLED. Available options: $(echo "${BOLD}$SHELLS_LIST${RESET}" | sed 's/ /, /g' | sed 's/, $//')"
    exit 1
fi

# Check if the current shell is already the requested one
if [[ -f "$ENV_FILE" && $(grep -q "^DEV_SHELL=" "$ENV_FILE") ]]; then
    CURRENT_SHELL=$(grep "^DEV_SHELL=" "$ENV_FILE" | cut -d'=' -f2-)
    if [[ "$CURRENT_SHELL" == "$SHELL_NAME" ]]; then
        echo -e "✅ Already using the $SHELL_NAME_STYLED dev shell. No changes made."
        exit 0
    fi
fi

echo -e "🔄 Switching to $SHELL_NAME_STYLED dev shell..."

# Update or create .env file
if [[ -f "$ENV_FILE" ]]; then
    # Update existing .env file
    if grep -q "^DEV_SHELL=" "$ENV_FILE"; then
        sed -i "s/^DEV_SHELL=.*/DEV_SHELL=$SHELL_NAME/" "$ENV_FILE"
    else
        echo "DEV_SHELL=$SHELL_NAME" >> "$ENV_FILE"
    fi
else
    # Create new .env file
    echo "DEV_SHELL=$SHELL_NAME" > "$ENV_FILE"
fi

# Reload direnv
echo "Reloading direnv..."
direnv reload
