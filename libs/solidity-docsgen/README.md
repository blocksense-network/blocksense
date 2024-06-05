# @blocksense/solidity-docsgen

`@blocksense/solidity-docsgen` is a tool designed to enhance the documentation extraction process for Solidity smart contracts. This project aims to provide comprehensive and customizable documentation generation capabilities.

## Features

- **Enhanced Documentation Extraction**: Extracts detailed comments and metadata from Solidity smart contracts.
- **Advanced Parsing**: Improved parsing mechanisms to handle complex contract structures and annotations.
- **Raw Output**: Generates raw output simular to the AST representation of the smart contracts.
- **Fine Output**: Generates fine output with detailed information about the contracts, functions, variables etc.

## Installation

Install the package using npm or yarn:

```bash
npm install @blocksense/solidity-docsgen
```

or

```bash
yarn add @blocksense/solidity-docsgen
```

## Usage

### Hardhat

Include the plugin in your Hardhat configuration.

```diff
 // hardhat.config.ts
+ import '@blocksense/solidity-docsgen';

 export default {
+  docgen: { ... }, // if necessary to customize config
 };
```

Then run with `hardhat docgen`.

### Config

See [`config.ts`](./src/config.ts) for the list of options and their documentation.
