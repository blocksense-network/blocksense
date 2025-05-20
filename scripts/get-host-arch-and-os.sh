#!/usr/bin/env bash

set -euo pipefail

# Get the raw kernel and machine architecture
kernel_name_raw=$(uname -s)
arch_name_raw=$(uname -m)

# Initialize variables for our desired labels
final_os_tag=""
final_arch_tag=""

# Determine the OS label
if [ "$kernel_name_raw" == "Linux" ]; then
  final_os_tag="linux"
elif [ "$kernel_name_raw" == "Darwin" ]; then
  final_os_tag="macos"
else
  echo "Error: Unsupported operating system: '$kernel_name_raw'. Only Linux and macOS (Darwin) are supported by this script." >&2
  exit 1
fi

# Determine the Architecture label
if [ "$arch_name_raw" == "x86_64" ]; then
  final_arch_tag="amd64"
elif [ "$arch_name_raw" == "arm64" ] || [ "$arch_name_raw" == "aarch64" ]; then
  final_arch_tag="aarch64"
else
  echo "Error: Unsupported architecture: '$arch_name_raw'. Only x86_64 (amd64) and arm64/aarch64 are supported." >&2
  exit 1
fi

echo "${final_arch_tag}-${final_os_tag}"
