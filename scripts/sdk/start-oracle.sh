#!/usr/bin/env bash

set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
DIR="$ROOT/apps/oracles"

oracle_name="$1"

MY_SPIN="${SPIN_BIN:-spin}"
(
  cd "$DIR/$oracle_name"
  RUST_LOG=trigger=trace $MY_SPIN build --up
)
