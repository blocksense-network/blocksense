# **Blocksense SDK Documentation: Predictable Address Allocation**

A core design goal of Blocksense is to provide a seamless and intuitive experience for both users and developers. A key part of this is moving beyond the cryptic, randomly generated addresses common in many blockchains. Predictable addresses are essential for user-friendly onboarding, enabling dApps to pre-calculate user accounts and for developers to build composable systems where program instances can reliably discover one another.

This document outlines the deterministic mechanisms Blocksense uses to create predictable addresses for both user accounts and stateful program instances.

## **1\. Onboarding Users with Predictable Addresses**

In Blocksense, a user's account is a programmable user object. The address of this object is not random; it is deterministically derived from the inputs used to create it.

### **1.1. The create_user Operation**

The fundamental operation for creating a new account is `create_user`. Its signature is:

```rust
create_user(validity_window, identity_service, public_bytes, authorization_data, salt)
```

The public address of the resulting user object is a cryptographic hash derived from a combination of these inputs:

- `identity_service`: The address of the initial Identity Service that will manage the account.
- `public_bytes`: The public data (e.g., a public key) associated with the user for this initial service.
- `authorization_data`: The proof that the user has authorized this creation via the `identity_service`.
- `salt`: A user-provided nonce to ensure uniqueness.

Because the output address is a deterministic function of these inputs, anyone can pre-calculate a user's address before the `create_user` transaction is ever submitted to the network.

### **1.2. The Bootstrapping Pattern for User-Friendly Onboarding**

While the `create_user` operation is deterministic, a user's ultimate `IdentityService` might be complex or based on personal credentials (like a Passkey) that are not known in advance. To solve this, Blocksense enables a powerful **bootstrapping pattern** that combines predictability with flexibility.

This is a two-step process:

1. **Initial Creation with a Bootstrapper:** A dApp or user initiates the process by calling `create_user` with a well-known, public **bootstrapping IdentityService**. This is a simple, often permissionless, service whose address is constant. By using this known service and a predictable salt (e.g., derived from the user's email or social handle), the dApp can generate a predictable address for the new user. This `create_user` transaction can be sponsored by the dApp, providing a completely frictionless onboarding experience where the user is not required to hold any tokens.
2. **Immediate Security Upgrade:** The newly created user object is now live on the network at its predictable address. In the very next step, the user calls `change_identity_service`. This operation allows them to switch control of their account from the generic bootstrapping service to their own desired `IdentityService` (e.g., one that is controlled by their device's Passkey).

This pattern provides the best of both worlds: the user gets a predictable, human-friendly address that can be shared easily, while immediately upgrading to a high-security, personalized account manager without ever being locked into the initial bootstrapping service.

## **2\. Deploying Programs with Predictable Addresses**

A similar deterministic approach applies to deploying Objective Programs (ZK circuits). The process involves two distinct phases: deploying the immutable code and then creating a stateful instance of it.

### **2.1. Deploying a Module**

First, the immutable program logic is deployed to the network using the `deploy_module` operation:

```rust
deploy_module(program_bytes)
```

This operation creates a frozen, system-owned object containing the compiled program bytecode. The address of this module is simply the cryptographic hash of the `program_bytes`. This ensures that identical code always results in the same on-chain module address, making program logic verifiable and content-addressable.

### **2.2. Creating a Program Instance**

Once a module is deployed, developers can create stateful, mutable instances of it using the `create_instance` operation:

```rust
create_instance(module_address, salt)
```

The address of the new program instance is deterministically derived from a combination of three inputs:

1. The address of the **caller** of the `create_instance` function.
2. The `module_address` of the program code being instantiated.
3. A developer-provided `salt` for uniqueness.

This mechanism allows developers to predictably calculate the addresses of smart contracts before they are deployed. This is crucial for building complex, multi-contract systems where contracts need to know each other's addresses at the time of deployment to function correctly. For example, a token contract can be deployed with the pre-calculated address of its corresponding liquidity pool, ensuring they are correctly linked from genesis.
