# **Security Policy**

## **1\. Overview**

Security is a foundational pillar of the Blocksense permissionless oracle network. Our primary commitment is to ensure that real-world data is delivered in a manner that is trust-minimized, verifiable, and resistant to manipulation. The Blocksense security model is architected upon a sophisticated framework of game-theoretic incentives, cryptographic proofs, and decentralized validation to maintain the highest standards of data integrity and network reliability.

We recognize the valuable contributions of independent security researchers and consider the practice of responsible disclosure to be integral to the security and stability of the broader web3 ecosystem.

## **2\. Reporting a Security Vulnerability**

Individuals who identify a potential security vulnerability in any Blocksense repository are encouraged to report their findings to us through private channels. This practice of prompt and responsible disclosure enables our team to address and remediate the issue before it can be exploited.

We provide two primary channels for the private submission of vulnerability reports:

1. **Private GitHub Security Advisory**: The preferred method for submission is to [**file a private security advisory on GitHub**](https://github.com/blocksense-network/blocksense/security/advisories/new). This channel facilitates efficient tracking, collaboration, and communication.
2. **Dedicated Security Email**: As an alternative, detailed reports may be transmitted to our security operations team at: security@blocksense.network.

### **2.1. Contents of a Vulnerability Report**

To facilitate timely and effective triage and validation of a finding, we request that all reports include the following information:

- **Vulnerability Classification**: The specific type of vulnerability (e.g., Re-entrancy, Oracle Manipulation, Cross-Site Scripting).
- **Detailed Description**: A comprehensive explanation of the vulnerability, its mechanism, and its potential impact.
- **Vulnerability Location**: Precise identification of the affected component, including the repository, smart contract, file, and relevant line numbers (if applicable).
- **Reproduction Steps**: A detailed, step-by-step proof-of-concept (PoC) that demonstrates the vulnerability.
- **Supplementary Information**: Any additional relevant details, including potential mitigation strategies.

### **2.2. Our Commitment to Researchers**

Upon the responsible disclosure of a vulnerability, Blocksense commits to the following actions:

- Acknowledge receipt of your report — typically within 48 hours.
- Maintain open communication regarding the status of our investigation and remediation efforts.
- Provide public attribution for your contribution after a patch is deployed, if you wish.

We ask that all researchers act in good faith and refrain from actions that could negatively impact Blocksense, its users, or its systems. This includes abstaining from public disclosure until our team has had a reasonable opportunity to address the report.

## **3\. Security Guidance for Developers**

To promote the security of applications that integrate with the Blocksense network, we advise developers to adhere to the following best practices:

- **On-Chain Data Verification**: Always implement on-chain verification of oracle data before it is used to execute critical smart contract logic.
- **Source Redundancy**: Utilize multiple data sources and oracles where feasible to mitigate risks associated with a single point of failure.
- **Secure Development Practices**: Follow established standards for secure smart contract development, such as the Checks-Effects-Interactions pattern, during the integration of the Blocksense SDK.
- **Monitor for Updates**: Remain informed of the latest security advisories, patches, and protocol improvements by monitoring our official communication channels.

Blocksense is fundamentally dedicated to a process of continuous security enhancement. The collaborative efforts of the security community are invaluable in our mission to engineer the most robust and secure oracle infrastructure for the decentralized web.
