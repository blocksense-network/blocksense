# Blocksense Protocol Specification

This repository contains the complete technical specification for the Blocksense Protocol, designed as an executable specification with implementations in multiple languages and formal verification.

## Overview

The specification is structured as an Obsidian vault with heavy cross-linking and is automatically published as a website at [specification.blocksense.network](https://specification.blocksense.network) using Quartz v4.

## Directory Structure

```
spec/
├── README.md                           # This file
├── package.json                        # Quartz website dependencies
├── quartz.config.ts                    # Quartz configuration
├── quartz.layout.ts                    # Site layout configuration
├── quartz/                            # Quartz build scripts
│   └── build.ts                       # Build configuration
├── content/                           # Specification content (this directory)
│   ├── README.md                      # This file
│   ├── index.md                       # Main specification index
│   ├── core/                          # Core protocol specifications
│   │   ├── overview/                  # High-level protocol overview
│   │   │   ├── blocksense-litepaper.md # Core protocol document
│   │   │   └── software-component-architecture.md # System architecture
│   │   ├── consensus/                 # Consensus mechanisms
│   │   │   ├── execution-layer/       # Execution layer design
│   │   │   ├── ordering-layer/        # Ordering layer design
│   │   │   └── intersubjective-consensus/ # Intersubjective consensus
│   │   ├── state-model/               # State management
│   │   │   ├── object-model.md        # Object-centric state model
│   │   │   ├── object-ownership-apis.md # Object ownership APIs
│   │   │   └── predictable-address-allocation.md # Address allocation
│   │   └── user-experience/           # User experience specifications
│   │       └── passkey-wallet-discovery.md # Passkey wallet standard
│   ├── oracle-system/                 # Oracle system specifications
│   │   ├── consensus/                 # Oracle consensus mechanisms
│   │   │   └── intersubjective-consensus-integration.md # Integration details
│   │   ├── sdk/                       # Oracle SDK specifications
│   │   │   ├── oracle-service-costing.md # Service costing and pricing
│   │   │   ├── oracle-service-lifecycle.md # Service lifecycle management
│   │   │   └── verifiable-computation-tee.md # TEE integration
│   │   └── architecture/              # Oracle system architecture
│   ├── services/                      # Service specifications
│   │   └── sdk/                       # Service SDK specifications
│   │       └── cli-tools.md           # CLI tool specifications
│   └── tooling/                       # Development tooling
│       └── cli.md                     # CLI tool documentation
├── obsidian/                          # Obsidian vault configuration (planned)
│   ├── .obsidian/                     # Obsidian settings
│   └── templates/                     # Note templates
├── implementation/                     # Language-specific implementations (planned)
│   ├── typescript/                    # TypeScript implementation
│   ├── rust/                          # Rust implementation with Verus
│   └── lean4/                         # Lean4 formal verification
├── schemas/                           # Global schema definitions (planned)
├── simulations/                       # Economic and performance simulations (planned)
├── governance/                        # Protocol governance (planned)
└── website/                           # Quartz website generation (planned)
    ├── quartz.config.ts               # Quartz configuration
    ├── quartz.layout.ts               # Site layout
    └── content/                       # Generated content
```

## Current Content Status

### ✅ **Completed Specifications**

#### **Core Protocol**

- **Blocksense Litepaper** - Complete protocol overview and design principles
- **Software Component Architecture** - System architecture and component design
- **Execution Layer Design** - Detailed execution layer rationale with IVC integration
- **Ordering Layer Design** - Resilient mempool and ordering mechanisms
- **Object Model** - Object-centric state architecture for parallel execution
- **Object Ownership APIs** - SDK APIs for object management
- **Predictable Address Allocation** - Deterministic address derivation
- **Passkey Wallet Discovery** - Extension-less blockchain wallet standard

#### **Oracle System**

- **Intersubjective Consensus Integration** - Integration between consensus layers
- **Oracle Service Costing** - Service pricing and cost measurement
- **Oracle Service Lifecycle** - Service lifecycle management and storage
- **Verifiable Computation with TEE** - Trusted execution environment integration

#### **Development Tools**

- **CLI Tools** - Command-line interface specifications
- **CLI Documentation** - Comprehensive CLI usage documentation

### 🚧 **Planned Future Content**

#### **Implementation Languages**

- **TypeScript Implementation** - Reference implementation and SDK
- **Rust Implementation** - Performance-critical components with Verus
- **Lean4 Verification** - Formal mathematical proofs

#### **Additional Specifications**

- **Cryptographic Primitives** - ZK proofs, MPC, and signature schemes
- **Network Layer** - P2P networking and communication protocols
- **Economic Model** - Tokenomics and incentive mechanisms
- **Smart Contracts** - On-chain contract specifications
- **Node Operations** - Node operator specifications
- **API Specifications** - REST and RPC API definitions
- **Testing Specifications** - Testing frameworks and methodologies
- **Governance** - Protocol governance and upgrade mechanisms

## Getting Started

### Prerequisites

- Nix with flakes enabled
- Node.js v22+ and npm v10.9.2+ (managed via Nix)
- Obsidian (optional, for editing)

### Setup

1. **Enter the development environment:**

   ```bash
   nix develop
   ```

2. **Enter the documentation shell:**

   ```bash
   nix develop .#docs
   ```

3. **Build the specification website:**

   ```bash
   nix build .#specification-website
   ```

4. **Start local development server:**

   ```bash
   cd spec
   npx quartz build --serve
   ```

5. **Open in Obsidian (optional):**
   - Open Obsidian
   - Open the `spec/content/` directory as a vault
   - Install recommended plugins for better cross-linking

### Working with the Specification

- **Editing:** Use any Markdown editor or Obsidian for rich editing experience
- **Cross-linking:** Use `[[Note Name]]` syntax for internal links
- **Math:** Use LaTeX syntax `$inline$` or `$$block$$`
- **Code:** Use standard Markdown code blocks with language hints
- **Diagrams:** Use Mermaid syntax in code blocks
- **Footnotes:** Use standard Markdown footnote syntax `[^1]` with `[^1]: ...` definitions

### Building and Publishing

```bash
# Build the static website
npx quartz build

# Serve locally for testing
npx quartz build --serve

# Deploy to GitHub Pages (when ready)
npx quartz sync --no-pull
```

## Implementation Languages

### TypeScript

- **Purpose:** Reference implementation and SDK
- **Testing:** Jest with comprehensive unit tests
- **Location:** `implementation/typescript/` (planned)

### Rust (Verus)

- **Purpose:** Performance-critical components with light formal verification
- **Testing:** Standard Rust testing + Verus verification
- **Location:** `implementation/rust/` (planned)

### Lean4

- **Purpose:** Heavy formal verification and mathematical proofs
- **Testing:** Lean theorem proving
- **Location:** `implementation/lean4/` (planned)

## Website Features

The generated website includes:

- **Full-text search** across all specification documents
- **Interactive graph view** showing relationships between concepts
- **Wikilink support** with hover previews
- **LaTeX rendering** for mathematical expressions
- **Syntax highlighting** for code blocks
- **Mobile-responsive** design
- **Dark/light mode** support
- **Proper footnote rendering** for academic citations

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes following the specification structure
4. Ensure all implementations pass their respective tests
5. Update cross-links and documentation
6. Submit a pull request

### Content Guidelines

- **Use proper Markdown footnotes** for citations (`[^1]` format)
- **Cross-link related documents** using `[[Document Name]]` syntax
- **Include code examples** where appropriate with proper language hints
- **Maintain consistent formatting** across all specification documents
- **Update this README** when adding new content sections

## License

This specification is licensed under [LICENSE TO BE DETERMINED].

---

For detailed technical specifications, start with [[blocksense-litepaper]] or browse the [[index]] of all specification documents.
