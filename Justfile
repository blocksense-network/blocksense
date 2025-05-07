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

  NO_COLOR=${NO_COLOR:-""}

  task_heading() {
    local readonly PREFIX_COLOR='\x1b[1;92m'
    local readonly TEXT_COLOR='\x1b[1;37m'
    local readonly STYLE_RESET='\x1b[0m'
    local readonly PREFIX_SYMBOL="➔"
    local message="$1"

    if [[ -n "$NO_COLOR" ]]; then
      echo "--- ${message} ---"
    else
      echo -e "${PREFIX_COLOR}${PREFIX_SYMBOL} ${TEXT_COLOR}${message}...${STYLE_RESET}"
    fi
  }

  task_heading 'Building workspace'
  cargo build --release

  task_heading 'Installing trigger-oracle spin plugin'
  $GIT_ROOT/scripts/install_trigger_oracle_plugin.sh 2>&1 | sed 's/^/    /'

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
