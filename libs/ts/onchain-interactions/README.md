# Onchain-interactions

## Setup

`deployedNetworks` type needs to be updated after we deploy to a new network.

For balance you need to set up the RPCs of the networks - check `.env.example` for reference.

For cost calculation on `ethereum-sepolia` and `ethereum-holesky` you need `ETHERSCAN_API_KEY` set in `.env`.

## How to use scripts

### balance-script

Print the balance of an address on the current deployedNetworks.

`yarn get-wallets-balances --address <ethereum address>`
or just `yarn get-wallets-balances` if you want to check the funds on the sequencer (0xd756119012CcabBC59910dE0ecEbE406B5b952bE).

### check-pending-tx

Check all networks in deployedNetworks for pending transactions.

`yarn check-pending-tx --address <ethereum address>`
or just `yarn check-pending-tx` if you want to check for pending on the sequencer (0xd756119012CcabBC59910dE0ecEbE406B5b952bE).

### cost-calculations

Print and log the cost of avg transaction, avg gas price, cost for 24h and runway on all deployedNetworks using the last N transactions (default is 288) and current balance with M seconds between transactions (default 300).

`yarn calculate-cost --address <ethereum address> --numberOfTransactions<number> --secondsBetweenTransactions<number>`
or just `yarn calculate-cost` if you want to check the cost on the sequencer (0xd756119012CcabBC59910dE0ecEbE406B5b952bE).

### unstuck-transaction

Send empty transactions with the purpose of removing all pending transactions for this account on this network.

`yarn unstuck-transaction --address <ethereum address> --providerUrl <url> --privateKey <key>`
