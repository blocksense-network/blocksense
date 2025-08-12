# **Blocksense Architecture: Integrating Intersubjective Consensus**

## **1\. Introduction: Bridging Two Worlds of Truth**

The Blocksense network is uniquely designed to process both objective truths (computations with deterministic outcomes) and intersubjective truths (consensus on external information).1 The power of the network lies not just in handling these two domains, but in seamlessly and verifiably integrating them. The results from the

**Intersubjective Truth Machine**, powered by zkSchellingCoin, must be woven into the state of the **Boundless Throughput Engine** with the same mathematical certainty as any other state transition.1

This is achieved by ensuring that the final result of any zkSchellingCoin consensus is accompanied by a ZK proof that attests to the correct and impartial tallying of votes. This "consensus proof" is a first-class object that can be processed by the Execution Layer, creating a trustless bridge between the two layers. This integration happens through two primary mechanisms: regularly scheduled data feeds and on-demand requests from on-chain programs.

## **2\. Mechanism 1: Scheduled Data Feeds**

Scheduled data feeds are the backbone of Blocksense's oracle services, providing regular, automated updates for information like asset prices. The process is designed for efficiency, censorship resistance, and verifiable correctness.

### **2.1. Vote Submission and Collection**

For any given data feed, a secret sub-committee of reporters is selected to vote on the outcome.1

1. **Vote Casting:** Shortly before a scheduled publication time, each reporter in the committee submits their encrypted vote as a standard transaction.
2. **Censorship Resistance:** These vote transactions are processed by the Ordering Layer's parallel DAG mempool, which guarantees their inclusion and ordering in a censorship-resistant manner.1
3. **On-Chain Aggregation:** A simple, low-cost Objective Program, specific to the data feed, is executed. Its sole function is to receive the ordered votes and append them to a dedicated on-chain list, creating a public, immutable record of all submitted (but still encrypted) votes for that round.

### **2.2. The Coordinator's Role: Tallying and Proving**

Once the voting window closes, the responsibility shifts to a set of distributed **Coordinators**. Their role is to tally the votes and prove the correctness of the result, drawing heavily on the principles of the MACI protocol to ensure privacy and collusion resistance.

1. **Execution of Tallying Circuit:** A Coordinator executes a specialized ZK circuit. This circuit takes the on-chain list of encrypted votes as a public input.
2. **Private Tallying:** Using a shared secret known only to the voters and the coordinator, the circuit decrypts the votes _inside the ZK environment_. It then applies the data feed's specified aggregation logic (e.g., median, trimmed mean) to the decrypted votes to compute a final result.
3. **Proof Generation:** The circuit outputs two things: the final aggregated result and a succinct ZK proof. This proof attests that the tallying process was performed correctly on the exact set of on-chain votes, without revealing the individual votes themselves.

If a Coordinator fails to submit this proof within the designated time, their stake is slashed, ensuring high liveness for the system.

### **2.3. Publication, Routing, and Cross-Chain Delivery**

The final result is propagated through the system and delivered to external networks.

1. **Publication to Routing Table:** The Coordinator submits a transaction containing the final result and the tallying proof. A core system contract on the Execution Layer verifies this proof. If valid, the result is written to a special, system-wide **Routing Table**. This table acts as a central, verifiable source of truth for all oracle data.
2. **Cross-Chain Aggregation:** A separate, permissionless relayer network monitors the Routing Table. When a new value is published, the relayer identifies which target networks (e.g., Ethereum, Solana) are subscribed to that data feed.
3. **ADFS Payload Generation:** The relayer bundles all pending updates for a specific target network into a single payload, formatting it according to the data structure required by that chain's **Aggregated Data Feed Store (ADFS)** contract.1
4. **Final Proof for Target Chain:** The relayer generates a final ZK proof that attests to the correct bundling and formatting of this ADFS payload. This proof, along with the payload, is submitted to the target chain. The on-chain ADFS contract only needs to perform a single, inexpensive ZK proof verification to accept thousands of data updates simultaneously, providing unparalleled cost efficiency.1

## **3\. Mechanism 2: On-Demand Requests and the Task Manifest Pattern**

While scheduled feeds are efficient for continuous data, many applications require a response to a specific, one-time query. This is handled by a powerful and generalized request/response mechanism using the **Task Manifest** pattern.

### **3.1. The Task Manifest Object**

When an Objective Program needs to trigger a new verifiable computation, it does not call the system directly. Instead, it instantiates a special, temporary **Task Manifest Object**. This object acts as a dedicated coordination point for the request and defines its parameters:

- The specific data or computation being requested.
- The deadline for receiving a valid response.
- The address of a **callback program** to be executed upon successful completion.
- A **verifier program**, which is a circuit or TEE verifier responsible for validating the response.

### **3.2. Request and Callback Workflow**

1. **Instantiation:** An Objective Program creates a Task Manifest Object, funding it with the necessary fees to pay for the service.
2. **Service Execution and Proof Generation:** The appropriate off-chain service (e.g., a zkSchellingCoin Coordinator, a ZK Prover, a 3D rendering farm) performs the requested computation and generates a proof of its work.
3. **Response Submission:** The service provider submits the result and its corresponding proof directly to the Task Manifest Object.
4. **Response Verification:** The Task Manifest Object invokes its designated verifier program. This verifier is chosen based on the nature of the task:
   - For a **zkSchellingCoin** request, the verifier is a ZK circuit that checks the Coordinator's tallying proof.
   - For a **3D rendering** job, the verifier would likely be a program that checks a **TEE attestation**, confirming that a specific, audited rendering software was run in a secure enclave.
5. **Callback Execution:** If the response is successfully verified before the deadline, the Task Manifest Object triggers the execution of the specified callback program. It passes the final, verified result directly to this program as an input argument. This replaces the need for a global routing table, delivering the result precisely where it is needed.

## **4\. A General-Purpose Primitive for Verifiable Computation**

The on-demand request/response mechanism is a fundamental primitive of the Blocksense service-oriented architecture, extending far beyond simple data oracles.1 The "Task Manifest" pattern can be used to create on-chain markets for any kind of verifiable computation:

- **zkSchellingCoin Consensus:** A dApp can request a one-time consensus on a complex event, like the outcome of a prediction market.
- **ZK Proof Generation Market:** A dApp can create a Task Manifest with a request to generate a complex ZK proof for a large computation. The verifier program in the manifest would be the verifier circuit for the requested proof.
- **TEE-Verified Computation:** A metaverse application could request a high-fidelity 3D render of a scene, with the verifier program configured to accept only results accompanied by a valid TEE attestation.

In every case, the Task Manifest Object acts as a trustless escrow and verifier, ensuring that payment is only released for correctly completed work, as validated by the appropriate proof. This makes the Blocksense network an extensible, universally verifiable platform for a new generation of decentralized services.

#### **Works cited**

1. Blocksense\_ A Litepaper for the Universal Verification Layer.pdf
