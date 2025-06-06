#!/usr/bin/env bash
set -euo pipefail

# Get available dev shells from nix flake
# This script works around devenv's directory detection issues by using a simpler approach

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

# Try to get shells from nix develop command instead of flake show
# This is more reliable with devenv
get_shells_from_develop() {
    local shells=""

    # Check if each known shell exists by trying nix develop
    for shell in default rust js pre-commit; do
        if nix develop ".#$shell" --command true 2>/dev/null; then
            shells="$shells$shell\n"
        fi
    done

    if [[ -n "$shells" ]]; then
        echo -e "$shells" | sed '/^$/d' | sort
        return 0
    fi

    return 1
}

# Fallback: try to parse flake.nix directly for shell definitions
get_shells_from_flake_file() {
    if [[ -f "nix/shells/default.nix" ]]; then
        grep -E '^\s*[a-zA-Z-]+ = createShell' "nix/shells/default.nix" | \
        sed -E 's/^\s*([a-zA-Z-]+) = createShell.*/\1/' | \
        sort
    fi
}

# Try different methods to get available shells
if available_shells=$(get_shells_from_develop); then
    echo "$available_shells"
elif available_shells=$(get_shells_from_flake_file); then
    echo "$available_shells"
else
    # Final fallback to known shells
    echo -e "default\nrust\njs\npre-commit"
fi
