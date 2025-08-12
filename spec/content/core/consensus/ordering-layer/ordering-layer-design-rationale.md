# **The Blocksense Ordering Layer: Design Rationale for a Resilient Mempool**

## **1\. Introduction: The Heart of the Boundless Throughput Engine**

The Blocksense architecture is founded on the principle of Decoupled State Machine Replication (DSMR), which separates the complex task of running a blockchain into two distinct layers: an **Ordering Layer** responsible for establishing a global, definitive sequence of transactions, and an **Execution Layer** that processes the state transitions defined by that sequence.1

This document provides a detailed background on the design philosophy and technical architecture of the Blocksense Ordering Layer. The design of this layer is paramount, as it directly impacts the network's performance, security, and fairness. It must satisfy a demanding set of requirements to enable the high-performance oracle services and ZK-native functionalities that define the Blocksense network.1

## **2\. The Problem Statement: Core Requirements for the Ordering Layer**

The design of the Blocksense Ordering Layer is guided by a set of uncompromising requirements that collectively ensure a robust, efficient, and fair platform for all participants.

- **Uncompromising Censorship Resistance:** The system must be able to resist attempts by any single party or small coalition to prevent valid transactions from being included and ordered. This is a critical prerequisite for supporting coercion-resistant applications like MACI (Minimal Anti-Collusion Infrastructure).1
- **Sub-Second Finality:** To minimize the latency of our oracle services and enable real-time applications, the global order of transactions must be determined and finalized in under a second.1
- **Verifiable Finality with Zero-Knowledge Proofs:** The proof that a specific transaction order has been finalized must be expressible as a succinct ZK proof. This is essential for enabling trustless, ZK-native bridges to other chains and allowing light clients to sync to the network's state with a single proof verification.1 A ZK proof of the execution layer alone is insufficient, as it would allow for the cheap construction of alternative histories.
- **Deterministic Total Ordering:** The layer must produce a single, unambiguous, and totally ordered sequence of all transactions. This determinism is fundamental to the correctness of the state machine.
- **Precise Transaction Timestamps:** Each transaction must be assigned a reliable and agreed-upon timestamp. This is crucial for the execution layer's batching logic, which may operate on principles such as "10ms have elapsed" or "a batch of N transactions has been committed."
- **Maximal Extractable Value (MEV) Mitigation:** The design should actively prevent or mitigate extractive MEV strategies like front-running and sandwich attacks. This is achieved through mechanisms such as applying a random permutation to transactions after finalization and implementing commit-reveal schemes.1
- **Robust Spam and Denial-of-Service (DoS) Resistance:** In a high-throughput system, preventing malicious actors from flooding the network with invalid or low-value transactions is a critical security challenge. The system must have robust mechanisms to disincentivize and penalize such behavior.

## **3\. The Spam Challenge in Decoupled Architectures**

In a traditional monolithic blockchain, transaction validation, ordering, and execution are tightly bundled. A block producer typically executes transactions before including them in a block, ensuring they are valid and fee-paying.

In a DSMR architecture, this is not the case. The Ordering Layer agrees on a sequence of transactions _before_ they are fully executed. This creates a critical vulnerability highlighted in research on high-throughput systems like Avalanche's Vryx: the potential for a significant gap between **replicated TPS (rTPS)** and **finalized, fee-paying TPS (fTPS)**.

An adversary can exploit this by submitting a high volume of transactions that are syntactically valid (and thus accepted by the Ordering Layer) but will fail during semantic validation at the Execution Layer (e.g., due to an invalid signature, insufficient funds, or a failed smart contract assertion). In this scenario, the network's validators waste valuable bandwidth, storage, and consensus resources ordering useless data, effectively launching a DoS attack that reduces the network's capacity for legitimate transactions. A successful mempool design must ensure that fTPS remains as close to rTPS as possible, even under adversarial conditions.

## **4\. The Blocksense Approach: A Multi-Layered Defense**

The Blocksense Ordering Layer integrates and extends state-of-the-art concepts, adapting them to our unique object ownership and account abstraction models. Our solution is a multi-layered defense system designed to make spam economically irrational and computationally ineffective.

### **Layer 1: Pre-Consensus Validation**

The first and most critical line of defense is a rigorous set of checks that every transaction must pass _before_ it is accepted into the mempool for ordering. Unlike traditional mempools that might gossip unverified data, Blocksense validators perform lightweight but essential semantic validation upfront. This model is inspired by Sui's architecture, where validators ensure a transaction is viable before committing consensus resources to it.2

To achieve this, mempool nodes (validators) must have access to the state of the objects a transaction intends to use. When a user submits a transaction, the receiving validator performs the following checks:

1. **Authorization Verification:** The validator fetches the current state of the sender's user object and its associated IdentityService. It then simulates the authorize_user call, using the provided authorization_data and intentions to confirm that the transaction is properly authorized. This check immediately rejects transactions with invalid signatures or ZK proofs.
2. **Ownership and Gas Sufficiency:** The validator verifies that the sender owns all input objects and that the account holds sufficient funds to cover the max_gas_absolute specified in their Gas Policy.

Only transactions that pass all these checks are signed by the validator and broadcast to the DAG for ordering. This "sane transaction" gate is the primary mechanism for preventing invalid data from consuming network resources, ensuring that only potentially valid, fee-paying transactions enter the consensus process.

### **Layer 2: Reputation-Gated Ingress**

The second layer of defense is a reputation system built directly into our native account abstraction model. This acts as a powerful Sybil resistance mechanism.

- **Mechanism:** Every user object on Blocksense is assigned an on-chain reputation score. This score is a function of various factors, including account age, historical transaction volume, the value of assets held, and the ratio of successful to reverted transactions.
- **Spam Mitigation:** A user's reputation score directly determines their baseline transaction throughput limit. New accounts with zero history have a very low limit, sufficient for initial interactions but insufficient for launching a meaningful spam attack. To gain a higher throughput allowance, an account must build a positive on-chain history over time. This creates a significant economic barrier for attackers, who would need to "age" and fund a vast number of accounts to mount a large-scale DoS attack.

### **Layer 3: Dynamic Back-Pressure and Resource Management**

The final layer addresses a potential imbalance in the DSMR model: the risk that the Ordering Layer could accept valid transactions faster than the Execution Layer can collectively prove and finalize them. This is managed through a dynamic back-pressure mechanism.

- **Mechanism:** Mempool nodes constantly monitor the length of the execution queue—the distance between the last transaction finalized by the Ordering Layer and the last transaction for which a ZK proof has been accepted by the network.
- **Spam and Overload Mitigation:** If this queue grows beyond a safe threshold, it indicates that the network is under heavy load or that execution capacity is lagging. In response, the mempool nodes begin applying back-pressure.3 They will start rejecting new incoming transactions, and the user's client software will receive a "network congested" notification. This prevents the execution queue from growing indefinitely and ensures system stability.
- **Economic Feedback Loop:** This back-pressure mechanism is coupled with an economic incentive. A long execution queue automatically triggers higher rewards in the open market for submitting ZK proofs. This incentivizes more Prover nodes to join the network or allocate more resources to clearing the backlog, thereby increasing execution capacity and restoring balance.
- **Over-Provisioned by Design:** The Blocksense economic model encourages a large pool of hardware operators who can service both high-margin Web3 verification tasks and low-margin commodity Web2 compute jobs.1 Since participating in consensus and execution is designed to be more profitable, the network is expected to always be over-provisioned, with operators ready to shift their capacity to clear the execution queue when rewards increase.

For this feedback loop to be effective, users must have direct, low-latency connections to the network's validators, which may be multi-homed to enhance their own DoS resilience.

## **5\. Conclusion**

The Blocksense Ordering Layer is a sophisticated system engineered to meet the extreme demands of a universal verification layer. By unifying the concepts of rigorous pre-consensus validation, on-chain reputation, and dynamic back-pressure, our design creates a robust, multi-layered defense against spam and DoS attacks. This architecture ensures that as the network scales to boundless throughput, it remains fair, censorship-resistant, and economically secure, providing a stable foundation for the next generation of decentralized services.

#### **Works cited**

1. Blocksense\_ A Litepaper for the Universal Verification Layer.pdf
2. Life of a Transaction \- Sui Documentation, accessed July 31, 2025, [https://docs.sui.io/concepts/sui-architecture/transaction-lifecycle](https://docs.sui.io/concepts/sui-architecture/transaction-lifecycle)
3. Back Pressure in Distributed Systems \- GeeksforGeeks, accessed July 31, 2025, [https://www.geeksforgeeks.org/computer-networks/back-pressure-in-distributed-systems/](https://www.geeksforgeeks.org/computer-networks/back-pressure-in-distributed-systems/)
4. Rahasak blockchain Validate-Execute-Group architecture workflow. \- ResearchGate, accessed July 31, 2025, [https://www.researchgate.net/figure/Rahasak-blockchain-Validate-Execute-Group-architecture-workflow_fig1_349400291](https://www.researchgate.net/figure/Rahasak-blockchain-Validate-Execute-Group-architecture-workflow_fig1_349400291)
