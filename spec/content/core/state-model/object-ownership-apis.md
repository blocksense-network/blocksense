# **Blocksense SDK Documentation: Object Ownership APIs**

This document provides a technical reference for the Blocksense Noir APIs used to create and manage on-chain objects. These functions are part of the Blocksense Noir standard library and provide the low-level primitives for interacting with the network's object-centric storage model.

A solid understanding of the object model is recommended before using these APIs.

## **Defining an Object**

In Blocksense Noir, an object is a struct that has the key ability. The first field of the struct must be `id: UID`, which serves as the object's globally unique identifier on the network.

```rust
// Example of a simple object definition
struct MyObject {
    id: UID,
    value: u64,
}
```

## **Core Object Functions**

These functions are available within the `blocksense::object` module and are used for creating and managing the state of objects.

### **object::new**

Creates a new, mutable object owned by a specific address.

**Signature:**

```rust
fn new<T>(owner: Address) -> T
```

**Description:**

This function is called within a constructor or another function to instantiate a new object. The owner parameter specifies the address that will have exclusive control over the object. The newly created object is mutable by default.

**Example:**

```rust
// Creates a new MyObject owned by the transaction sender
let new_object = MyObject {
    id: object::new(context.sender()),
    value: 100,
};
```

### **object::share**

Transitions an object from an owned state to a shared state, making it accessible to multiple users.

**Signature:**

```rust
fn share<T>(object: T)
```

**Description:**

A shared object does not have a single owner and can be read or modified by anyone (subject to the program's logic). This action is **irreversible**. Once an object is shared, it cannot become owned again. Use this for objects that represent collaborative state, like a liquidity pool.

**Example:**

```rust
// Takes an owned object and makes it shared
let my_owned_object = MyObject { ... };
object::share(my_owned_object);
```

### **object::freeze**

Makes an object immutable, preventing any future modifications to its state.

**Signature:**

```rust
fn freeze<T>(object: T)
```

**Description:**

A frozen object is guaranteed to be read-only for the rest of its existence. This is useful for publishing data that should never change, such as program code modules or on-chain certificates. This action is **irreversible**.

**Example:**

```rust
// Takes an object and makes it immutable
let my_object = MyObject { ... };
object::freeze(my_object);
```

## **Transferring Objects**

These functions are available within the `blocksense::transfer` module and are used to change the ownership of objects.

### **transfer::public_transfer**

Transfers an owned object from its current owner to a new recipient address.

**Signature:**

```rust
fn public_transfer<T: key + store>(object: T, recipient: Address)
```

**Description:**

This is the standard function for transferring ownership of an object. For an object to be transferable using this function, its defining struct must have both the `key` and `store` abilities.[^1] This ensures that only objects explicitly marked as transferable can have their ownership changed.

**Example:**

```rust
// Define a transferable object
struct TransferableNFT {
    id: UID,
    metadata_url: String,
} has key, store

// In a function, transfer the NFT to a new owner
public fn transfer_nft(nft: TransferableNFT, new_owner: Address) {
    transfer::public_transfer(nft, new_owner);
}
```

## **Works Cited**

[^1]: [Sui Object Reference](https://move-book.com/reference/abilities/object/) - The Move Book, accessed July 31, 2025

[^2]: [sui-foundation/sui-object-model-workshop](https://github.com/sui-foundation/sui-object-model-workshop) - GitHub, accessed July 31, 2025
