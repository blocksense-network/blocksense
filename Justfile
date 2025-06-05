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

publish-ui version="patch":
  #!/usr/bin/env bash
  set -euo pipefail

  cd "{{root-dir}}/libs/ts/ui"

  echo "🚀 Publishing @blocksense/ui..."

  # Update version
  npm version {{version}}

  # Build package
  yarn build-tailwind

  # Publish
  npm publish

  # Create git tag
  git add package.json
  git commit -m "chore: release @blocksense/ui@$(node -p "require('./package.json').version")"
  git tag "ui-v$(node -p "require('./package.json').version")"

  echo "✅ Published @blocksense/ui@$(node -p "require('./package.json').version")"
