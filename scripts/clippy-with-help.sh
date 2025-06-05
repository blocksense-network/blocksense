#!/usr/bin/env bash
# Wrapper for clippy that provides helpful error messages on failure

set -euo pipefail

echo "🦀 Running Clippy (Rust linter)..."

# Run clippy and capture both exit code and output
if cargo clippy --all-targets --all-features --tests -- -D warnings; then
    echo "✅ Clippy passed!"
    exit 0
else
    exit_code=$?
    echo ""
    echo "❌ Clippy (Rust linting) failed!"
    echo ""
    echo "🔧 The commit was rejected due to Rust code issues."
    echo ""
    echo "🔍 To fix the issues:"
    echo "  just fix-lint-rust    # Auto-fix what's possible"
    echo ""
    echo "📝 Manual review may be needed:"
    echo "  just lint-rust        # See all issues"
    echo "  cargo clippy --tests  # Run clippy directly"
    echo ""
    echo "💡 Some Clippy issues require manual fixes (logic, performance, style)."
    echo ""
    echo "💡 TIP: Run 'just --list' to see all available commands"
    echo ""
    exit $exit_code
fi
