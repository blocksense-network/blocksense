#!/usr/bin/env bash

set -euo pipefail

# Default number of ports to find
num_ports=10

# Check for at least one argument (output file)
if [ $# -lt 1 ]; then
  echo "Usage: $0 <output-file> [-n <number-of-ports> (default: 10)]"
  exit 1
fi

output_file="$1"
shift

# Parse optional flags
while getopts ":n:" opt; do
  case $opt in
    n)
      num_ports="$OPTARG"
      ;;
    \?)
      echo "Invalid option: -$OPTARG" >&2
      exit 1
      ;;
    :)
      echo "Option -$OPTARG requires an argument." >&2
      exit 1
      ;;
  esac
done

> "$output_file" # truncate the file

count=0
for port in $(seq 8500 9500); do
  if ! (echo > /dev/tcp/127.0.0.1/$port) >/dev/null 2>&1; then
    echo "$port" >> "$output_file"
    count=$((count + 1))
    if [ "$count" -ge "$num_ports" ]; then
      break
    fi
  fi
done

if [ "$count" -lt "$num_ports" ]; then
  echo "Only found $count free ports (requested $num_ports)." >&2
  exit 1
fi
