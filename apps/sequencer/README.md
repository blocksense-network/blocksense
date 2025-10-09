# Initial implementation for the Blocksense sequencer

## How to build the sequencer

You need to call `cargo build --bin sequencer` from the root blocksense project folder.

```
[john@doe:~/blocksense]$ cargo build
```

## How to configure the sequencer

The configuration for the sequencer is in blocksense/apps/sequencer/sequencer_config.json

By default on linux systems the sequencer looks for its "sequencer_config.json" file
under `$HOME`/.config according to the XDG Base Directory Specification.

The config path where the sequencer's config file is present can also be provided by
an environment variable - SEQUENCER_CONFIG_DIR, which will be considered instead of
the default XDG config folder path.

Another way to specify the config folder is through the command line argument which can
be passed to the sequencer followed by the path. This will overwrite the SEQUENCER_CONFIG_DIR
environment variable.
`-c, --config-file-path     specify sequencer's config file path`

By default in the nix environment of the sequencer, the SEQUENCER_CONFIG_DIR will be set
accordingly.

In the test config file we have 2 providers configured (JSON RPC-s to Ethereum test validators)
They require a private key holding Ethereum tokens in order to post transactions. For our test
purposes we use anvil and instantiate 2 anvil instances on different ports. You need to start them
by `anvil & anvil -p8546`. The key path in the test configuration is set to `/tmp/priv_key_test`
therefore this file needs to be created with the following command:

```
echo -n 0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a > /tmp/priv_key_test
```

### Optional WebSocket newHeads subscription

- Provider field: add `websocket_url` (optional) under each provider in `SequencerConfig.providers.<name>`.
- Format: must start with `ws://` or `wss://` (validated at startup).
- Behavior: when set, the reorg tracker subscribes to `newHeads` over WS to trigger checks; all reads (blocks, receipts, finalized blocks, contract state) remain over HTTP.
- Fallback: if WS connect/subscribe fails or drops, the tracker falls back to polling with exponential backoff (1s → 30s cap, ±10% jitter) and periodically retries WS.
- Startup: even with WS enabled, the tracker performs a one-time HTTP fetch to seed local observed tip before listening.

## How to run the sequencer

```
[john@doe:~/blocksense]$ cargo run --bin sequencer
```

Note: the sequencer needs to send transactions to a deployed contract. If you have deployed the contract you can provide its
address in the configuration json file. If not send a GET HTTP request to the sequencer as follows: `curl http://127.0.0.1:8877/deploy/<network name>`.
For example:

```
curl http://127.0.0.1:8877/deploy/ETH1
```

The sequencer will deploy the contract and use it from there on. We provide an end to end integration test that starts
the sequencer process, starts the 2 anvil Eth providers, deploys contracts on the providers, generates signed HTTP requests
to the sequencer and waits fot the sequencer to posts data to the contracts. It can be found in
`blocksense/sequencer_tests`. To run it from the main project folder:

```
[john@doe:~/blocksense]$ cargo run --bin sequencer_tests
```

To set the logging level, you can provide an environment variable before running the sequencer as follows:

```
export SEQUENCER_LOG_LEVEL=DEBUG
```

This environment variable is not mandatory, and the default value is `INFO`. All supported logging levels are in apps/sequencer/src/utils/logging.rs
Logging level can be changed at runtime as well by posting an HTTP request only from localhost, for example:

```
curl http://127.0.0.1:8877/main_log_level/DEBUG -X POST
```
