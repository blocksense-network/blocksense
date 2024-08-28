#!/usr/bin/env bash
# This script should be called when the current directory is the root of the
# Noir repo and the selected branch is blocksense. This is because direnv will then
# select the correct Rust version that is necessary for the builds to pass.
#
# Please, don't try to automate this behavior, just allow it.
#
# I run this script like so:
#
# ```
# cd ~/code/repos/noir
# git checkout blocksense # if necessary
# ~/code/repos/blocksense/stanm/scripts/noir_fork_daily_sync.sh ~/code/repos/noir
# ```

set -xeuo pipefail

# Check if at least one argument is provided
if [ $# -eq 0 ]; then
    echo "Usage: $0 <path to Noir fork>"
    exit 1
fi

# Access the first argument
path=$1
pushd "$path"

# TODO: show stats for sync
if ! git checkout master; then
  echo -e "\e[31mFailed to checkout master; sync failed.\e[0m"
  exit 1
fi
git pull upstream master
git push origin master
git checkout blocksense
git pull origin blocksense
echo "Try to merge now with git merge master ..."
date=$(date +"%d %b %Y")
if git merge master --no-ff -m "chore: Daily merge of \`master\`, $date"; then
    echo -e "\e[32mMerge succeeded! Testing...\e[0m"
    if cargo test -q; then
        echo -e "\e[32mTesting succeeded! Pushing...\e[0m"
        git push origin blocksense
        echo -e "\e[32mSync succeeded.\e[0m"
    else
        echo -e "\e[31mTesting failed. Resolve and push manually.\e[0m"
    fi
else
    echo -e "\e[31mThere were conflicts during the sync.\e[0m"
    echo "Toolbelt: 'git mergetool --tool=meld'; 'git rebase --continue'."
fi

popd
