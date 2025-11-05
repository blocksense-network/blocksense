# Chain-interactions

**Building**

To build the package:

```sh
yarn build
```

**Testing**

To test the package:

```sh
yarn test
```

## Commands

### Setup

`deployedTestnets`/`deployedMainnets` type needs to be updated after we deploy to a new network.

For balance you need to set up RPCs for the networks - check `.env.example` for reference.

For cost-calculations you need to set up Api Keys for some networks - check `.env.example` for reference.

### balance

Print the balance of an address on the current deployedTestnets.

To run this script, do the following, from the root of the repo:

```
yarn build @blocksense/base-utils
cd apps/chain-interactions
yarn start chain-interactions balance
```

#### Available options

- `--address`, `-a` — Address to fetch balances for (defaults testnet/mainnet sequencer address).
- `--network`, `-n` — Limit the run to a single network.
- `--rpc`, `-r` — custom RPC URL to query directly.
- `--prometheus`, `-p` — Expose balances as Prometheus metrics.
- `--host` — Hostname for the Prometheus server when enabled (default `0.0.0.0`).
- `--port` — Port for the Prometheus server when enabled (default `9100`).
- `--mainnet`, `-m` — Use mainnet deployments from deployedMainnet and env vars.

Note:
When you want to ask for a specific network use `--network networkName` or `--rpc rpcUrl`.
When you want to ask for all deployed testnets just don't pass the above options and for mainnet use `--mainnet true`.
No options are mandatory.

### check-pending

Check all networks in deployedTestnets for pending transactions.

To run this script, do the following, from the root of the repo:

```
yarn build @blocksense/base-utils
cd apps/chain-interactions
yarn start chain-interactions check-pending
```

#### Available options

- `--address`, `-a` — Address to check for queued transactions (defaults testnet/mainnet sequencer address).
- `--network`, `-n` — Limit the run to a single network.
- `--rpc`, `-r` — custom RPC URL to query directly.
- `--prometheus`, `-p` — Expose the pending nonce difference as Prometheus metrics.
- `--host` — Hostname for the Prometheus server when enabled (default `0.0.0.0`).
- `--port` — Port for the Prometheus server when enabled (default `9100`).
- `--mainnet`, `-m` — Inspect the mainnet deployments instead of testnets.

Note:
When you want to ask for a specific network use `--network networkName` or `--rpc rpcUrl`.
When you want to ask for all deployed testnets just don't pass the above options and for mainnet use `--mainnet true`.
No options are mandatory.

### cost

Print and log the following:

1. avg gas price
2. gas for 1/24h
3. cost for 1/24h
4. current balance
5. current runway

This is done for all deployedTestnets using the last N transactions (default is 1000) over the time they took place.

To run this script, do the following, from the root of the repo:

```
yarn build @blocksense/base-utils
cd apps/chain-interactions
yarn start chain-interactions cost
```

#### Available options

- `--address`, `-a` — Override the sequencer address (defaults testnet/mainnet sequencer address).
- `--numberOfTransactions`, `--num` — How many recent transactions to analyse for cost calculations (default `288`).
- `--network`, `-n` — Restrict the run to a single network instead of all deployed ones.
- `--firstTxTime` — Ignore transactions before this ISO timestamp (default uses all data), e.g. `2025-02-06T12:55:14.000Z`.
- `--lastTxTime` — Ignore transactions after this ISO timestamp (default uses all data).
- `--prometheus`, `-p` — Enable exposing Prometheus metrics (disabled by default).
- `--host` — Hostname for the Prometheus server when enabled (default `0.0.0.0`).
- `--port` — Port for the Prometheus server when enabled (default `9100`).
- `--mainnet`, `-m` — Use mainnet deployments and env vars (defaults to testnets).

Note:
When you want to ask for a specific network use `--network networkName`.
When you want to ask for all deployed testnets just don't pass `--network` and for mainnet use `--mainnet true`.
No options are mandatory.

### unstuck-transaction

Send empty transactions with the purpose of removing all pending transactions for this account on this network.

To run this script, do the following, from the root of the repo:

```
yarn build @blocksense/base-utils
cd apps/chain-interactions
yarn start chain-interactions unstuck-transaction
```

#### Available options

- `--address`, `-a` — Address whose pending transactions should be cleared (defaults to `SEQUENCER_ADDRESS`).
- `--providerUrl`, `-p` — RPC endpoint to broadcast the replacement transaction (required).
- `--network`, `-n` - Specify the target network using its name, will use RPC from your .env for it
- `--privateKeyPath`, `--pkp` — File path containing the private key for the account (required; key must match the target address).

Note:
`--privateKeyPath` and one of `--providerUrl` or `--network` are mandatory.
