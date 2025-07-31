---
title: 'Blocksense Protocol Specification'
description: 'Complete technical specification for the Blocksense Protocol - a universal verification layer for Web3 and Web2'
tags: ['protocol', 'specification', 'blocksense']
---

# Blocksense Protocol Specification

Welcome to the complete technical specification for the Blocksense Protocol. This specification serves as an executable reference implementation with formal verification, designed to be the authoritative source for understanding and implementing the Blocksense system.

## Overview

Blocksense is a universal verification layer that solves two fundamental barriers in blockchain technology:

1. **The Connectivity Barrier** - Secure integration with real-world data and computation
2. **The Throughput Barrier** - Boundless scalability through parallel architecture

## Navigation

### Core Protocol

- [[Core Architecture Overview]] - High-level system design
- [[zkSchellingCoin Consensus]] - Bribery-resistant consensus mechanism
- [[DSMR Architecture]] - Decoupled State Machine Replication
- [[Cryptographic Primitives]] - ZK proofs, MPC, and signature schemes

### Data Feeds & Oracles

- [[Oracle Scripts]] - WebAssembly-based data feed creation
- [[Intersubjective Consensus]] - Resolving subjective truths
- [[Data Aggregation]] - Multi-source data combination algorithms

### Implementation

- [[TypeScript Implementation]] - Reference implementation and SDK
- [[Rust Implementation]] - Performance-critical components with Verus
- [[Lean4 Verification]] - Formal mathematical proofs

### Smart Contracts

- [[ADFS Architecture]] - Aggregated Data Feed Store
- [[Chainlink Compatibility]] - Drop-in replacement layer
- [[Cross-Chain Bridges]] - Multi-chain deployment

## Getting Started

1. **For Protocol Developers**: Start with [[Core Architecture Overview]]
2. **For Oracle Builders**: Begin with [[Oracle Scripts]]
3. **For Smart Contract Integrators**: See [[ADFS Integration Guide]]
4. **For Node Operators**: Review [[Node Operations]]

## Contributing

This specification is maintained as a living document. See [[Contributing Guidelines]] for how to propose changes and improvements.

---

_This specification is published at [specification.blocksense.network](https://specification.blocksense.network) and maintained in the [Blocksense monorepo](https://github.com/blocksense-network/blocksense)._
