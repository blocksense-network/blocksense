#!/bin/bash

echo "Launching Prometheus Server.."
cargo run --release --bin launch_prometheus_server &
PROMETHEUS_PID=$!

sleep 1

# Check if the Prometheus server is still running
if ps -p $PROMETHEUS_PID > /dev/null; then
  echo "Prometheus server launched successfully"
else
  echo "Failed to launch Prometheus server"
  exit 1
fi

echo "Launching Reporter.."
cargo run --release --bin launch_reporter
