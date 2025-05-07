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
  @{{root-dir}}/scripts/build-blocksense.sh

start-blocksense:
  #!/usr/bin/env bash
  set -euo pipefail

  just build-blocksense
  process-compose up

eval-machine machine commit="working-tree":
  #!/usr/bin/env bash
  set -euo pipefail
  if [[ "{{ commit }}" == "working-tree" ]]; then
    NIX_TARGET="{{ root-dir }}"
  else
    NIX_TARGET="github:blocksense-network/blocksense?rev={{commit}}"
  fi
  nix eval --raw "${NIX_TARGET}#nixosConfigurations.{{machine}}.config.system.build.toplevel.outPath"

run-tests:
  #!/usr/bin/env bash
  set -euo pipefail
  nix eval --json .#legacyPackages.x86_64-linux.nixosTests --apply "builtins.attrNames" | \
    jq -r '.[]' | \
    xargs -I {} \
    nix build --option sandbox false -L --json --accept-flake-config .#legacyPackages.x86_64-linux.nixosTests.{}

clean:
  git clean -fdx \
    -e .env \
    -e .direnv \
    -e .yarn \
    -e .vscode \
    -e .pre-commit-config.yaml \
    -- {{root-dir}}
