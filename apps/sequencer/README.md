# Initial implementation for the Blocksense sequencer

## How to build the sequencer

You need to call `cargo build` from the root blocksense project folder.

```
[john@doe:~/blocksense]$ cargo build
```
## How to configure the sequencer
You need to set the following environment variables:
1. PRIVATE_KEY - the path to the file containing the sequencer's private key for posting transaction to ethereum.
For example:
```
export PRIVATE_KEY=/tmp/priv_key_test
```
where the contents of the file are
```
0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a
```
2. RPC_URL - the JRPC url of the ethereum node that the sequencer will communicate with. For testing `anvil` is recommended.
For example:
```
RPC_URL=http://127.0.0.1:8545
```
## How to run the sequencer

```
[john@doe:~/blocksense]$ cargo run --bin sequencer
```
Note: the sequencer needs to send transactions to a deployed contract. If you have deployed the contract you can provide its address in the environment variable CONTRACT_ADDRESS. If not send a GET HTTP request to the sequencer as follows: `curl http://127.0.0.1:8877/deploy`. The sequencer will deploy the contract and use it from there on. To send a data feed you can use the following test HTTP request:
```
curl -X POST 127.0.0.1:8877/test -H 'Content-Type: application/json' -d '{"feed_id":"YahooFinance.BTC/USD","reporter_id":0,"result":70000.5,"timestamp":'$((($(date +%s%N | cut -b1-13))))'}'
```
