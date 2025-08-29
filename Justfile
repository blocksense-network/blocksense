root-dir := justfile_directory()
spin-data-dir := root-dir + "/target/spin-artifacts"
process-compose-artifacts-dir := root-dir + "/config/generated/process-compose"

default:
  @just --list

dev *args:
  @yarn workspace @blocksense/dev run start {{args}}

[group('Working with devshells')]
[doc('Switch to a different dev shell environment')]
change-devshell shell="default":
  @{{root-dir}}/scripts/dev-shell/change-devshell.sh {{shell}}

[group('Working with devshells')]
[doc('List available dev shell environments')]
list-devshells:
  @{{root-dir}}/scripts/dev-shell/list-devshells.sh

[group('Working with process-compose environments')]
[doc('List available process-compose environments')]
list-environments:
  #!/usr/bin/env bash
  nix eval -L --json --apply builtins.attrNames \
    .#legacyPackages.${system}.process-compose-environments.with-local-cargo-artifacts \
    2>/dev/null \
    | jq -r '.[]'

[group('Working with process-compose environments')]
[doc('Build process-compose artifacts for a specific environment or all environments')]
build-environment environment="all" use-local-cargo-result="0":
  #!/usr/bin/env bash
  set -euo pipefail

  echo "Building process-compose environment: {{environment}}"

  if [[ "{{use-local-cargo-result}}" = 1 ]]; then
    FLAKE_ATTR_PATH=process-compose-environments.with-local-cargo-artifacts.{{environment}}
  else
    FLAKE_ATTR_PATH=process-compose-environments.hermetic.{{environment}}
  fi

  if [[ {{environment}} == "all" ]]; then
    DEST_DIR="{{process-compose-artifacts-dir}}"
  else
    DEST_DIR="{{process-compose-artifacts-dir}}/{{environment}}"
  fi

  # Collect free ports that process-compose will use
  mkdir -p "$DEST_DIR"
  scripts/utils/collect-available-ports.sh "$DEST_DIR/available-ports"

  SRC_DIR=$(
    nix build --no-warn-dirty --impure -L --print-out-paths \
      .#${FLAKE_ATTR_PATH} \
      2> >(grep -v '^Using saved setting for' >&2)
  )

  cp -rf --no-preserve=mode,ownership "$SRC_DIR"/. "$DEST_DIR"
  echo "Process Compose artifacts copied to $DEST_DIR"

[group('Working with process-compose environments')]
[doc('Start a process-compose environment. This command depends on building blocksense and the environment first')]
start-environment environment use-local-cargo-result="0" *pc-flags: (build-environment environment use-local-cargo-result)
  #!/usr/bin/env bash
  if [[ "{{use-local-cargo-result}}" = 1 ]]; then
    just build-blocksense
  fi

  PC_FILE="{{process-compose-artifacts-dir}}/{{environment}}/process-compose.yaml"
  process-compose up {{pc-flags}} -f "$PC_FILE"

stop-environment:
  process-compose down

[group('Working with typescript')]
[doc('Build single TypeScript package or all packages')]
build-ts package="all":
  #!/usr/bin/env bash
  set -euo pipefail
  if [[ {{package}} == "all" ]]; then
    yarn build-single @blocksense/base-utils
    yarn build-single @blocksense/config-types
    yarn build-single @blocksense/sol-reflector
    yarn build-single @blocksense/contracts
    yarn build-single @blocksense/decoders
    yarn build-single @blocksense/data-feeds-config-generator
    yarn build-single @blocksense/dev
    yarn build-single @blocksense/adfs-indexer
    yarn build-single @blocksense/chain-interactions
    yarn build-single @blocksense/avm-relayer
  else
    yarn build:recursive {{package}}
  fi

[group('Working with typescript')]
[doc('Run all TypeScript tests')]
test-ts:
  yarn test-single @blocksense/base-utils
  yarn test-single @blocksense/config-types
  yarn test-single @blocksense/data-feeds-config-generator
  yarn test-single @blocksense/dev
  yarn test-single @blocksense/adfs-indexer
  yarn test-single @blocksense/chain-interactions
  yarn test-single @blocksense/avm-relayer
  yarn workspace @blocksense/e2e-tests run test:unit

test-e2e:
  yarn workspace @blocksense/e2e-tests run test:scenarios

[group('Working with oracles')]
[doc('Build a specific oracle')]
build-oracle oracle-name:
  #!/usr/bin/env bash
  set -euo pipefail

  cd "{{root-dir}}/apps/oracles/{{oracle-name}}"
  RUST_LOG=trigger=trace cargo build

[group('Working with oracles')]
[doc('Start a specific oracle')]
start-oracle oracle-name trigger-oracle-build-type="--use-local-cargo-artifacts":
  #!/usr/bin/env bash
  set -euo pipefail

  if [[ "{{trigger-oracle-build-type}}" = "--use-local-cargo-artifacts" ]]; then
    export SPIN_DATA_DIR={{spin-data-dir}}
    export SPIN="$(nix build --print-out-paths "{{root-dir}}#spin")/bin/spin"
    just build-blocksense
  elif [[ "{{trigger-oracle-build-type}}" = "--hermetic" ]]; then
    export SPIN="$(nix build --print-out-paths "{{root-dir}}#spinWrapped")/bin/spin"
  else
    echo "Invalid trigger-oracle-build-type: {{trigger-oracle-build-type}}"
    echo -e "Valid values are:\n  --use-local-cargo-artifacts\n  --hermetic"
    exit 1
  fi

  cd "{{root-dir}}/apps/oracles/{{oracle-name}}"
  RUST_LOG=trigger=info "$SPIN" build --up

[group('blocksense')]
[doc('Build Blocksense')]
build-blocksense:
  @{{root-dir}}/scripts/build-blocksense.sh

[group('General')]
[doc('Run a command to clean the repository of untracked files')]
clean:
  git clean -fdx \
    -e .jj \
    -e .env \
    -e .direnv \
    -e .vscode \
    -e .pre-commit-config.yaml \
    -- {{root-dir}}

[group('Working with evm contracts')]
[doc('Deploy EVM contracts to a specific network')]
[working-directory: 'libs/ts/contracts']
deploy-evm-contracts network-name:
  yarn hardhat deploy --networks {{network-name}}
