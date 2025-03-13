# Data Feed Storage

## Overview

```text
aztec
├── contracts/
│   ├── historical_data_feed/
│   │   ├── src
│   │   │    ├── artifacts/
│   │   │    │   └── ... Noir ABI artifacts for deploying and interacting
│   │   │    │           with your contract based on their artifacts
│   │   │    │
│   │   │    └── main.nr
│   │   ├── codegenCache.json
│   │   └── target/
│   │       └── ... Contains the binary executables from which the artifacts are generated
│   │
│   ├── data_feed_store/
│   │   ├── src
│   │   │    ├── artifacts/
│   │   │    │   └── ... Noir ABI artifacts for deploying and interacting
│   │   │    │           with your contract based on their artifacts
│   │   │    │
│   │   │    └── main.nr
│   │   ├── codegenCache.json
│   │   └── target/
│   │       └── ... Contains the binary executables from which the artifacts are generated
│   │
├── tests/
│   └── data_feed.test.ts
│
├── jest.integration.config
├── package.json
└── tsconfig.json
```

##### Note that the ABI artifacts in target/, artifacts/ directories will be generated only after performing the steps below.

### Important Note:

Bit-wise operations, albeit used in [our Solidity smart contracts](https://github.com/blocksense-network/blocksense/tree/main/libs/contracts), are on the contrary expensive in gates when performed within circuits. That's why the Noir contract calls aren't handled based on the function selector [like their Solidity precursors](https://github.com/blocksense-network/blocksense/tree/main/libs/contracts#calls). That's because Noir program (e.g. in our case the `data_feed_store` contract) compiles to an Abstract Circuit Intermediate Representation which is a tree structure composed of Leaves (**inputs**) and Nodes (which contain arithmetic operations to combine them (**gates**)). And since circuits are made of arithmetic gates, the cost of arithmetic operations tends to be one gate. Whereas for procedural code, they represent several clock cycles. Thus the decision of having a simple mapping between `id` of the data feed and its data represented as 32 `bytes` in the `data_feed_store` contract.

The `contracts` folder contains the Data feed store and the Historical data feed store contracts, their binary executables and ABI artifacts for deploying and interacting with the contracts. The `tests` folder contains the `data_feed.test.ts` and the `historic_data_feed.test.ts` tests.

`data_feed.test.ts` has three tests respectively:

- Checks that the caller isn't the owner
- Checks setting and getting 10 feeds
- Checks the deployment of the contract

`historic_data_feed.test.ts` has two tests respectively:

- Checks setting and getting 2 historical feeds in a single transaction
- Checks the deployment of the contract

## Testing

> [!IMPORTANT]
>
> - Currently, 0.55.1 aztec version is used for this setup!
> - To run the tests you need to have Node.js v18.19.1 due to the problems with aztec's tooling and the latest versions of Node.js.

To execute the tests you must have the following prerequisites:

1.  Docker (visit this page of the Docker docs on how to install it)
2.  To install aztec's tooling, including aztec's sandbox, aztec-cli, aztec-nargo and aztec-up, run:

        bash -i <(curl -s install.aztec.network)

> [!NOTE]
> If you are using fish, use:

        bash -c "bash -i <(curl -s install.aztec.network)"

3.  Once these have been installed, to start the sandbox, run:

        aztec start --sandbox

> [!NOTE]
> Aztec's sandbox installed binaries are suitable to be used with Linux. For NixOS users, starting the sandbox will require you to specify the path, like:

        /home/<your_user_name>/.aztec/bin/aztec start --sandbox

4.  Execute `yarn install`

- this step is required due to two aztec packages in the `.yarnrc.yml` file.

> [!IMPORTANT]
> Since the contracts are using version `0.55.1` of Aztec, if you encounter issues during compilation,
> you may need to switch to that exact aztec version using `aztec-up 0.55.1` and then the compilation should be successful.

5.  Go to the `libs/aztec/contracts/data_feed_store` directory and execute:

            aztec-nargo compile --silence-warnings

This will generate contracts ABI artifacts in the `target` folder.

6.  Next, generate the typescript bindings for the ABI artifacts using:

        aztec codegen target -o src/artifacts

7.  Repeat steps 6 and 7 for the other contract in the `libs/aztec/contracts/historic_data_feed` directory.

8.  When you complete these steps, you can run the tests by returning to the root directory `aztec` and executing:

        yarn install
        yarn test

## Update the contracts' version

To update the contracts' version, you can use the following steps:

1. Go to the directory of each contract respectively and open the `Nargo.toml` file.

2. Update the `tag` to whichever version you prefer. If you want the latest one, you have to put it manually since Aztec's monorepo still doesn't have a `latest` tag.

> [!IMPORTANT]
> Keep in mind that new Aztec versions introduce breaking changes,
> and the contracts may need to be adjusted accordingly for successful compilation.

3.  Since the tests are dependant on Aztec javascript dependencies, invoke the following command in root:

        yarn upgrade-interactive

Yarn will prompt you to pick the packages you want to upgrade.

4. Finally, navigate to `.yarnrc.yml` and update the `aztec` versions of `@aztec/circuit-types@0.55.1` and `@aztec/foundation@0.55.1` to the one that you prefer by `<name-of-the-package>@<version>`.
