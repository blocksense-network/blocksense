#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"
# Get the current `system` (e.g., `x86_64-linux`, `aarch64-darwin`)
SYSTEM=$(nix eval --raw --impure --expr 'builtins.currentSystem')
# Use `nix eval` to get the names of the devShells for said `system`
# Output is a newline-separated list of the names
nix eval --json ".#devShells.${SYSTEM}" --apply builtins.attrNames 2>/dev/null | jq -r '.[]'
