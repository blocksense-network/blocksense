# 🪄 Blocksense Spellbook

A collection of useful commands and scripts for interacting with Blocksense's local and production environments.

## Table of Contents

- [🪄 Blocksense Spellbook](#-blocksense-spellbook)
  - [Table of Contents](#table-of-contents)
- [Local Enviroment](#local-enviroment)
  - [Starting and Stopping the Blocksense Local Environment](#starting-and-stopping-the-blocksense-local-environment)
  - [Logs](#logs)
  - [Reading On-Chain Data with `cast`](#reading-on-chain-data-with-cast)
    - [Reading data from v1 contracts](#reading-data-from-v1-contracts)
      - Using `UpgradeableProxy` contract
      - Using `ChainlinkProxy` contract
    - [Reading data from ADFS contracts](#reading-data-from-adfs-contracts)
      - [Using `UpgradeableProxyADFS` contract](#using-upgradeableproxyadfs-contract)
      - [Using `CLAggregatorAdapter` contract](#using-claggregatoradapter-contract)
  - [Sequencer interaction](#sequencer-interaction)
    - [Get information of effective sequencer configuration](#get-information-of-effective-sequencer-configuration)
    - [Get information of effective feeds configuration](#get-information-of-effective-feeds-configuration)
    - [Get networks related information](#get-networks-related-information)
- [Production Environment](#production-environment)

# Local Enviroment

The [Getting Started](../.github/SETUP.md) document provides a comprehensive guide to setting up your local development environment.

## Starting and Stopping the Blocksense Local Environment

- Generate the `process-compose.yaml` file in the root directory, making sure the latest version of the system is built.

  ```bash
  direnv reload
  ```

- Start the local environment

  ```bash
  process-compose up
  ```

- Stop the local environment

  ```bash
  process-compose down
  ```

## Logs

Sometimes logs in `process-compose` are hard to read.

We save all logs under `./logs/blocksense/` directory.

Some usefull snippets:

- Live tailing of the sequencer logs
  ```bash
  tail -f logs/blocksense/sequencer.log
  ```
- Read result of sequencer's transactions to the networks
  ```bash
  cat logs/blocksense/sequencer.log | grep "result from network"
  ```
- Read logs related to the `gecko-terminal` oracles from the reporter
  ```bash
  cat logs/blocksense/reporter-v2-a.log  | grep "gecko-terminal"
  ```

## Reading On-Chain Data with [`cast`](https://book.getfoundry.sh/cast/)

Our setup includes two blockchain instances:

- **`anvil-ethereum-sepolia`** – A fork of the Ethereum Sepolia testnet, where our previous contract version is deployed.
- **`anvil-ink-sepolia`** – A fork of the Ink Sepolia testnet, hosting our new **ADFS** contract version.

Interacting with these contract versions requires slightly different approaches due to changes in their implementations.

<details>
    <summary> <h3>Reading data from v1 contracts</h3></summary>

#### Using `UpgradeableProxy` contract

```bash
cast call 0xee5a4826068c5326a7f06fd6c7cbf816f096846c --data 0x80000000 --rpc-url http://127.0.0.1:8546 | cut -c1-50 | cast to-dec
```

> Reading last update for feed with id 0

Here’s a reworded version of your breakdown:

Command Breakdown:

- The command interacts with the `UpgradeableProxy` contract deployed on Ethereum Sepolia at `0xee5a4826068c5326a7f06fd6c7cbf816f096846c`. [Reference](https://github.com/blocksense-network/blocksense/blob/75e2d34c82c61e0c71c82461cb943063134ea797/config/evm_contracts_deployment_v1.json#L3127-L3128).

- The `data` parameter is set to `0x80000000`, triggering the contract's fallback function. This can be generated in Node.js:

  ```javascript
  const id = 0;
  const selector =
    '0x' + ((id | 0x80000000) >>> 0).toString(16).padStart(8, '0');
  console.log(selector);
  // '0x80000000'
  ```

  > The `id` corresponds to the data feed being queried.

- The `rpc-url` points to `anvil-ethereum-sepolia`.

- The output is processed with `cut` to extract the first 50 characters, representing the price in hex. It’s then converted to decimal using `cast to-dec`.

#### Using `ChainlinkProxy` contract

```bash
cast call 0x9fAb38E38d526c6ba82879c6bDe1c4Fd73378f17 "latestAnswer()" --rpc-url http://127.0.0.1:8546 | cast to-dec
```

> Reading the **latest answer** from a `ChainlinkProxy` contract

Command Breakdown:

- `0x9fAb38E38d526c6ba82879c6bDe1c4Fd73378f17` is the address of a `ChainlinkProxy` contract.
- The `latestAnswer()` function is called to retrieve the latest price.
- The `rpc-url` points to `anvil-ethereum-sepolia`.
- The output is converted to decimal using `cast to-dec`.

</details>

<details open>
    <summary> <h3>Reading data from ADFS contracts</h3></summary>

#### Using `UpgradeableProxyADFS` contract

Here is an example command with breakdown. More examples can be found bellow.

```bash
cast call 0xADF5aad6faA8f2bFD388D38434Fc45625Ebd9d3b --data 0x8200000000000000000000000000000000  --rpc-url http://127.0.0.1:8547 | cut -c1-50 | cast to-dec
```

> Reading last update for feed with id 0.

Command Breakdown:

- The command interacts with the `UpgradeableProxyADFS` contract deployed on Ink Sepolia at `0xADF5aad6faA8f2bFD388D38434Fc45625Ebd9d3b`. [Reference](https://github.com/blocksense-network/blocksense/blob/75e2d34c82c61e0c71c82461cb943063134ea797/config/evm_contracts_deployment_v2.json#L19)
- The data parameter is set to `0x8200000000000000000000000000000000` triggering the contract's fallback function. This can be generated in Node.js:

  ```javascript
  const operation = 0x02; // `getLatestSingleData` operation ref: https://docs.blocksense.network/docs/contracts/integration-guide/using-data-feeds/aggregated-data-feed-store
  const stride = 0; // Stride for price feeds
  const id = 0; // Id of the price feed

  const operationBytes = operation | 0x80;
  const strideBytes = stride & 0xff;

  // Convert id (uint120) to a hex string padded to 30 hex chars (120 bits = 15 bytes)
  const idHex = id.toString(16).padStart(30, '0');

  // Concatenate as a full hex string
  const packedHex =
    '0x' +
    operationBytes.toString(16).padStart(2, '0') +
    strideBytes.toString(16).padStart(2, '0') +
    idHex;
  ```

  > if you want to use the `getFeedAtRound` operation ( `0x86` ) you need to include the `round` as the end of data. The round is a `uint16`, so you need to convert it to hex and pad it to 4 characters (2 bytes).
  >
  > ```javascript
  > // Convert roundId to 2-byte hex string (4 hex chars)
  > const roundHex = roundId.toString(16).padStart(4, '0');
  > ```

  Easy to copy examples for crafting the data parameter:

  - `getLatestSingleData` operation with stride 0 and id 42

    ```javascript
    '0x' +
      (0x02 | 0x80).toString(16).padStart(2, '0') +
      (0 & 0xff).toString(16).padStart(2, '0') +
      (42).toString(16).padStart(30, '0');
    ```

  - `getFeedAtRound` operation with stride 0, id 42, and round 5

    ```javascript
    '0x' +
      (0x86 | 0x80).toString(16).padStart(2, '0') +
      (0 & 0xff).toString(16).padStart(2, '0') +
      (0).toString(16).padStart(30, '0') +
      (1574).toString(16).padStart(4, '0');
    ```

- The output is processed with `cut` to extract the first 50 characters, representing the price in hex. It’s then converted to decimal using `cast to-dec`.

**Example calls:**

- Get the **latest update** for feed with id **0** (`getLatestSingleData`)

  ```bash
  cast call 0xADF5aad6faA8f2bFD388D38434Fc45625Ebd9d3b --data 0x8200000000000000000000000000000000  --rpc-url http://127.0.0.1:8547 | cut -c1-50 | cast to-dec
  ```

- Get the **latest round** for feed with id **0** (`getLatestRound`)

  ```bash
    cast call 0xADF5aad6faA8f2bFD388D38434Fc45625Ebd9d3b --data 0x8100000000000000000000000000000000  --rpc-url http://127.0.0.1:8547 | cast to-dec
  ```

- Get the **latest round and update** for feed with id **0** at the same time

  ```bash
  cast call 0xADF5aad6faA8f2bFD388D38434Fc45625Ebd9d3b --data 0x8300000000000000000000000000000000  --rpc-url http://127.0.0.1:8547  | \
    sed 's/^0x//' | \
    awk '{print "0x" substr($0, 1, 64) "\n0x" substr($0, 65, 48)}' | \
    xargs -n1 cast to-dec | \
    awk 'NR==1{print "roundID: " $0} NR==2{print "price:   " $0}'
  ```

- Get the **update in round 5** for feed with id **3** (`getFeedAtRound`)

  ```bash
    cast call 0xADF5aad6faA8f2bFD388D38434Fc45625Ebd9d3b --data 0x86000000000000000000000000000000030005  --rpc-url http://127.0.0.1:8547  | cut -c1-50 |cast to-dec
  ```

#### Using `CLAggregatorAdapter` contract

Here is an example command with breakdown. More examples can be found bellow.

```bash
  cast call 0xcBD6FC059bEDc859d43994F5C221d96F9eD5340f "latestAnswer()" --rpc-url http://127.0.0.1:8547 | cast to-dec
```

> Reading the **latest answer** from a `CLAggregatorAdapter` contract

Command Breakdown:

- `0xcBD6FC059bEDc859d43994F5C221d96F9eD5340f` is the address of a `ChainlinkProxy` contract. [Reference](https://github.com/blocksense-network/blocksense/blob/75e2d34c82c61e0c71c82461cb943063134ea797/config/evm_contracts_deployment_v2.json#L42)
- The `latestAnswer()` function is called to retrieve the latest price.
- The `rpc-url` points to `anvil-ink-sepolia`.
- The output is converted to decimal using `cast to-dec`.

> INFO: [Full list of functions you can call](https://docs.blocksense.network/docs/contracts/reference-documentation/contract/CLAggregatorAdapter)

**Example calls:**

- Reading the **latest answer** from a `CLAggregatorAdapter` contract

  ```
  cast call 0xcBD6FC059bEDc859d43994F5C221d96F9eD5340f "latestAnswer()" --rpc-url http://127.0.0.1:8547 | cast to-dec
  ```

- Reading the **latest round** from a `CLAggregatorAdapter` contract

  ```
  cast call 0xcBD6FC059bEDc859d43994F5C221d96F9eD5340f "latestRound()" --rpc-url http://127.0.0.1:8547 | cast to-dec
  ```

- Reading the **update for round 1** from a `CLAggregatorAdapter` contract

  ```
    cast call 0xcBD6FC059bEDc859d43994F5C221d96F9eD5340f "getRoundData(uint80)" 0x000000000000000000000000000001 --rpc-url http://127.0.0.1:8547 | \
      sed 's/^0x//' | \
      awk '{print "0x" substr($0, 1, 64) "\n0x" substr($0, 65, 64)}' | \
      xargs -n1 cast to-dec | \
      awk 'NR==1{print "roundID: " $0} NR==2{print "price:   " $0}'
  ```

  > The `round` parameter can be calculated as `round` padded to 32 hex characters.
  >
  > ```javascript
  > const round = 1;
  > round.toString().padStart(32, '0');
  > ```
  >
  > > max round is 8191 ( 2^13 -1 )

  </details>

## Sequencer interaction

### Get information of effective sequencer configuration

- Get the whole sequencer configuration

  ```bash
   curl -fsSL http://127.0.0.1:5553/get_sequencer_config | jq
  ```

- Get sequencer configuration for a specific network (e.g. `ethereum-sepolia`)

  ```bash
  curl -fsSL http://127.0.0.1:5553/get_sequencer_config | jq '.providers."ethereum-sepolia"'
  ```

- Get allowed feeds for a specific network (e.g. `ethereum-sepolia`)

  ```bash
  curl -fsSL http://127.0.0.1:5553/get_sequencer_config | jq '.providers."ethereum-sepolia".allow_feeds'
  ```

### Get information of effective feeds configuration

- Get the whole feeds configuration

  ```bash
  curl -fsSL http://127.0.0.1:5553/get_feeds_config | jq
  ```

- Get feed configuration for a specific feed ID (e.g. `100000`)

  ```bash
  curl -fsSL http://127.0.0.1:5553/get_feeds_config | jq '[ .feeds[] | select (.id == 100000) ]'
  ```

- Get feed configuration for set of feed IDs

  ```bash
  curl -fsSL http://sequencer-testnet-001:5556/get_feeds_config | jq '[ .feeds[] | select(.id | IN(7,19,32,82,1000000)) ]'
  ```

- Get feed configuration for a specific feed name (e.g. `ETH / USD`)

  ```bash
  curl -fsSL http://127.0.0.1:5553/get_feeds_config | jq -c '[ .feeds[] | select (.full_name == "ETH / USD") ]' | jq
  ```

- Get oracle arguments for a specific feed (e.g. `ETH / USD`)

  ```bash
  curl -fsSL http://127.0.0.1:5553/get_feeds_config | jq -c '[ .feeds[] | select (.full_name == "ETH / USD") .additional_feed_info.arguments]' | jq
  ```

- Get specific fields for a set of feeds (e.g. `id`, `full_name`, `schedule`)

  ```bash
  curl -fsSL http://sequencer-testnet-001:5556/get_feeds_config | jq '[ .feeds[] | select(.id | IN(7,19,32,82,1000000)) | {id,full_name,schedule} ]'
  ```

### Get networks related information

- Get status from networks

  ```bash
  curl -fsSL http://127.0.0.1:5553/list_provider_status
  ```

- Get updates history of all feeds

  ```bash
  curl -fsSL http://127.0.0.1:5553/get_history | jq
  ```

- Get updates history of a specific feed (e.g. `0`)

  ```bash
  curl -fsSL http://127.0.0.1:5553/get_history | jq  '."aggregate_history"."0"'
  ```

- Get last update of a specific feed (e.g. `0`)

  ```bash
  curl -fsSL http://127.0.0.1:5553/get_history | jq  '."aggregate_history"."0" | last'
  ```

# Production Environment

soon...
