# Onchain-interactions

## How to use scripts

### balance-script

Print the balance of an address on the current deployedNetworks

`yarn get-wallets-balances --address <ethereum address>`
or just `yarn get-wallets-balances` if you want to check the funds on the sequencer(0xd756119012CcabBC59910dE0ecEbE406B5b952bE)

### cost-calculations

Print and log the cost of avg transaction and that of all transactions that would be done in 24h(if we assume 5 min between transactions) on all deployedNetworks

`yarn calculate-cost --address <ethereum address>`
or just `yarn calculate-cost` if you want to check the cost on the sequencer(0xd756119012CcabBC59910dE0ecEbE406B5b952bE)

### unstuck-transaction

Send an empty transaction with the purpose to remove pending transactions

`yarn unstuck-transaction --address <ethereum address> --providerUrl <url> --privateKey <key>`
