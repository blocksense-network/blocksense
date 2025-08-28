#!/usr/bin/env bash

set -euo pipefail

RESET="\033[0m"
BOLD="\033[1m"
NOBOLD="\033[22m"
RED="\033[31m"

if [[ -z "${SPIN:-}" ]] || [[ -z "${SPIN_DATA_DIR:-}" ]]; then
  echo -e "${RED}${BOLD}SPIN${NOBOLD} and ${BOLD}SPIN_DATA_DIR${NOBOLD} environment variables must be set.${RESET}"
  echo
  echo -e "This script is intended to be run from the Justfile:"
  echo
  echo -e "    ${BOLD}just start-oracle <oracle-name> --use-local-cargo-artifacts${RESET}"
  exit 1
fi

mkdir -p $SPIN_DATA_DIR

IFS='-' read -r ARCH OS <<<$($GIT_ROOT/scripts/get-host-arch-and-os.sh)

ARCHIVE_PATH="$SPIN_DATA_DIR/trigger-oracle.tar.gz"

tar czf $ARCHIVE_PATH -C "$GIT_ROOT/target/release" ./trigger-oracle
HASH=$(sha256sum $ARCHIVE_PATH | cut -d' ' -f 1)

TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT

MANIFEST_PATH="$TMP_DIR/trigger-oracle.json"

cat >$MANIFEST_PATH <<EOF
{
    "name": "trigger-oracle",
    "description": "Run Blocksense oracle components at timed intervals",
    "homepage": "https://github.com/blocksense-network/blocksense/tree/main/apps/trigger-oracle",
    "license": "Apache-2.0",
    "spinCompatibility": ">=2.2",
    "version": "0.1.0",
    "packages": [
        {
            "os": "$OS",
            "arch": "$ARCH",
            "url": "file://$ARCHIVE_PATH",
            "sha256": "$HASH"
        }
    ]
}
EOF

"$SPIN" plugin install --file "$MANIFEST_PATH" --yes
