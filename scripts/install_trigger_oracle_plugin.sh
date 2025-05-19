#!/usr/bin/env bash

set -euo pipefail

SPIN_DATA_DIR="$GIT_ROOT/target/spin-artifacts"
mkdir -p $SPIN_DATA_DIR

IFS='-' read -r ARCH OS <<< $($GIT_ROOT/scripts/get-host-arch-and-os.sh)

ARCHIVE_PATH="$SPIN_DATA_DIR/trigger-oracle.tar.gz"

tar czf $ARCHIVE_PATH -C "$GIT_ROOT/target/release" ./trigger-oracle
HASH=$(sha256sum $ARCHIVE_PATH | cut -d' ' -f 1)

TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT

MANIFEST_PATH="$TMP_DIR/trigger-oracle.json"

cat > $MANIFEST_PATH << EOF
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

SPIN_DATA_DIR="$SPIN_DATA_DIR" spin plugin install --file $MANIFEST_PATH --yes
