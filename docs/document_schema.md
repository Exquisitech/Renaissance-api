# Database Schema Documentation

## Overview

This document provides an ERD-style overview of all TypeORM entities used in the system. It explains:

- Entity responsibilities
- Relationships between entities
- Foreign keys and constraints
- Soft delete behavior
- Transaction boundaries

The schema is designed to support betting, staking, spin rewards, NFT player cards, and leaderboard tracking.

---

# 1. Users

## Purpose

Represents all platform users including players, admins, and operators.

## Core Fields

- id (UUID, Primary Key)
- email (unique)
- username (unique)
- passwordHash
- role (enum: USER, ADMIN, etc.)
- reputation (integer, default 0)
- createdAt
- updatedAt
- deletedAt (nullable, soft delete column)

## Relationships

- One-to-Many → Bets
- One-to-Many → Staking
- One-to-Many → SpinSessions
- One-to-Many → NFTPlayerCards
- One-to-Many → FreeBetVouchers
- One-to-One / One-to-Many → LeaderboardStats

## Soft Delete Behavior

Uses `@DeleteDateColumn()`.

Soft-deleted users:

- Are excluded from default queries
- Retain historical bet and staking records
- Cannot authenticate

---

# 2. Matches

## Purpose

Represents sporting or game events available for betting.

## Core Fields

- id (UUID, Primary Key)
- homeTeam
- awayTeam
- startTime
- status (enum: SCHEDULED, LIVE, FINISHED, CANCELLED)
- result (nullable)
- createdAt
- updatedAt

## Relationships

- One-to-Many → Bets

## Notes

Matches cannot be deleted if bets exist.

---

# 3. Bets

## Purpose

Represents user wagers on matches.

## Core Fields

- id (UUID, Primary Key)
- userId (Foreign Key → Users.id)
- matchId (Foreign Key → Matches.id)
- amount (decimal)
- odds (decimal)
- potentialPayout
- status (enum: PENDING, WON, LOST, VOID)
- placedAt
- settledAt (nullable)
- deletedAt (soft delete)

## Relationships

- Many-to-One → Users
- Many-to-One → Matches

## Foreign Keys

- userId references Users(id)
- matchId references Matches(id)

Both are indexed for performance.

## Soft Delete Behavior

Soft delete used for auditability.

Historical bets are never hard deleted.

---

# 4. Staking

## Purpose

Tracks user staking activity (token staking or locked balances).

## Core Fields

- id (UUID, Primary Key)
- userId (Foreign Key → Users.id)
- amount
- rewardAccrued
- status (ACTIVE, UNSTAKED)
- startedAt
- endedAt (nullable)

## Relationships

- Many-to-One → Users

## Foreign Keys

- userId references Users(id)

---

# 5. SpinSessions

## Purpose

Tracks spin wheel or reward spin activities.

## Core Fields

- id (UUID, Primary Key)
- userId (Foreign Key → Users.id)
- wagerAmount
- rewardAmount
- outcomeType
- commitHash (nullable, if commit-reveal used)
- revealed (boolean)
- createdAt

## Relationships

- Many-to-One → Users

## Commit-Reveal Support

If enabled:

- commitHash stores preimage hash
- Reveal verifies correctness

---

# 6. NFTPlayerCards

## Purpose

Represents NFT-backed player cards owned by users.

## Core Fields

- id (UUID, Primary Key)
- userId (Foreign Key → Users.id)
- tokenId (on-chain identifier)
- metadataUri
- rarity
- mintedAt

## Relationships

- Many-to-One → Users

## Notes

On-chain ownership is authoritative.
Database mirrors ownership for fast querying.

---

# 7. LeaderboardStats

## Purpose

Aggregated performance statistics per user.

## Core Fields

- id (UUID, Primary Key)
- userId (Foreign Key → Users.id, unique)
- totalBets
- totalWins
- totalLosses
- totalWagered
- totalEarned
- rank
- updatedAt

## Relationships

- One-to-One → Users

## Foreign Keys

- userId references Users(id)
- Unique constraint ensures one stats record per user

---

# 8. FreeBetVouchers

## Purpose

Represents promotional free bets assigned to users.

## Core Fields

- id (UUID, Primary Key)
- userId (Foreign Key → Users.id)
- amount
- expiryDate
- isUsed (boolean)
- usedAt (nullable)
- createdAt

## Relationships

- Many-to-One → Users

## Foreign Keys

- userId references Users(id)

---

# 9. Entity Relationship Summary (Textual ERD)

Users (1) ────< Bets (Many)
Users (1) ────< Staking (Many)
Users (1) ────< SpinSessions (Many)
Users (1) ────< NFTPlayerCards (Many)
Users (1) ────< FreeBetVouchers (Many)
Users (1) ──── LeaderboardStats (1)
Matches (1) ────< Bets (Many)

---

# 10. Foreign Key & Index Strategy

- All foreign keys are indexed
- Cascade delete is disabled for financial entities
- Soft delete preferred for auditability
- Unique constraints applied to:
  - Users.email
  - Users.username
  - LeaderboardStats.userId

---

# 11. Soft Delete Policy

Entities using soft delete:

- Users
- Bets

Soft delete ensures:

- Audit compliance
- Historical accuracy
- Financial traceability

Hard deletes are restricted to non-critical metadata tables only.

---

# 12. Transaction Boundaries

Database transactions are used for:

- Placing bets (balance deduction + bet creation)
- Settling bets (status update + payout credit)
- Staking operations
- Spin result finalization
- Voucher redemption

## Transaction Rules

- All financial mutations occur inside a single transaction
- Partial updates are not allowed
- Rollback occurs on any failure

TypeORM `QueryRunner` or transactional decorators are used.

---

# 13. Data Integrity Rules

- Monetary values stored as decimal or integer smallest unit
- No floating-point storage for balances
- Status enums strictly validated
- Timestamps always stored in UTC

---

# Summary

The database schema is designed to be:

- Financially safe
- Audit-friendly
- Relationally consistent
- Optimized for performance
- Compatible with on-chain integrations

All entities are interconnected through explicit foreign keys and carefully managed transaction boundaries to ensure system integrity.
