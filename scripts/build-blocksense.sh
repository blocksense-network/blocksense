#!/usr/bin/env bash

set -euo pipefail

NO_COLOR=${NO_COLOR:-""}

task_heading() {
  local readonly PREFIX_COLOR='\x1b[1;92m'
  local readonly TEXT_COLOR='\x1b[1;37m'
  local readonly STYLE_RESET='\x1b[0m'
  local readonly PREFIX_SYMBOL="➔"
  local message="$1"

  if [[ -n "$NO_COLOR" ]]; then
    echo "--- ${message} ---"
  else
    echo -e "${PREFIX_COLOR}${PREFIX_SYMBOL} ${TEXT_COLOR}${message}...${STYLE_RESET}"
  fi
}

task_heading 'Building workspace'
cargo build --release

task_heading 'Installing trigger-oracle spin plugin'
$GIT_ROOT/scripts/install_trigger_oracle_plugin.sh 2>&1 | sed 's/^/    /'
