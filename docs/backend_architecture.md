# Backend Architecture Documentation

## Overview

This document describes the NestJS backend architecture, including:

- Module structure
- Guards and interceptors
- Transaction management strategy
- Event listener system
- Smart contract integration
- Leaderboard aggregation flow
- Soft delete and audit logging behavior

The backend follows a modular, domain-driven structure with strong transactional guarantees for all financial operations.

---

# 1. High-Level Architecture

The backend is built using NestJS with:

- Modular architecture
- TypeORM for database access
- PostgreSQL as primary database
- Event-driven internal flows
- Smart contract integration layer

Core principles:

- Separation of concerns
- Transactional integrity
- Event-driven updates
- Auditability
- Scalability

---

# 2. Module Structure

Each domain is encapsulated in its own NestJS module.

## Core Modules

### 1. Auth Module

Responsibilities:

- User authentication
- JWT issuance and validation
- Role-based access enforcement

### 2. Users Module

Responsibilities:

- User profile management
- Reputation updates
- Soft delete handling

### 3. Matches Module

Responsibilities:

- Match creation
- Match lifecycle updates
- Result finalization

### 4. Bets Module

Responsibilities:

- Bet placement
- Bet validation
- Bet settlement

### 5. Staking Module

Responsibilities:

- Stake creation
- Reward accrual
- Unstaking

### 6. Spin Module

Responsibilities:

- Spin session lifecycle
- Commit-reveal validation (if enabled)
- Reward assignment

### 7. NFT Module

Responsibilities:

- NFT player card metadata
- On-chain ownership sync

### 8. Leaderboard Module

Responsibilities:

- Aggregating statistics
- Ranking calculations
- Caching optimized leaderboard views

### 9. Smart Contract Integration Module

Responsibilities:

- Contract invocation
- Transaction submission
- Event parsing
- On-chain sync

---

# 3. Guards & Interceptors

## Guards

Guards enforce authentication and authorization.

### JWT Auth Guard

- Validates JWT
- Attaches user to request context

### Roles Guard

- Enforces role-based access
- Compares user.role against route metadata

---

## Interceptors

### Logging Interceptor

- Logs request/response metadata
- Tracks execution time

### Transaction Interceptor (Optional Pattern)

- Wraps handler in database transaction
- Commits on success
- Rolls back on exception

### Response Transformation Interceptor

- Standardizes API response format

---

# 4. Transaction Management

Financial operations must be atomic.

## Strategy

TypeORM transactions are used via:

- QueryRunner
- DataSource.transaction()

---

## Example: Place Bet Transaction

Inside a single transaction:

1. Validate match status
2. Validate user balance
3. Deduct balance
4. Create bet record
5. Commit transaction

If any step fails → rollback.

---

## Example: Settle Bet Transaction

1. Validate match result
2. Update bet status
3. Credit payout (if won)
4. Emit internal event
5. Commit transaction

All operations are atomic.

---

# 5. Event Listener System

The backend uses an internal event-driven pattern.

## Event Emission

Events emitted after transactional success:

- BetPlacedEvent
- BetSettledEvent
- SpinCompletedEvent
- StakeUpdatedEvent

---

## Event Listeners

Listeners handle:

- Leaderboard updates
- Notification dispatch
- Audit logging
- Cache invalidation

Events are emitted only after successful transaction commit to prevent inconsistent state.

---

# 6. Smart Contract Integration

The Smart Contract module handles:

- RPC communication
- Transaction construction
- Signing
- Event parsing

---

## Write Flow

1. Backend builds contract invocation
2. Transaction signed (server or user wallet)
3. Submitted to blockchain network
4. Confirmation awaited
5. Events parsed
6. Database updated accordingly

---

## Read Flow

Used for:

- Balance verification
- NFT ownership checks
- Commit validation

Simulated calls used when no state mutation required.

---

# 7. Leaderboard Aggregation Flow

Leaderboard is updated via event-driven aggregation.

## Flow: Bet → Settlement → Leaderboard Update

1. User places bet
2. Bet stored in DB (transaction)
3. Match result finalized
4. Bet settlement transaction runs
5. BetSettledEvent emitted
6. Leaderboard listener updates:
   - totalBets
   - totalWins
   - totalLosses
   - totalWagered
   - totalEarned

7. Rank recalculated

---

## Ranking Strategy

Ranking based on:

- Total earnings
- Win rate
- Volume (tie-breaker)

Optimized queries and indexed fields ensure performance.

---

# 8. Soft Deletes & Audit Logging

## Soft Deletes

Entities using soft delete:

- Users
- Bets

Soft delete behavior:

- Uses @DeleteDateColumn()
- Excluded from default queries
- Preserves financial history

---

## Audit Logging

Audit logs record:

- Financial mutations
- Admin actions
- Role changes
- Critical state transitions

Logs include:

- Actor ID
- Action type
- Timestamp
- Before/after state (if applicable)

---

# 9. Error Handling Strategy

- Centralized exception filter
- Domain-specific errors
- Transaction rollback on all uncaught errors
- Validation errors handled before DB mutation

---

# 10. Scalability Considerations

- Modular separation allows horizontal scaling
- Read-heavy endpoints cacheable
- Leaderboard pre-aggregated
- Blockchain calls decoupled from core request cycle when possible

---

# 11. Security Model

- JWT-based authentication
- Role-based authorization
- Strict input validation
- No direct balance mutation outside transactions
- Blockchain verification where required

---

# Summary

The backend architecture is:

- Modular
- Transaction-safe
- Event-driven
- Blockchain-integrated
- Audit-friendly

All financial and ranking operations are executed within strict transaction boundaries and followed by deterministic event-driven aggregation to ensure data consistency and system reliability.
