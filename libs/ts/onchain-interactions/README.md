# Onchain-interactions

## Setup

`deployedNetworks` type needs to be updated after we deploy to a new network.

For balance you need to set up RPCs for the networks - check `.env.example` for reference.

For cost-calculations you need to set up Api Keys for the networks - check `.env.example` for reference.

## How to use scripts

### balance-script

Print the balance of an address on the current deployedNetworks.

To run this script, do the following, from the root of the repo:

```
yarn build @blocksense/base-utils
cd libs/ts/onchain-interactions
yarn balance-script
```

You can use `yarn balance-script --help` to get the full list of options.

### check-pending-tx

Check all networks in deployedNetworks for pending transactions.

To run this script, do the following, from the root of the repo:

```
yarn build @blocksense/base-utils
cd libs/ts/onchain-interactions
yarn check-pending-tx
```

You can use `yarn check-pending-tx --help` to get the full list of options.

### cost-calculations

Print and log the following:

1. cost of avg transaction,
2. avg gas price,
3. cost for 24h and runway, and
4. current balance.

This is done for all deployedNetworks using the last N transactions (default is 288) with M seconds between transactions (default 300).

To run this script, do the following, from the root of the repo:

```
yarn build @blocksense/base-utils
cd libs/ts/onchain-interactions
yarn calculate-cost
```

You can use `yarn calculate-cost --help` to get the full list of options.

### unstuck-transaction

Send empty transactions with the purpose of removing all pending transactions for this account on this network.

To run this script, do the following, from the root of the repo:

```
yarn build @blocksense/base-utils
cd libs/ts/onchain-interactions
yarn unstuck-transaction
```

You can use `yarn unstuck-transaction --help` to get the full list of options.
