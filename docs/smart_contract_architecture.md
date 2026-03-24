# Smart Contract Architecture

## Overview

This document describes the architecture of Renaissance’s Soroban smart contract system. It explains:

- Contract structure and responsibilities
- Storage layout patterns
- Event emission standards
- Security and access control model
- Upgrade strategy
- Backend ↔ contract interaction flow

This documentation serves as the canonical reference for contributors working on smart contracts and backend integrations.

---

# 1. Contract System Overview

Renaissance uses Soroban smart contracts deployed on the Stellar network. Contracts are modular and follow a separation-of-concerns architecture.

## Core Contracts

### 1. Token Contract

Responsible for:

- Fungible token logic
- Minting and burning (if enabled)
- Transfers between accounts
- Balance tracking

### 2. NFT / Asset Contract (if applicable)

Responsible for:

- Minting unique assets
- Ownership tracking
- Metadata storage
- Transfer logic

### 3. Governance / Admin Contract

Responsible for:

- Role-based access control
- Administrative actions
- Contract configuration

### 4. Application Logic Contract

Responsible for:

- Business-specific rules
- Reward distribution
- Game logic (if applicable)
- Commit-reveal mechanisms (if used)

Each contract is deployed independently and interacts via defined interfaces.

---

# 2. Storage Layout Patterns

Soroban uses key-value storage. Renaissance follows structured and predictable storage patterns.

## Storage Key Design

Storage keys use strongly typed enums to prevent collisions.

Example pattern:

```rust
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Balance(Address),
    Allowance(Address, Address),
    Proposal(u64),
    Commit(Address),
}
```

### Principles

- Use enums instead of raw symbols
- Keep keys deterministic
- Avoid overlapping storage domains
- Separate user storage from global config storage

---

## Balance Storage Pattern

Balances are stored as:

```
DataKey::Balance(user_address)
```

Value:

```
u128
```

---

## Allowance Pattern (if ERC20-like logic exists)

```
DataKey::Allowance(owner, spender)
```

Value:

```
u128
```

---

## Global Configuration

Global config such as admin or contract parameters:

```
DataKey::Admin
```

Value:

```
Address
```

---

# 3. Event Emission Standards

All contracts emit structured and predictable events.

## Event Naming Convention

Format:

```
<ContractName>::<EventName>
```

Examples:

- Token::Transfer
- Token::Mint
- Governance::RoleGranted
- Game::CommitSubmitted

---

## Event Structure Pattern

Example transfer event:

```rust
env.events().publish(
    (symbol_short!("transfer"), from, to),
    amount
);
```

### Event Rules

- Always include indexed identifiers (addresses, IDs)
- Keep payload concise
- Emit events for state-changing operations only
- Never emit misleading or redundant events

---

# 4. Security Model

Security is enforced through strict validation and role-based access control.

## Role-Based Access Control (RBAC)

Roles are stored in contract storage.

Example:

```
DataKey::Admin
```

Only admin can:

- Mint tokens (if mintable)
- Upgrade contract
- Change configuration

### Access Check Pattern

```rust
fn require_admin(env: &Env, caller: Address) {
    let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
    if caller != admin {
        panic!("Unauthorized");
    }
}
```

---

## Input Validation Rules

- Validate caller authorization
- Validate non-zero amounts
- Prevent overflow using safe math
- Prevent replay attacks
- Ensure commit-reveal timing correctness

---

# 5. Commit-Reveal Logic (If Used)

Used to prevent front-running and manipulation.

## Phase 1: Commit

User submits:

```
hash(secret + user_address)
```

Stored as:

```
DataKey::Commit(user_address)
```

---

## Phase 2: Reveal

User submits original secret.

Contract:

1. Recomputes hash
2. Compares to stored commit
3. Executes logic if valid
4. Deletes commit entry

---

## Security Properties

- Prevents early disclosure
- Prevents front-running
- Enforces single-use commits

---

# 6. Upgrade Strategy

Contracts follow a controlled upgrade pattern.

## Upgrade Principles

- Only admin can upgrade
- Upgrade authority stored securely
- Upgrades announced before execution
- Migrations handled carefully

---

## Upgrade Process

1. Deploy new contract version
2. Migrate necessary storage (if required)
3. Update contract reference in backend
4. Disable old contract if applicable

---

## Storage Compatibility Rules

- Never change existing storage keys without migration
- Append new keys instead of modifying old ones
- Maintain backward compatibility

---

# 7. Backend ↔ Contract Interaction Flow

## Interaction Architecture

Backend interacts with contracts via Soroban RPC.

Flow:

1. Backend constructs transaction
2. Signs transaction (server or user wallet)
3. Submits to Soroban network
4. Waits for confirmation
5. Parses emitted events
6. Updates backend database

---

## Read Operations

Backend calls:

- contract.invoke()
- simulation endpoints

Used for:

- Balance checks
- State queries
- Commit verification

---

## Write Operations

Backend:

1. Builds transaction
2. Signs with proper authority
3. Submits to network
4. Listens for events

State is considered final only after confirmation.

---

# 8. Gas and Optimization Strategy

- Minimize storage writes
- Avoid unnecessary event emissions
- Use compact data structures
- Avoid large loops in contract execution

---

# 9. Development Guidelines

- One responsibility per contract
- Explicit error messages
- Strict access validation
- No hidden state mutations
- Always emit events for critical state changes

---

# 10. Testing Strategy

Each contract must include:

- Unit tests
- Authorization tests
- Edge-case tests
- Commit-reveal timing tests (if used)
- Upgrade simulation tests

---

# Summary

The Renaissance Soroban architecture is designed to be:

- Modular
- Secure
- Upgradeable
- Event-driven
- Backend-integrated

By following these architectural principles, the system maintains predictable behavior, strong security guarantees, and clean backend integration.
