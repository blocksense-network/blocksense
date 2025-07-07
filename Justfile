root-dir := justfile_directory()
spin-data-dir := root-dir + "/target/spin-artifacts"
system := `nix eval --raw --impure --expr 'builtins.currentSystem'`
process-compose-artifacts-dir := root-dir + "/config/generated/process-compose"

default:
  @just --list

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
  nix eval --impure -L --json --apply builtins.attrNames \
    .#legacyPackages.{{system}}.process-compose-environments \
    2>/dev/null \
    | jq -r '.[]'

[group('Working with process-compose environments')]
[doc('Build process-compose artifacts for a specific environment or all environments')]
build-environment environment="all":
  #!/usr/bin/env bash
  set -euo pipefail
  if [[ {{environment}} == "all" ]]; then
    srcDir=$(nix build --impure --json -L .#allProcessComposeFiles | jq -r '.[0].outputs.out')
    cp -rf --no-preserve=mode,ownership "$srcDir"/. {{process-compose-artifacts-dir}}
  else
    destDir="{{process-compose-artifacts-dir}}/{{environment}}"
    srcDir=$(nix build --impure -L --json .#legacyPackages.{{system}}.process-compose-environments.{{environment}} | jq -r '.[0].outputs.out')
    cp -rf --no-preserve=mode,ownership "$srcDir" "$destDir"
  fi
  echo "Process Compose artifacts copied to {{process-compose-artifacts-dir}}"

[group('Working with process-compose environments')]
[doc('Start a process-compose environment')]
start-environment environment:
  #!/usr/bin/env bash
  PC_FILE="{{process-compose-artifacts-dir}}/process-compose-{{environment}}.yaml"
  if ! test -f "$PC_FILE"; then
    just build-environment {{environment}}
  fi

  process-compose -f "$PC_FILE"

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
    yarn build-single @blocksense/data-feeds-config-generator
    yarn build-single @blocksense/changelog-generator
  else
    yarn build:recursive {{package}}
  fi

[group('Working with typescript')]
[doc('Run all TypeScript tests')]
test-ts:
  yarn test-single @blocksense/base-utils
  yarn test-single @blocksense/config-types
  yarn test-single @blocksense/data-feeds-config-generator

[group('Working with oracles')]
[doc('Build a specific oracle')]
build-oracle oracle-name:
  #!/usr/bin/env bash
  set -euo pipefail

  cd "{{root-dir}}/apps/oracles/{{oracle-name}}"
  RUST_LOG=trigger=trace cargo build

[group('Working with oracles')]
[doc('Start a specific oracle')]
start-oracle oracle-name:
  #!/usr/bin/env bash
  set -euo pipefail

  export SPIN_DATA_DIR={{spin-data-dir}}

  cd "{{root-dir}}/apps/oracles/{{oracle-name}}"
  RUST_LOG=trigger=info "${SPIN:-spin}" build --up

[group('blocksense')]
[doc('Build Blocksense')]
build-blocksense:
  @{{root-dir}}/scripts/build-blocksense.sh

[group('blocksense')]
[doc('Build Blocksense and start the default process-compose environment')]
start-blocksense:
  #!/usr/bin/env bash
  set -euo pipefail

  just build-blocksense
  process-compose up

[group('General')]
[doc('Run a command to clean the repository of untracked files')]
clean:
  git clean -fdx \
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
