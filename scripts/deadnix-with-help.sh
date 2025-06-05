#!/usr/bin/env bash
# Wrapper for deadnix that provides helpful error messages on failure

set -euo pipefail

echo "🧹 Running Deadnix (dead Nix code detection)..."

# Run deadnix and capture both exit code and output
if deadnix --fail .; then
    echo "✅ Deadnix passed!"
    exit 0
else
    exit_code=$?
    echo ""
    echo "❌ Deadnix (dead Nix code detection) failed!"
    echo ""
    echo "🔧 The commit was rejected due to unused Nix code."
    echo ""
    echo "🔍 To fix the issues:"
    echo "  just fix-lint-nix-deadcode  # Remove dead code automatically"
    echo ""
    echo "📝 Check what was found:"
    echo "  just lint-nix-deadcode      # See unused code"
    echo "  deadnix .                   # Run deadnix directly"
    echo ""
    echo "💡 Deadnix finds unused variable bindings and imports in Nix files."
    echo ""
    echo "💡 TIP: Run 'just --list' to see all available commands"
    echo ""
    exit $exit_code
fi
