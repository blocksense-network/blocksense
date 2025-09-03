# Getting Started with Blocksense Oracle

Welcome to Blocksense! This guide will help you set up and run your first Blocksense oracle instance locally. By the end of this guide, you'll have a complete oracle system running that aggregates data from multiple sources and publishes it to a blockchain network.

## Prerequisites

Before diving into Blocksense, make sure you have the following setup:

### 1. Documentation Familiarity

Get familiar with our documentation to understand Blocksense architecture and concepts:

- Check out our [Documentation](https://docs.blocksense.network/)
- Review the project structure in this repository

### 2. Install Nix

**Install** [Nix](https://zero-to-nix.com/start/install) - Nix is essential for managing our development environment and dependencies in a reproducible way.

### 3. Install Direnv

Install **Direnv** and [hook it](https://direnv.net/docs/hook.html) with your shell. Direnv automatically loads the development environment when you enter the project directory.

### 4. Enable Environment Management

Allow direnv to automatically manage your shell environment:

```fish
direnv allow
```

This command enables direnv to automatically set up the correct development environment when you navigate to the Blocksense directory.

### 5. Install Dependencies

Install all JavaScript/TypeScript dependencies:

```fish
yarn install
```

### 6. Build TypeScript Libraries

Build the TypeScript libraries that other parts of the system depend on:

```fish
just build-ts
```

## Running Your First Oracle Setup

Now that your environment is ready, let's start a complete oracle setup! Try running one of our local development environments:

```fish
just start-environment example-setup-03
```

> **⏳ Note**: This might take some time on the first run as it needs to download and set up various components. Be patient - subsequent runs will be much faster!

> **💡 Tip**: If you try to run `example-setup-01` you might need some API keys, in order to start the reporter. Tou can add the following placeholders in your `.env` file run `direnv reload` and rerun the start-environment command

```
    # Oracle API Keys
    CMC_API_KEY="x"
    YF_FINANCE_API="x"
    APCA_API_KEY_ID="x"
    APCA_API_SECRET_KEY="x"
    ALPHAVANTAGE_API_KEY="x"
    YAHOO_FINANCE_API_KEY="x"
    TWELVEDATA_API_KEY="x"
    FMP_API_KEY="x"
    SPOUT_RWA_API_KEY="x"
```

Once the command finishes, it will start [Process Compose](https://github.com/F1bonacc1/process-compose), a tool for orchestrating multiple processes in development.

## Understanding the System Components

When the environment starts, several key processes work together to create a complete oracle system:

### 🔗 **Network Fork**

- **What**: We fork the `ink-sepolia` testnet locally
- **Purpose**: Provides a controlled blockchain environment for testing
- **Benefits**: Allows unlimited testing without real gas costs or network limitations

### 🤖 **Sequencer Impersonation**

- **What**: We impersonate the sequencer address to publish data to the local fork
- **Purpose**: Simulates the production sequencer behavior in a controlled environment
- **Function**: Aggregates data from multiple oracles and submits transactions to the network

### 📊 **Reporter**

- **What**: Process that orchestrates multiple [oracles](`apps/oracles/)
- **Purpose**: Fetch data from various external sources (price feeds, custom feeds, etc.)
- **Function**: Push collected data to the sequencer for aggregation

### 🔄 **Data Aggregation & Publishing**

- **What**: The sequencer aggregates incoming data from all oracle reporters
- **Purpose**: Creates consensus from multiple data sources
- **Function**: Publishes verified, aggregated data to the blockchain network via transactions

## Monitoring Your Oracle

### 📋 Process Overview

Once the system is running, you can monitor all processes through the Process Compose interface that opens automatically in your browser.

### 📝 Examining Logs

You can examine detailed logs for each component in:

```
logs/process-compose/example-setup-03/
```

This directory contains separate log files for each process:

- `sequencer.log` - Main sequencer operations and transaction submissions
- `reporter.log` - Logs of the reporter and its oracle activities
- `<network-fork>.log` - Local blockchain network operations

### 🔍 Useful Log Commands

View real-time sequencer logs:

```fish
tail -f logs/process-compose/example-setup-03/sequencer.log
```

## Next Steps

Once you have the basic setup running:

1. **Explore the Code**: Look through `apps/oracles/` to see how different data sources are integrated
2. **Monitor Data Flow**: Watch the logs to understand how data moves through the system
3. **Build Custom Oracles**: Follow our [Oracle Development Guide](guide-develop-oracle.md) to create your own data feeds
4. **Deploy to Networks**: Use our [Network Deployment Guide](guide-deploy-new-network.md) to deploy to actual networks

## Troubleshooting

If you encounter issues:

1. **Check Prerequisites**: Ensure Nix, Direnv, and all dependencies are properly installed
2. **Review Logs**: Check the log files for specific error messages
3. **Clean Build**: Try `just clean` followed by `just build-ts`

Welcome to Blocksense 🚀
