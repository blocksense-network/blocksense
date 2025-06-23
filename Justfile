root-dir := justfile_directory()
spin-data-dir := root-dir + "/target/spin-artifacts"
system := `nix eval --raw --impure --expr 'builtins.currentSystem'`
process-compose-artifacts-dir := root-dir + "/config/generated/process-compose"

default:
  @just --list

# Switch to a different dev shell environment
change-devshell shell="default":
  @{{root-dir}}/scripts/dev-shell/change-devshell.sh {{shell}}

# List available dev shell environments
list-devshells:
  @{{root-dir}}/scripts/dev-shell/list-devshells.sh

# List available process compose environments
list-environments:
  #!/usr/bin/env bash
  nix eval --impure -L --json --apply builtins.attrNames \
    .#legacyPackages.{{system}}.process-compose-environments \
    2>/dev/null \
    | jq -r '.[]'

# Build process compose artifacts for a specific environment or all environments
build-environment environment="all":
  #!/usr/bin/env bash
  set -euo pipefail
  if [[ {{environment}} == "all" ]]; then
    nix build --impure -L --json .#allProcessComposeFiles \
      | jq -r '.[0].outputs.out' \
      | xargs -I{} cp -rfs {}/. {{process-compose-artifacts-dir}}
  else
    nix build --impure -L --json .#legacyPackages.{{system}}.process-compose-environments.{{environment}} \
      | jq -r '.[0].outputs.out' \
      | xargs -I{} cp -rfs {} {{process-compose-artifacts-dir}}/{{environment}}-process-compose.yaml
  fi
  echo "Process Compose artifacts copied to {{process-compose-artifacts-dir}}"

# Start a specific process compose environment
start-environment environment:
  #!/usr/bin/env bash
  PC_FILE="{{process-compose-artifacts-dir}}/{{environment}}-process-compose.yaml"
  if ! test -f "$PC_FILE"; then
    just build-environment {{environment}}
  fi

  process-compose -f "$PC_FILE"

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

[working-directory: 'libs/ts/contracts']
deploy-evm-contracts network-name:
  yarn hardhat deploy --networks {{network-name}}
