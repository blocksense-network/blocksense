# Blocksense Protocol Specification

This repository contains the complete technical specification for the Blocksense Protocol, designed as an executable specification with implementations in multiple languages and formal verification.

## Overview

The specification is structured as an Obsidian vault with heavy cross-linking and is automatically published as a website at [specification.blocksense.network](https://specification.blocksense.network) using Quartz v4.

## Directory Structure

```
spec/
├── README.md                           # This file
├── obsidian/                          # Obsidian vault configuration
│   ├── .obsidian/                     # Obsidian settings
│   └── templates/                     # Note templates
├── core/                              # Core protocol specifications
│   ├── consensus/                     # Consensus mechanisms
│   ├── architecture/                  # System architecture
│   ├── cryptography/                  # Cryptographic primitives
│   └── state-model/                   # State management
├── data-feeds/                        # Oracle and data feed specifications
├── networking/                        # Network layer specifications
├── economics/                         # Economic model and tokenomics
├── smart-contracts/                   # On-chain contract specifications
├── node-operations/                   # Node operator specifications
├── api/                              # API specifications
├── testing/                          # Testing specifications
├── implementation/                   # Language-specific implementations
│   ├── typescript/                   # TypeScript implementation
│   ├── rust/                         # Rust implementation with Verus
│   └── lean4/                        # Lean4 formal verification
├── schemas/                          # Global schema definitions
├── simulations/                      # Economic and performance simulations
├── governance/                       # Protocol governance
└── website/                         # Quartz website generation
    ├── quartz.config.ts             # Quartz configuration
    ├── quartz.layout.ts             # Site layout
    └── content/                     # Generated content
```

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

2. **Initialize the website generation:**

   ```bash
   cd website
   npm install
   npx quartz create
   ```

3. **Start local development server:**

   ```bash
   npx quartz build --serve
   ```

4. **Open in Obsidian (optional):**
   - Open Obsidian
   - Open the `spec/` directory as a vault
   - Install recommended plugins for better cross-linking

### Working with the Specification

- **Editing:** Use any Markdown editor or Obsidian for rich editing experience
- **Cross-linking:** Use `[[Note Name]]` syntax for internal links
- **Math:** Use LaTeX syntax `$inline$` or `$$block$$`
- **Code:** Use standard Markdown code blocks with language hints
- **Diagrams:** Use Mermaid syntax in code blocks

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
- **Location:** `implementation/typescript/`

### Rust (Verus)

- **Purpose:** Performance-critical components with light formal verification
- **Testing:** Standard Rust testing + Verus verification
- **Location:** `implementation/rust/`

### Lean4

- **Purpose:** Heavy formal verification and mathematical proofs
- **Testing:** Lean theorem proving
- **Location:** `implementation/lean4/`

## Website Features

The generated website includes:

- **Full-text search** across all specification documents
- **Interactive graph view** showing relationships between concepts
- **Wikilink support** with hover previews
- **LaTeX rendering** for mathematical expressions
- **Syntax highlighting** for code blocks
- **Mobile-responsive** design
- **Dark/light mode** support

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes following the specification structure
4. Ensure all implementations pass their respective tests
5. Update cross-links and documentation
6. Submit a pull request

## License

This specification is licensed under [LICENSE TO BE DETERMINED].

---

For detailed technical specifications, start with [[Core Architecture Overview]] or browse the [[Index]] of all specification documents.
