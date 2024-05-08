#!/usr/bin/env bash

set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
DIR="$ROOT/libs/sdk/examples"

example_name="$1"

(
  cd "$DIR/$example_name"
  RUST_LOG=trigger=trace spin build --up
)
