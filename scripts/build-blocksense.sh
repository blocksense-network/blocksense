#!/usr/bin/env bash

set -euo pipefail

source $GIT_ROOT/scripts/utils/task-heading.sh

task_heading 'Building workspace'
cargo build --release

task_heading 'Installing trigger-oracle spin plugin'
$GIT_ROOT/scripts/install_trigger_oracle_plugin.sh 2>&1 | sed 's/^/    /'
