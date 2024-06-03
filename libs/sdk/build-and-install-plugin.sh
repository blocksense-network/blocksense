#!/usr/bin/env bash

set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
DIR="$ROOT/libs/sdk/trigger-oracle"

# Initialize the script directory
SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &> /dev/null && pwd)/trigger-oracle

# Build the project
(cd $SCRIPT_DIR && cargo build --release)

# Create the tar.gz file
tar czf "$DIR/trigger-oracle.tar.gz" -C "$ROOT/target/release" ./trigger-oracle

# Calculate the hash of the tar.gz file
HASH=$(shasum -a 256 $DIR/trigger-oracle.tar.gz | cut -d' ' -f 1)

# Determine the architecture
ARCH=$(uname -m)
if [[ "$ARCH" == "arm64" ]]; then
    ARCH="aarch64"
fi

# Generate the trigger-oracle.json file
cat > $DIR/trigger-oracle.json << EOF
{
    "name": "trigger-oracle",
    "description": "Run Blocksense oracle components at timed intervals",
    "homepage": "https://github.com/blocksense-network/blocksense/tree/main/libs/sdk/trigger-oracle",
    "version": "0.1.0",
    "spinCompatibility": ">=2.2",
    "license": "Apache-2.0",
    "packages": [
        {
            "os": "linux",
            "arch": "amd64",
            "url": "file://$DIR/trigger-oracle.tar.gz",
            "sha256": "$HASH"
        },
        {
            "os": "macos",
            "arch": "$ARCH",
            "url": "file://$SCRIPT_DIR/trigger-oracle.tar.gz",
            "sha256": "$HASH"
        }
    ]
}
EOF

# Install the plugin
set -x
spin plugin install --file $DIR/trigger-oracle.json --yes

