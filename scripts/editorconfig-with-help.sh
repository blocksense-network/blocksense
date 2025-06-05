#!/usr/bin/env bash
# Wrapper for editorconfig-checker that provides helpful error messages on failure

set -euo pipefail

echo "⚙️  Running EditorConfig checker..."

# Run editorconfig-checker and capture both exit code and output
if editorconfig-checker; then
    echo "✅ EditorConfig passed!"
    exit 0
else
    exit_code=$?
    echo ""
    echo "❌ EditorConfig compliance failed!"
    echo ""
    echo "🔧 The commit was rejected due to formatting inconsistencies."
    echo ""
    echo "🔍 Common issues and manual fixes:"
    echo "  • Trailing whitespace: Remove spaces at end of lines"
    echo "  • Wrong line endings: Ensure LF (not CRLF) line endings"
    echo "  • Tabs vs spaces: Use spaces for indentation"
    echo "  • Missing final newline: Add newline at end of files"
    echo ""
    echo "🔍 Check specific issues:"
    echo "  just check-editorconfig"
    echo ""
    echo "⚙️  Prevention:"
    echo "  • Install EditorConfig plugin in your editor"
    echo "  • Configure editor to trim trailing whitespace on save"
    echo ""
    echo "💡 TIP: Run 'just --list' to see all available commands"
    echo ""
    exit $exit_code
fi
