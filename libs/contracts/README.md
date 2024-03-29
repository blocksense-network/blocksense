# Data Feed Storage

## Overview

The `contracts` folder has the following structure:

```text
contracts
├── test
│   ├── interfaces
│   |   └── ...
│   ├── consumers
│   |   └── ...
│   ├── DataFeedStoreGenericV1.sol
│   └── DataFeedStoreGenericV2.sol
├── DataFeedStoreV1.sol
├── DataFeedStoreV2.sol
└── DataFeedStoreV3.sol
```

The `test` folder contains example consumer contracts (under `consumers`) and reference implementations of data feed store - DataFeedStoreGenericV1.sol and DataFeedStoreGenericV2.sol.

Each of the data feed store implementations (DataFeedStoreV1.sol, DataFeedStoreV2.sol, DataFeedStoreV3.sol) is a contract that stores data feed values for a specific data feed key. The data feed key is a maximum of 31 bit integer that uniquely identifies a data feed. The data feed value is stored as `bytes32`. The data feed value is updated by the data feed store contract owner.

### Calls

All calls are handled by a fallback function based on the selector:

- Getter:
  - For `DataFeedStoreV1.sol` the selector is `0x00000000` + a key which should not be greater than a predefined constant `CONTRACT_MANAGEMENT_SELECTOR` (e.g. `0x00...0001ffff`);
  - For `DataFeedStoreV2.sol` and `DataFeedStoreV3.sol` the selector is `0x80000000` + key which enables the key to be a 31 bit integer. The most significant bit of the selector defines the type of the call (getter or setter);
- Setter:
  - All contracts have the same selector `0x1a2d80ac` which is the keccak256 hash of the string `setFeeds(bytes)`.

> This way the gas cost of calls is reduced as the Solidity compiler will not generate `Linear If-Else Dispatcher` generated statements for the different selectors.

### Storage layout representation

- `DataFeedStoreV1.sol` and `DataFeedStoreV2.sol`:
  - `mapping(uint32 => bytes32) dataFeed`
- `DataFeedStoreV3.sol`:
  - `bytes32[] dataFeed`

## Development

Available scripts:

```sh
yarn hardhat help
yarn clean
yarn build
yarn test
yarn coverage
yarn size

# Run these two in separate shells:
yarn hardhat node
yarn deploy:local ./scripts/deploy-lock.ts
```

Running `yarn test` will output a gas cost comparison table between the different data feed store implementations and the reference implementations.
