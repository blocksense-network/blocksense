root-dir := justfile_directory()
spin-data-dir := root-dir + "/target/spin-artifacts"

default:
  @just --list

# Switch to a different dev shell environment
change-devshell shell="default":
  @{{root-dir}}/scripts/dev-shell/change-devshell.sh {{shell}}

# List available dev shell environments
list-devshells:
  @{{root-dir}}/scripts/dev-shell/list-devshells.sh

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
    yarn build:recursive {{package}}
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
