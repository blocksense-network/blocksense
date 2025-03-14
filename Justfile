root-dir := justfile_directory()

default:
  @just --list

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

clean:
  git clean -fdx \
    -e .env \
    -e .direnv \
    -e .yarn \
    -e .vscode \
    -e .pre-commit-config.yaml \
    -- {{root-dir}}
