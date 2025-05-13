root-dir := justfile_directory()

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
  cd "{{root-dir}}/apps/oracles/{{oracle-name}}"
  RUST_LOG=trigger=info "${SPIN:-spin}" build --up

build-blocksense:
  #!/usr/bin/env bash
  set -euo pipefail

  source {{root-dir}}/scripts/utils/task-heading.sh

  task_heading 'Building workspace'
  cargo build --release

  task_heading 'Installing trigger-oracle spin plugin'
  $GIT_ROOT/scripts/install_trigger_oracle_plugin.sh 2>&1 | sed 's/^/    /'

  task_heading 'Building oracle scripts'
  just build-all-oracle-scripts

start-blocksense:
  #!/usr/bin/env bash
  set -euo pipefail

  just build-blocksense
  process-compose up

build-oracle-script name:
  #!/usr/bin/env bash
  set -euo pipefail

  cargo build \
    --manifest-path {{root-dir}}/apps/oracles/{{name}}/Cargo.toml \
    --target wasm32-wasip1 \
    --target-dir {{root-dir}}/target

build-all-oracle-scripts:
  #!/usr/bin/env bash
  set -euo pipefail

  for crate_dir in {{root-dir}}/apps/oracles/*/; do
    crate_name=$(basename $(dirname $crate_dir$))
    just build-oracle-script $crate_name
  done

clean:
  git clean -fdx \
    -e .env \
    -e .direnv \
    -e .yarn \
    -e .vscode \
    -e .pre-commit-config.yaml \
    -- {{root-dir}}
