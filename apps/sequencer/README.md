# Initial implementation for the Blocksense sequencer

## How to build the sequencer

You need to call `cargo build` from the root blocksense project folder.

```
[john@doe:~/blocksense]$ cargo build
```

## How to configure the sequencer

You need to set the following environment variables:

1. The private keys of all providers we want to send updates to.
   The format is as follows: `WEB3_PRIVATE_KEY_<network name>`. It is a path to the file containing the sequencer's private key for posting transactions to the specified Ethereum network.
   For example:

```
export WEB3_PRIVATE_KEY_ETH1=/tmp/priv_key_test
```

where the contents of the file are

```
0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a
```

2. `WEB3_URL_<network name>` - the JRPC url of each ethereum node that the sequencer will communicate with. For testing `anvil` is recommended.
   For example:

```
export WEB3_URL_ETH1=http://127.0.0.1:8545
```

3. `WEB3_CONTRACT_ADDRESS_<network name>` - optional parameter. If it is present, the sequencer will send updates to this smart contract address. If this parameter is not set, the sequencer can accept HTTP requests to deploy and use a smart contract.
   For example:

```
export WEB3_CONTRACT_ADDRESS_ETH1=0xef11d1c2aa48826d4c41e54ab82d1ff5ad8a64ca
```

## How to run the sequencer

```
[john@doe:~/blocksense]$ cargo run --bin sequencer
```

Note: the sequencer needs to send transactions to a deployed contract. If you have deployed the contract you can provide its address in the environment variable WEB3_CONTRACT_ADDRESS. If not send a GET HTTP request to the sequencer as follows: `curl http://127.0.0.1:8877/deploy/<network name>`.
For example:

```
curl http://127.0.0.1:8877/deploy/ETH1
```

The sequencer will deploy the contract and use it from there on. To send a data feed you can use the following test HTTP request:

```
curl -X POST 127.0.0.1:8877/test -H 'Content-Type: application/json' -d '{"feed_id":"YahooFinance.BTC/USD","reporter_id":0,"result":70000.5,"timestamp":'$((($(date +%s%N | cut -b1-13))))'}'
```

To set the logging level, you can provide an environment variable before running the sequencer as follows:

```
export SEQUENCER_LOGGING_LEVEL=DEBUG
```

This environment variable is not mandatory, and the default value is `INFO`. All supported logging levels are in apps/sequencer/src/utils/logging.rs
Logging level can be changed at runtime as well by posting an HTTP request only from localhost, for example:

```
curl http://127.0.0.1:8877/main_log_level/DEBUG -X POST
```
