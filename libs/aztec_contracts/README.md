# Data Feed Storage

## Overview

```text
aztec_contracts
├── contracts/
│   ├── data_feed_store/
│   │   ├── src
│   │   │    ├── artifacts/
│   │   │    │   └── ... type-safe methods for deploying and interacting
│   │   │    │           with your contract based on their artifacts
│   │   │    │
│   │   │    └── main.nr
│   │   ├── codegenCache.json
│   │   └── target/
│   │       └── ... Contains the Noir ABI artifacts
│   │
├── tests/
│   └── data_feed.test.ts
│
├── jest.integration.config
├── package.json
└── tsconfig.json
```

### Important Note:

Bit-wise operations, albeit used in [our Solidity smart contracts](https://github.com/blocksense-network/blocksense/tree/main/libs/contracts), are on the contrary expensive in gates when performed within circuits. That's why the Noir contract calls aren't handled based on the function selector [like their Solidity precursors](https://github.com/blocksense-network/blocksense/tree/main/libs/contracts#calls). That's because Noir program(e.g. in our case the `data_feed_store` contract) compiles to an Abstract Circuit Intermediate Representation which is a tree structure composed of Leaves(**inputs**) and Nodes (which contain arithmetic operations to combine them(**gates**)). And since circuits are made of arithmetic gates, the cost of arithmetic operations tends to be one gate. Whereas for procedural code, they represent several clock cycles. Thus the decision of having a simple mapping between `id` of the data feed and its data represented as 32 `bytes` in the `data_feed_store` contract.

The `contracts` folder contains the Data feed store contract, its ABI artifacts and type-safe methods for deploying and interacting with the contract based on its artifacts. The `tests` folder contains the `data_feed.test.ts` test.

It has three tests respectively:

- Checks that the caller isn't the owner
- Checks setting and getting of 10 feeds in a single transaction
- Checks the deployment of the contract

## Testing

To execute the tests you must have the following prerequisites:

1.  Node.js >= v18 (recommend installing with nvm)
2.  Docker (visit this page of the Docker docs on how to install it)
3.  To install aztec's tooling, including aztec's sandbox, aztec-cli, aztec-nargo and aztec-up, run:

        bash -i <(curl -s install.aztec.network)

4.  Once these have been installed, to start the sandbox, run:

        aztec start --sandbox

5.  Go to the `data_feed_store` directory and execute:

        aztec-nargo compile --silence-warnings

    This will generate contracts ABI artifacts in the `target` folder.

6.  Next, generate the typescript bindings for the ABI artifacts using:

        aztec codegen target -o src/artifacts

7.  When you complete these steps, you can run the tests by returning to the root directory `aztec_contracts` and executing:

        yarn install
        yarn test
