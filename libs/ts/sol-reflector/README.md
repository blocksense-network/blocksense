# @blocksense/sol-reflector

`@blocksense/sol-reflector` is a tool designed to enhance the documentation and specification extraction process for Solidity smart contracts. This project aims to provide comprehensive and customizable documentation generation capabilities.

## Features

- **Enhanced Documentation Extraction**: Extracts detailed comments and metadata from Solidity smart contracts.
- **Advanced Parsing**: Improved parsing mechanisms to handle complex contract structures and annotations.
- **Raw Output**: Generates raw output similar to the AST representation of the smart contracts.
- **Fine Output**: Generates fine output with detailed information about the contracts, functions, variables etc.

## Installation

> **Note**: The package `@blocksense/sol-reflector` is not yet published to NPM. Currently, it only works in the monorepo as a workspace. Ensure you are working within the monorepo environment to use this package.

Install the package using npm or yarn:

```bash
npm install @blocksense/sol-reflector
```

or

```bash
yarn add @blocksense/sol-reflector
```

## Usage

### Hardhat

Include the plugin in your Hardhat configuration.

```diff
// hardhat.config.ts
+ import '@blocksense/sol-reflector';

 export default {
+  reflect: { ... }, // if necessary to customize config
 };
```

Then run with `hardhat reflect`.

### Config

See [`config.ts`](./src/config.ts) for the list of options and their documentation.
