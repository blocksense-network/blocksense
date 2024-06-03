#!/usr/bin/env bash

# Save the directory containing libiconv to a variable
LIBICONV_DIR="/opt/homebrew/opt/libiconv/lib"

set -euo pipefail

# Append the libiconv directory to LIBRARY_PATH, separating with ":" if it already exists
if [[ -z "${LIBRARY_PATH:-}" ]]; then
    export LIBRARY_PATH="$LIBICONV_DIR"
else
    export LIBRARY_PATH="$LIBRARY_PATH:$LIBICONV_DIR"
fi

# Specify the include directory for Accelerate framework explicitly for macOS
if [[ "$(uname)" == "Darwin" ]]; then
    export CFLAGS="$CFLAGS -I$(xcrun --show-sdk-path)/System/Library/Frameworks/Accelerate.framework/Versions/A/Headers"
fi

ROOT="$(git rev-parse --show-toplevel)"
DIR="$ROOT/libs/sdk/trigger-oracle"

# Change to the script directory and run the build and packaging steps
SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &> /dev/null && pwd)/trigger-oracle
(cd $SCRIPT_DIR && cargo build --release) && \
(cd $SCRIPT_DIR && cp ../../../../../target/release/trigger-oracle .) && \
(cd $SCRIPT_DIR && tar czvf trigger-oracle.tar.gz trigger-oracle) && \
TMP=$(shasum -a 256 $SCRIPT_DIR/trigger-oracle.tar.gz) && \
HASH=$(echo $TMP | cut -d' ' -f 1)

# Generate the trigger-oracle.json file
cat > $DIR/trigger-oracle.json << EOF
{
  "name": "trigger-oracle",
  "description": "Run Blocksense oracle components at timed intervals",
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
      "arch": "amd64",
      "url": "file://$SCRIPT_DIR/trigger-oracle.tar.gz",
      "sha256": "$HASH"
    }
  ]
}
EOF

# Install the plugin
set -x
spin plugin install --file $DIR/trigger-oracle.json --yes
(cd $SCRIPT_DIR && echo $JSON | tee trigger-oracle.json)
spin plugin install --file $SCRIPT_DIR/trigger-oracle.json --yes

