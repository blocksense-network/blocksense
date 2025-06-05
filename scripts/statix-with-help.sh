#!/usr/bin/env bash
# Wrapper for statix that provides helpful error messages on failure

set -euo pipefail

echo "❄️  Running Statix (Nix linter)..."

# Run statix and capture both exit code and output
if statix check .; then
    echo "✅ Statix passed!"
    exit 0
else
    exit_code=$?
    echo ""
    echo "❌ Statix (Nix linting) failed!"
    echo ""
    echo "🔧 The commit was rejected due to Nix code issues."
    echo ""
    echo "🔍 To fix the issues:"
    echo "  just fix-lint-nix     # Auto-fix most issues"
    echo ""
    echo "📝 Check what was found:"
    echo "  just lint-nix         # See all issues"
    echo "  statix check .        # Run statix directly"
    echo ""
    echo "💡 Statix checks for deprecated patterns and best practices in Nix."
    echo ""
    echo "💡 TIP: Run 'just --list' to see all available commands"
    echo ""
    exit $exit_code
fi
