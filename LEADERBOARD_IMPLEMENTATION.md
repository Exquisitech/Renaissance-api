# Leaderboard Event-Driven System Implementation

## Overview
This document describes the event-driven leaderboard system implemented to keep leaderboard stats in sync with betting and staking activity. The system ensures atomic updates and proper calculation of user statistics.

## Architecture

### Domain Events
Events are emitted when significant actions occur and consumed by the LeaderboardService to update statistics atomically.

#### 1. **BetPlacedEvent**
- **File**: `src/leaderboard/domain/events/bet-placed.event.ts`
- **Purpose**: Tracks bet placement activity
- **Emitted by**: `BetsService.placeBet()`
- **Properties**:
  - `userId`: User placing the bet
  - `matchId`: Match being bet on
  - `stakeAmount`: Amount staked
  - `predictedOutcome`: Predicted match outcome
  - `timestamp`: Event creation time

#### 2. **BetSettledEvent**
- **File**: `src/leaderboard/domain/events/bet-settled.event.ts`
- **Purpose**: Updates betting stats when a bet resolves
- **Emitted by**: `BetsService.settleMatchBets()`
- **Properties**:
  - `userId`: User who placed the bet
  - `betId`: Bet identifier
  - `matchId`: Associated match
  - `isWin`: Whether the bet won
  - `stakeAmount`: Original stake
  - `winningsAmount`: Payout if won
  - `accuracy`: Betting accuracy (calculated by leaderboard)
  - `timestamp`: Settlement time

#### 3. **StakeCreditedEvent**
- **File**: `src/leaderboard/domain/events/stake-credited.event.ts`
- **Purpose**: Tracks staking rewards
- **Emitted by**: `StakingService.claimRewards()`
- **Properties**:
  - `userId`: User claiming rewards
  - `stakedAmount`: Original staked amount
  - `rewardAmount`: Earned rewards
  - `timestamp`: Claim time

#### 4. **StakeDebitedEvent**
- **File**: `src/leaderboard/domain/events/stake-debited.event.ts`
- **Purpose**: Tracks staking debit events (locking or unstaking)
- **Emitted by**: `StakingService.stakeTokens()`
- **Properties**:
  - `userId`: User staking
  - `stakedAmount`: Amount locked
  - `reason`: 'stake' or 'unstake'
  - `timestamp`: Debit time

### Entities

#### Leaderboard Entity
- **File**: `src/leaderboard/entities/leaderboard.entity.ts`
- **Table**: `leaderboards`
- **One-to-One**: User (cascade delete)
- **Indexes**: userId (unique), totalWinnings, bettingAccuracy, winningStreak

**Betting Statistics**:
- `totalBets`: Total number of bets placed
- `betsWon`: Successful bets
- `betsLost`: Failed bets
- `totalWinnings`: Total amount won
- `bettingAccuracy`: Win percentage (0-100)
- `winningStreak`: Current consecutive wins
- `highestWinningStreak`: Peak streak achieved

**Staking Statistics**:
- `totalStaked`: Cumulative amount staked
- `totalStakingRewards`: Total rewards earned
- `activeStakes`: Currently locked stake amount

**Activity Tracking**:
- `lastBetAt`: Timestamp of last bet
- `lastStakeAt`: Timestamp of last stake transaction

### Services

#### LeaderboardService
- **File**: `src/leaderboard/leaderboard.service.ts`
- **Purpose**: Handles all leaderboard state updates

**Key Methods**:
- `ensureLeaderboardExists(userId)`: Creates leaderboard entry if missing
- `handleBetPlaced(event)`: Updates lastBetAt timestamp
- `handleBetSettled(event)`: **Atomic** update of win/loss stats and accuracy
- `handleStakeCredited(event)`: **Atomic** reward tracking
- `handleStakeDebited(event)`: **Atomic** debit tracking
- `getLeaderboardStats(userId)`: Retrieve user's current stats
- `getTopLeaderboard(limit, orderBy)`: Top performers by metric

**Atomicity Features**:
- Uses TypeORM `DataSource.createQueryRunner()` with transactions
- Pessimistic write locks on leaderboard rows
- Automatic rollback on errors
- Ensures accuracy calculation occurs only after settlement

#### BetsService (Updated)
- **File**: `src/bets/bets.service.ts`
- **Changes**:
  - Imported `EventBus` from `@nestjs/cqrs`
  - Constructor updated to inject `EventBus`
  - `placeBet()`: Emits `BetPlacedEvent` after transaction commit
  - `settleMatchBets()`: Emits `BetSettledEvent` for each settled bet after transaction

#### StakingService (Updated)
- **File**: `src/staking/staking.service.ts`
- **Changes**:
  - Imported `EventBus` from `@nestjs/cqrs`
  - Constructor updated to inject `EventBus`
  - `stakeTokens()`: Emits `StakeDebitedEvent` after transaction
  - `claimRewards()`: Emits `StakeCreditedEvent` after transaction

### Event Handlers

Located in `src/leaderboard/listeners/`:

1. **BetPlacedEventHandler** (`bet-placed.listener.ts`)
   - Implements `IEventHandler<BetPlacedEvent>`
   - Decorated with `@EventsHandler(BetPlacedEvent)`
   - Calls `LeaderboardService.handleBetPlaced()`

2. **BetSettledEventHandler** (`bet-settled.listener.ts`)
   - Implements `IEventHandler<BetSettledEvent>`
   - Decorated with `@EventsHandler(BetSettledEvent)`
   - Calls `LeaderboardService.handleBetSettled()`
   - **Critical**: Accuracy is recalculated only on settlement

3. **StakeCreditedEventHandler** (`stake-credited.listener.ts`)
   - Implements `IEventHandler<StakeCreditedEvent>`
   - Decorated with `@EventsHandler(StakeCreditedEvent)`
   - Calls `LeaderboardService.handleStakeCredited()`

4. **StakeDebitedEventHandler** (`stake-debited.listener.ts`)
   - Implements `IEventHandler<StakeDebitedEvent>`
   - Decorated with `@EventsHandler(StakeDebitedEvent)`
   - Calls `LeaderboardService.handleStakeDebited()`

### Modules

#### LeaderboardModule
- **File**: `src/leaderboard/leaderboard.module.ts`
- Imports: `CqrsModule`, `TypeOrmModule` (Leaderboard, User)
- Providers: LeaderboardService + all event handlers
- Exports: LeaderboardService

#### StakingModule (Created)
- **File**: `src/staking/staking.module.ts`
- Imports: `CqrsModule`, `TypeOrmModule` (User, Transaction)
- Providers: StakingService
- Exports: StakingService

### Controller

#### LeaderboardController
- **File**: `src/leaderboard/leaderboard.controller.ts`
- **Endpoints**:

```
GET /leaderboards/users/:userId
- Returns current user's leaderboard stats
- Response: Leaderboard entity with all statistics

GET /leaderboards/top?limit=100&orderBy=totalWinnings
- Returns top performers
- Query params:
  - limit: Number of results (default: 100)
  - orderBy: 'totalWinnings' | 'bettingAccuracy' | 'winningStreak' (default: 'totalWinnings')
- Response: Array of Leaderboard entities
```

## Key Design Decisions

### 1. **Accuracy Recalculation on Settlement Only**
- Accuracy is **NOT** recalculated when bets are placed
- Only recalculated when `BetSettledEvent` is handled
- Formula: `(betsWon / totalBets) * 100`
- Prevents speculative accuracy predictions

### 2. **Winning Streak Logic**
- Increments with each win
- Resets to 0 on any loss
- Tracks highest streak separately
- Enables achievement-based features

### 3. **Transaction-Aware Events**
- Events emitted **AFTER** database transaction commits
- Ensures leaderboard updates never happen if main operation fails
- Prevents partial state inconsistencies

### 4. **Atomic Leaderboard Operations**
- Every leaderboard update uses:
  - `queryRunner` with explicit transaction
  - `pessimistic_write` lock on leaderboard row
  - Automatic rollback on errors
- Prevents race conditions and lost updates

### 5. **Event Bus (CQRS Pattern)**
- Decouples betting/staking logic from leaderboard updates
- Uses NestJS built-in `EventBus` from `@nestjs/cqrs`
- Handlers are automatically registered via decorators
- Enables future extensions (webhooks, notifications, etc.)

## Integration Points

### BetsModule
```typescript
imports: [CqrsModule, TypeOrmModule.forFeature([Bet, Match])],
```
- Added `CqrsModule` for event bus support

### StakingModule
```typescript
imports: [CqrsModule, TypeOrmModule.forFeature([User, Transaction])],
```
- Created new module with CQRS support

### AppModule
```typescript
imports: [
  // ... existing imports
  StakingModule,
  LeaderboardModule,
]
```
- Added both modules to global imports

## Event Flow

### Bet Placement Flow
```
User → placeBet() → Wallet deduction
                 → Bet creation
                 → Transaction commit
                 → Emit BetPlacedEvent
                 → BetPlacedEventHandler → LeaderboardService.handleBetPlaced()
                 → Update lastBetAt
```

### Bet Settlement Flow
```
Admin/System → settleMatchBets()
            → Wallet credit (for winners)
            → Update bet status
            → Transaction commit
            → For each bet: Emit BetSettledEvent
            → BetSettledEventHandler → LeaderboardService.handleBetSettled()
            → Update stats + accuracy + streak
```

### Staking Flow
```
User → stakeTokens() → Wallet deduction
                    → Transaction creation
                    → Transaction commit
                    → Emit StakeDebitedEvent
                    → StakeDebitedEventHandler → LeaderboardService.handleStakeDebited()
                    → Update activeStakes

User → claimRewards() → Wallet credit
                     → Reward transaction
                     → Transaction commit
                     → Emit StakeCreditedEvent
                     → StakeCreditedEventHandler → LeaderboardService.handleStakeCredited()
                     → Update totalStakingRewards
```

## Testing Considerations

### Unit Tests
- Test Leaderboard entity methods: `recalculateAccuracy()`, `updateWinningStreak()`
- Test event handlers in isolation
- Mock LeaderboardService for service tests

### Integration Tests
- Test complete flows: bet → settlement → leaderboard update
- Test concurrent bets settling simultaneously
- Test transaction rollback scenarios
- Verify accuracy calculations are correct
- Verify streak logic with multiple wins/losses

### E2E Tests
- Complete user journey from bet placement to leaderboard appearance
- Test leaderboard endpoints return correct data
- Test ordering by different metrics

## Performance Considerations

1. **Indexes**: Added on frequently queried columns:
   - userId (unique for fast lookups)
   - totalWinnings (for sorting)
   - bettingAccuracy (for filtering)
   - winningStreak (for sorting)

2. **Lock Contention**: Pessimistic locks minimize during leaderboard updates (milliseconds)

3. **Event Processing**: Asynchronous after transaction commits, non-blocking

## Future Enhancements

1. **Achievements System**: Unlock badges based on streaks, accuracy, winnings
2. **Notifications**: Emit events for webhooks/email on top-10 changes
3. **Historical Stats**: Archive leaderboard snapshots for trend analysis
4. **Suspicion Detection**: Flag unusual winning patterns
5. **Multi-leaderboard**: Seasonal/weekly leaderboards with separate entities
6. **Reward Distribution**: Auto-calculate prize pools based on top rankings

## Migration Notes

When deploying to production:

1. Create `leaderboards` table migration:
```sql
CREATE TABLE leaderboards (
  id UUID PRIMARY KEY,
  userId UUID UNIQUE NOT NULL,
  totalBets INT DEFAULT 0,
  betsWon INT DEFAULT 0,
  betsLost INT DEFAULT 0,
  totalWinnings DECIMAL(10,2) DEFAULT 0,
  bettingAccuracy DECIMAL(5,2) DEFAULT 0,
  winningStreak INT DEFAULT 0,
  highestWinningStreak INT DEFAULT 0,
  totalStaked DECIMAL(10,2) DEFAULT 0,
  totalStakingRewards DECIMAL(10,2) DEFAULT 0,
  activeStakes DECIMAL(10,2) DEFAULT 0,
  lastBetAt TIMESTAMP NULL,
  lastStakeAt TIMESTAMP NULL,
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_leaderboard_userId ON leaderboards(userId);
CREATE INDEX idx_leaderboard_totalWinnings ON leaderboards(totalWinnings);
CREATE INDEX idx_leaderboard_bettingAccuracy ON leaderboards(bettingAccuracy);
CREATE INDEX idx_leaderboard_winningStreak ON leaderboards(winningStreak);
```

2. Optionally populate historical leaderboards:
```sql
INSERT INTO leaderboards (id, userId)
SELECT uuid_generate_v4(), id FROM users;
```

3. Deploy modules in order:
   - StakingModule (dependency of StakingService)
   - LeaderboardModule (depends on nothing new)
   - BetsModule (already updated)
   - AppModule (updated to include all)

## Troubleshooting

### Leaderboard not updating
- Verify LeaderboardModule is imported in AppModule
- Check event handlers are registered (should see in logs)
- Verify database connection is working
- Check transaction logs for rollbacks

### Accuracy not changing after bet settlement
- Expected if no settlement yet (only calculated on BetSettledEvent)
- Verify BetSettledEventHandler is registered
- Check LeaderboardService logs for errors

### Winning streak reset unexpectedly
- Check that losses are properly marked in bet settlement
- Verify updateWinningStreak() logic in entity

## Support

For questions about the implementation, refer to:
- Event definitions: `src/leaderboard/domain/events/`
- Service logic: `src/leaderboard/leaderboard.service.ts`
- Integration points: `src/bets/bets.service.ts`, `src/staking/staking.service.ts`
