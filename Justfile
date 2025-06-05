root-dir := justfile_directory()
spin-data-dir := root-dir + "/target/spin-artifacts"

default:
  @just --list

build-ts package="all":
  #!/usr/bin/env bash
  set -euo pipefail
  if [[ {{package}} == "all" ]]; then
    yarn build-single @blocksense/base-utils
    yarn build-single @blocksense/config-types
    yarn build-single @blocksense/sol-reflector
    yarn build-single @blocksense/contracts
    yarn build-single @blocksense/data-feeds-config-generator
  else
    yarn workspace {{package}} run build
  fi

test-ts:
  yarn test-single @blocksense/base-utils
  yarn test-single @blocksense/config-types
  yarn test-single @blocksense/data-feeds-config-generator

build-oracle oracle-name:
  #!/usr/bin/env bash
  set -euo pipefail

  cd "{{root-dir}}/apps/oracles/{{oracle-name}}"
  RUST_LOG=trigger=trace "${SPIN:-spin}" build

start-oracle oracle-name:
  #!/usr/bin/env bash
  set -euo pipefail

  export SPIN_DATA_DIR={{spin-data-dir}}

  cd "{{root-dir}}/apps/oracles/{{oracle-name}}"
  RUST_LOG=trigger=info "${SPIN:-spin}" build --up

build-blocksense:
  @{{root-dir}}/scripts/build-blocksense.sh

start-blocksense:
  #!/usr/bin/env bash
  set -euo pipefail

  just build-blocksense
  process-compose up

clean:
  git clean -fdx \
    -e .env \
    -e .direnv \
    -e .yarn \
    -e .vscode \
    -e .pre-commit-config.yaml \
    -- {{root-dir}}

# === FORMATTING COMMANDS ===

format-js:
  #!/usr/bin/env bash
  set -euo pipefail
  echo "📝 Formatting TypeScript/JavaScript/Markdown files..."
  yarn prettier --write .

format-rust:
  #!/usr/bin/env bash
  set -euo pipefail
  echo "🦀 Formatting Rust files..."
  cargo fmt

format-nix:
  #!/usr/bin/env bash
  set -euo pipefail
  echo "❄️  Formatting Nix files..."
  nix fmt

format:
  #!/usr/bin/env bash
  set -euo pipefail
  echo "🔧 Running all formatters..."
  just format-js
  just format-rust
  just format-nix
  echo "✅ All formatting complete!"

# === LINTING COMMANDS ===

lint-rust:
  #!/usr/bin/env bash
  set -euo pipefail
  echo "🦀 Running Clippy (Rust linter)..."
  cargo clippy --all-targets --all-features

lint-nix:
  #!/usr/bin/env bash
  set -euo pipefail
  echo "❄️  Running Statix (Nix linter)..."
  statix check .

lint-nix-deadcode:
  #!/usr/bin/env bash
  set -euo pipefail
  echo "🧹 Checking for dead Nix code..."
  deadnix .

lint:
  #!/usr/bin/env bash
  set -euo pipefail
  echo "🔍 Running all linters..."
  just lint-rust
  just lint-nix
  just lint-nix-deadcode
  echo "✅ All linting complete!"

# === LINTING FIX COMMANDS ===

fix-lint-rust:
  #!/usr/bin/env bash
  set -euo pipefail
  echo "🦀 Running Clippy with fixes..."
  cargo clippy --fix --allow-dirty --allow-staged

fix-lint-nix:
  #!/usr/bin/env bash
  set -euo pipefail
  echo "❄️  Running Statix fixes..."
  statix fix .

fix-lint-nix-deadcode:
  #!/usr/bin/env bash
  set -euo pipefail
  echo "🧹 Running Deadnix cleanup..."
  deadnix --edit .

lint-fix:
  #!/usr/bin/env bash
  set -euo pipefail
  echo "🔍 Running linters with auto-fix..."
  just fix-lint-rust
  just fix-lint-nix
  just fix-lint-nix-deadcode
  echo "✅ All linting fixes complete!"

# === EDITORCONFIG ===

check-editorconfig:
  #!/usr/bin/env bash
  set -euo pipefail
  echo "⚙️  Checking EditorConfig compliance..."
  editorconfig-checker

# === COMBINED COMMANDS ===

check-all:
  #!/usr/bin/env bash
  set -euo pipefail
  echo "🔍 Running all checks (formatting + linting + editorconfig)..."
  just lint
  just check-editorconfig
  echo "✅ All checks complete!"

fix-all:
  #!/usr/bin/env bash
  set -euo pipefail
  echo "🔧 Running all fixes (formatting + linting)..."
  just format
  just lint-fix
  echo "✅ All fixes complete!"
