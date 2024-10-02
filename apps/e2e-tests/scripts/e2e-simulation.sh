#!/usr/bin/env bash

set -euo pipefail

GIT_REPO_ROOT="$(git rev-parse --show-toplevel)"

E2E_TEST_DIR="$GIT_REPO_ROOT/apps/e2e-tests"

FEEDS_CONFIG_FILE="$E2E_TEST_DIR/artifacts/feeds_config.json"

DEPLOYMENT_FILE="$GIT_REPO_ROOT/libs/contracts/deployments/deploymentV1.json"

SEQUENCER_ADDRESS="0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
SEQUENCER_PRIVATE_KEY="0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"

SIGNER_PRIVATE_KEY="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"


SEQENCER_LOG_FILE="$GIT_REPO_ROOT/sequencer.log"
ANVIL_LOG_FILE="$GIT_REPO_ROOT/anvil.log"
PID_FILE="/tmp/sequencer.pid"

ANVIL_PORT=9944
ANVIL_RPC_URL="http://127.0.0.1:$ANVIL_PORT"

REPORTED_RESULT=42000

anvil --block-time 5 --balance 10000000000000000000 --port "$ANVIL_PORT" --fork-url https://sepolia.infura.io/v3/9ea3e88b90a043f488d03f539abc9545 >"$ANVIL_LOG_FILE" 2>&1 &

# Function to display logs in a box
log_box() {
  local message="$1"
  local length=${#message}
  local border=$(printf '=%.0s' $(seq 1 $((length + 4))))
  echo -e "\n$border"
  echo -e "| $message |"
  echo -e "$border\n"
}

prepare_simulation() {
  log_box "Preparing Simulation Configuration"

  # Paths to the config files
  SEQUENCER_CONFIG_FILE="$GIT_REPO_ROOT/apps/sequencer/sequencer_config.json"
  DATA_FEEDS_RS_FILE="$GIT_REPO_ROOT/apps/sequencer/src/http_handlers/data_feeds.rs"

  # Overwrite the feeds_config.json file with the required JSON content
  cat <<EOF > "$FEEDS_CONFIG_FILE"
{
  "feeds": [
    {
      "id": 1,
      "name": "BTC",
      "fullName": "",
      "description": "BTC / USD",
      "type": "Crypto",
      "decimals": 8,
      "pair": {
        "base": "BTC",
        "quote": "USD"
      },
      "resources": {
        "cmc_id": 1,
        "cmc_quote": "BTC"
      },
      "report_interval_ms": 6000,
      "first_report_start_time": {
        "secs_since_epoch": 0,
        "nanos_since_epoch": 0
      },
      "quorum_percentage": 1,
      "script": "CoinMarketCap",
      "chainlink_compatibility": {
        "base": "0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB",
        "quote": "0x0000000000000000000000000000000000000348"
      }
    }
  ]
}
EOF

  # Check if the feeds_config.json was written successfully
  if [[ $? -eq 0 ]]; then
    echo "Feeds configuration file prepared successfully."
  else
    echo "Failed to prepare feeds configuration."
    return 1
  fi

  # Overwrite the sequencer_config.json file with the required JSON content
  cat <<EOF > "$SEQUENCER_CONFIG_FILE"
{
  "main_port": 8877,
  "admin_port": 5556,
  "prometheus_port": 5555,
  "max_keys_to_batch": 1,
  "keys_batch_duration": 500,
  "providers": {
    "ETH1": {
      "private_key_path": "/tmp/priv_key_test",
      "url": "$ANVIL_RPC_URL",
      "transcation_timeout_secs": 50,
      "contract_address": "0x5973e7D1386BAB5811E45A4db281d33e28Eb82A3",
      "data_feed_store_byte_code": "0x608060405261000c61000e565b005b6040516001907f8200c8b6a948c348571d862fe694af510b1a8d9ca634c25bbacdc755c69cb3bc90600090a26001600160a01b037f0000000000000000000000001d3ed652cb10c952fefbe09c3a61f2527f5e77d116330361012b576040516002907f0146f88f75c3645f6e3a3dc77042f29241ca54721495fe34704e21b3a41c824290600090a26000356001600160e01b03191663278f794360e11b146100f5576040516003907f2a01c0eef416959d22ca7e6d0e68a3d1e87854ff744aa37db6278bfc7060f30990600090a26040516334ad5dbb60e21b815260040160405180910390fd5b6040516004907f435f5ccbbecce83f704382e0d3a6e867ad10ed1497adc789e0cc6d27887c8c2b90600090a261012961015f565b565b6040516005907fd4f833dba202892b1914a1c00f9d11a3266e7d7cc403a41a1c1be03f2e32cc8990600090a2610129610188565b600061016e3660048184610271565b6101779161029b565b60601c9050610185816101b8565b50565b6101296101b37f360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc5490565b61024d565b806001600160a01b03163b6000036101f257604051630c76093760e01b81526001600160a01b038216600482015260240160405180910390fd5b7f360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc8190556040516001600160a01b038216907fbc7cd75a20ee27fd9adebab32041f755214dbc6bffa90cc0225b39da2e5c2d3b90600090a250565b3660008037600080366000845af43d6000803e80801561026c573d6000f35b3d6000fd5b6000808585111561028157600080fd5b8386111561028e57600080fd5b5050820193919092039150565b6bffffffffffffffffffffffff1981358181169160148510156102c85780818660140360031b1b83161692505b50509291505056fea264697066735822122002577f669c27c507d8ab4ac4b795f6e9b563835ba57b486dd6354754be87eae564736f6c63430008180033"
    }
  },
  "reporters": [
    {
      "id": 0,
      "pub_key": "ea30af86b930d539c55677b05b4a5dad9fce1f758ba09d152d19a7d6940f8d8a8a8fb9f90d38a19e988d721cddaee4567d2e"
    }
  ]
}
EOF

  # Check if the sequencer_config.json was written successfully
  if [[ $? -eq 0 ]]; then
    echo "Sequencer configuration file prepared successfully."
  else
    echo "Failed to prepare sequencer configuration."
    return 1
  fi

  # Modify the check_signature function in the data_feeds.rs file to always return true
sed -i '/^pub fn check_signature/,/^}/s/^\([[:space:]]*verify_signature(.*)\)/\1;/; /^pub fn check_signature/,/^}/s/^}$/    true\n}/' "$DATA_FEEDS_RS_FILE"
  # Check if the modification was successful
  if [[ $? -eq 0 ]]; then
    echo "check_signature function in data_feeds.rs has been successfully modified to always return true."
  else
    echo "Failed to modify the check_signature function."
    return 1
  fi
}


deploy_contracts() {
  log_box "Deploying Contracts"

  # Set the environment variables
  export SEQUENCER_ADDRESS="0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
  export SIGNER_PRIVATE_KEY="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
  export RPC_URL_LOCAL="$ANVIL_RPC_URL"

  echo "$RPC_URL_LOCAL"

  CONTRACTS_DIR="$GIT_REPO_ROOT/libs/contracts"

  # Navigate to the correct directory
  echo "Navigating to contracts directory..."
  cd "$CONTRACTS_DIR" || { echo "Directory libs/contracts not found"; return 1; }

  # Install dependencies
  echo "Installing dependencies..."
  yarn install || { echo "Failed to install dependencies"; return 1; }

  # Build dependencies and contracts
  echo "Building dependencies..."
  yarn build:deps || { echo "Failed to build dependencies"; return 1; }

  echo "Building contracts..."
  yarn build || { echo "Failed to build contracts"; return 1; }

  # Deploy the contracts using hardhat
  echo "Deploying contracts..."
  yarn hardhat deploy --networks local --config-file "$FEEDS_CONFIG_FILE" --config-file2 "$FEEDS_CONFIG_FILE" || { echo "Deployment failed"; return 1; }

  echo "Deployment successful!"

  echo "Collecting deployment artifacts..."

  cp -r "$CONTRACTS_DIR/artifacts" "$E2E_TEST_DIR/artifacts/built-contracts" || { echo "Failed to copy deployment artifacts"; return 1; }
  cp "$DEPLOYMENT_FILE" "$E2E_TEST_DIR/artifacts/deploymentV1.json" || { echo "Failed to copy deployment artifacts"; return 1; }
}

write_sequencer_private_key() {
  log_box "Writing SEQUENCER_PRIVATE_KEY"

  # Specify the output file
  OUTPUT_FILE="/tmp/priv_key_test"

  # Write the SEQUENCER_PRIVATE_KEY to the file
  echo "$SEQUENCER_PRIVATE_KEY" > "$OUTPUT_FILE"

  # Print confirmation
  echo "SEQUENCER_PRIVATE_KEY written to $OUTPUT_FILE"
}

build_sequencer() {
  log_box "Building Sequencer"

  # Navigate to the sequencer directory

  # Build the sequencer
  cargo build --bin sequencer || { echo "Failed to build sequencer"; return 1; }

  # Print confirmation
  echo "Sequencer built successfully!"
}

configure_sequencer() {
  log_box "Configuring Sequencer"

  # Paths to the JSON files
  sequencer_config_file="$GIT_REPO_ROOT/apps/sequencer/sequencer_config.json"

  # Check if both files exist
  if [[ ! -f "$DEPLOYMENT_FILE" || ! -f "$sequencer_config_file" ]]; then
    echo "One or both JSON files do not exist."
    return 1
  fi

  # Extract the UpgradeableProxy address from deploymentV1.json
  upgradeable_proxy_address=$(jq -r '.["11155111"].contracts.coreContracts.UpgradeableProxy.address' "$DEPLOYMENT_FILE")

  # Check if jq was able to extract the address
  if [[ -z "$upgradeable_proxy_address" || "$upgradeable_proxy_address" == "null" ]]; then
    echo "Failed to extract the UpgradeableProxy address from $DEPLOYMENT_FILE."
    return 1
  fi

  # Update the contract_address in sequencer_config.json
  jq --arg new_address "$upgradeable_proxy_address" '.providers.ETH1.contract_address = $new_address' "$sequencer_config_file" > tmp_config.json && mv tmp_config.json "$sequencer_config_file"

  # Check if the operation was successful
  if [[ $? -eq 0 ]]; then
    echo "The contract_address in $sequencer_config_file has been updated to $upgradeable_proxy_address."
  else
    echo "Failed to update $sequencer_config_file."
    return 1
  fi
}

run_sequencer_in_background() {
  log_box "Running Sequencer in Background"

  FEEDS_CONFIG_DIR="$E2E_TEST_DIR/artifacts/"  cargo run --bin sequencer >"$SEQENCER_LOG_FILE" 2>&1 &

  # Get the process ID (PID) of the background process
  sequencer_pid=$!

  # Save the PID to a file for future reference (optional)
  echo "$sequencer_pid" > "$PID_FILE"

  echo "Sequencer started in the background with PID: $sequencer_pid"
  echo "Logs are being saved to $SEQENCER_LOG_FILE"
}

post_report_to_sequencer() {
  log_box "Posting Report to Sequencer"

  # Define the port to check
  PORT=8877
  HOST="127.0.0.1"
  SEQUENCER_URL="http://127.0.0.1:$PORT/post_report"

  # Define the payload data
  PAYLOAD='{
    "payload_metadata": {
      "feed_id": "1",
      "reporter_id": 0,
      "signature": "18049c69c5654c7a01b4842587a677777597f15931bb73a32f48f06b76b1568097ae101a6a3136905ace94785d7183c80f2e65f80c073c664a2dcc1d8763abaff03b0236820b58333a09eacd74ca511e2f64cc5d572c48faab9433fc57af7c570e3b341108c7c2fe44dfd92c406591f637a6a398606b502e9c1e4b05837e52f034d33926e13701c1ded26e88155ae49e122a2c6818adf91051d3eca994e5372963aa25e35e2ede5ef003c497ac155d0ef0b7c97228bebdc81c1fc569b7455558",
      "timestamp": '$(date +%s%N | cut -b1-13)'
    },
    "result": {
      "result": {
        "Numerical": '$REPORTED_RESULT'
      }
    }
  }'

  echo "Checking if the sequencer is live on port $PORT..."

  sleep 2

  # Loop until port is open
  while ! nc -z "$HOST" "$PORT"; do
    echo "Waiting for the sequencer to be live on port $PORT..."
    sleep 2
  done

  echo "Sequencer is live on port $PORT."

  # Execute the POST request once the sequencer is live
  echo "Sending POST request to $SEQUENCER_URL..."
  curl -v -X POST "$SEQUENCER_URL" -H 'Content-Type: application/json' -d "$PAYLOAD"

  # Check if the POST request was successful
  if [[ $? -eq 0 ]]; then
    echo "POST request was successful."
  else
    echo "Failed to send POST request."
  fi
}

read_latest_answer_from_anvil() {
  log_box "Reading Latest Answer from Anvil"

  sleep 10

  yarn workspace "@blocksense/e2e-tests" on-chain-data-test

  # # Extract the ChainlinkProxy address from deploymentV1.json using jq
  # CHAINLINK_PROXY_ADDRESS=$(jq -r '.["11155111"].contracts.ChainlinkProxy[0].address' "$DEPLOYMENT_FILE")

  # # Check if jq successfully extracted the address
  # if [[ -z "$CHAINLINK_PROXY_ADDRESS" || "$CHAINLINK_PROXY_ADDRESS" == "null" ]]; then
  #   echo "Failed to extract ChainlinkProxy address from $DEPLOYMENT_FILE."
  #   return 1
  # fi

  # # Print the extracted address for verification
  # echo "ChainlinkProxy address: $CHAINLINK_PROXY_ADDRESS"

  # # Run the cast call to get the latest answer
  # LATEST_ANSWER=$(cast call "$CHAINLINK_PROXY_ADDRESS" "latestAnswer()" --rpc-url "$ANVIL_RPC_URL" | cast to-dec)
  # EXPECTED_ANSWER="$REPORTED_RESULT"000000000000000000
  # # Check if cast command was successful
  # if [[ $? -eq 0 ]]; then
  #   echo "Latest answer: $LATEST_ANSWER"

  #   if [ "$EXPECTED_ANSWER" != "$LATEST_ANSWER" ]; then
  #       echo "Latest answer and reported result are not the same. Latest answer: $LATEST_ANSWER, Expected andswer: $EXPECTED_ANSWER"
  #       exit 1
  #   fi

  # else
  #   echo "Failed to retrieve the latest answer."
  #   return 1
  # fi

}

kill_sequencer() {
  log_box "Killing Sequencer"

    # Kill the process with the saved PID
      echo "Killing sequencer process"
      pkill -9 sequencer  # Force kill the process

      # Check if the kill was successful
      if [[ $? -eq 0 ]]; then
        echo "Sequencer successfully killed."
        rm -f "$PID_FILE"  # Optionally remove the PID file after killing the process
      else
        echo "Failed to kill sequencer process."
      fi
}


kill_anvil() {
  log_box "Killing Anvil"

  # Kill the Anvil process
  echo "Killing Anvil process"
  pkill -9 anvil  # Force kill the process

  # Check if the kill was successful
  if [[ $? -eq 0 ]]; then
    echo "Anvil successfully killed."
  else
    echo "Failed to kill Anvil process."
  fi
}


cleanup() {
  log_box "Cleaning Up"

  kill_sequencer

  kill_anvil

  # Remove the temporary files
  rm -f /tmp/priv_key_test
  git checkout "$DEPLOYMENT_FILE" "$SEQUENCER_CONFIG_FILE" "$DATA_FEEDS_RS_FILE"
}

# Ensure the sequencer is killed even if the script fails at any point
trap cleanup EXIT

# Execution
prepare_simulation
(deploy_contracts)
write_sequencer_private_key
configure_sequencer
build_sequencer
run_sequencer_in_background
post_report_to_sequencer
sleep 10
cat "$SEQENCER_LOG_FILE"

read_latest_answer_from_anvil

