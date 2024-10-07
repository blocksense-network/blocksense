#!/usr/bin/env bash

DIR=/usr/local/blocksense/apps/reporter
HASH=$(sha256sum $DIR/trigger-oracle.tar.gz | cut -d' ' -f 1)
cat > $DIR/trigger-oracle.json << EOF
{
    "name": "trigger-oracle",
    "description": "Run Blocksense oracle components at timed intervals",
    "homepage": "https://github.com/blocksense-network/blocksense/tree/main/apps/trigger-oracle",
    "version": "0.1.0",
    "spinCompatibility": ">=2.2",
    "license": "Apache-2.0",
    "packages": [
        {
            "os": "linux",
            "arch": "amd64",
            "url": "file://$DIR/trigger-oracle.tar.gz",
            "sha256": "$HASH"
        }
    ]
}
EOF

set -x
SPIN_BIN=/spin
MY_SPIN="${SPIN_BIN:-spin}"
$MY_SPIN plugin install --file $DIR/trigger-oracle.json --yes

