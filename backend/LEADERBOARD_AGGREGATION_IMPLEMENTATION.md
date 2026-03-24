# Leaderboard Aggregation Implementation

## Overview
Implemented a comprehensive leaderboard aggregation system that combines on-chain and off-chain data to provide real-time user statistics and rankings for frontend consumption.

## Features Implemented

### ✅ Service Consumes

**On-Chain Staking Events**:
- `LeaderboardAggregationService.processOnChainStakingEvents()` processes blockchain staking events
- `LeaderboardSyncService.syncOnChainStakingEvents()` runs every 5 minutes via cron
- Handles stake creation, rewards, and unstaking events

**Off-Chain Bet Settlements**:
- `LeaderboardAggregationService.processOffChainBetSettlements()` processes bet settlements
- `LeaderboardSyncService.syncOffChainBetSettlements()` runs every 2 minutes via cron
- Handles wins, losses, and payout calculations

**User Statistics**:
- Combines data from multiple sources for comprehensive user profiles
- Real-time updates via WebSocket connections
- Historical data tracking for trend analysis

### ✅ UserLeaderboardStats Table

**Comprehensive User Data**:
```typescript
interface UserLeaderboardStats {
  // Basic Stats
  totalBets: number;
  betsWon: number;
  betsLost: number;
  totalWinnings: number;
  totalStaked: number;
  totalStakingRewards: number;
  activeStakes: number;
  
  // Derived Metrics
  bettingAccuracy: number;
  winningStreak: number;
  highestWinningStreak: number;
  netEarnings: number;
  bestPredictor: number;
  roi: number;
  
  // Activity Tracking
  lastBetAt: Date;
  lastStakeAt: Date;
}
```

### ✅ Derived Metrics Calculated

**Winning Streak**:
- Tracks consecutive wins
- Updates on each settlement
- Maintains highest streak achieved

**Best Predictor**:
- Weighted score combining accuracy (70%) and volume (30%)
- Normalized volume scoring
- Updated on each bet settlement

**Net Earnings**:
- Total winnings minus total losses
- Real-time calculation
- Used for primary ranking

### ✅ Real-Time Updates

**Event Listeners**:
- `LeaderboardGateway` handles WebSocket connections
- Live updates for bet placements, settlements, and staking
- Broadcasts to all connected clients

**Cron Jobs**:
- Every 2 minutes: Sync off-chain bet settlements
- Every 5 minutes: Sync on-chain staking events  
- Every hour: Calculate derived metrics
- Daily at 2 AM: Cleanup and optimization

### ✅ REST/GraphQL API Methods

**User Stats Endpoints**:
- `GET /leaderboard/user/:userId` - Get comprehensive user stats
- `GET /leaderboard/rank/:userId/:metric` - Get user ranking
- `GET /leaderboard/trends/:userId` - Get historical trends

**Leaderboard Endpoints**:
- `GET /leaderboard/top` - Get top users by various metrics
- `GET /leaderboard/summary` - Get system-wide statistics
- `GET /leaderboard/search` - Search users by name/email

**Real-Time Endpoints**:
- WebSocket `/leaderboard` - Live updates and notifications
- Subscribe to specific user stats or global leaderboard

## Architecture

### Core Services

**LeaderboardAggregationService**:
- Main business logic for data aggregation
- Combines on-chain and off-chain data
- Calculates derived metrics
- Handles real-time updates

**LeaderboardSyncService**:
- Scheduled data synchronization
- Event processing from blockchain and off-chain sources
- Performance optimization and cleanup

**LeaderboardGateway**:
- WebSocket gateway for real-time communication
- Live leaderboard updates
- Client subscription management

### Data Flow

1. **Event Collection**: On-chain and off-chain events collected
2. **Aggregation**: Data combined and metrics calculated
3. **Storage**: Results stored in UserLeaderboardStats table
4. **Distribution**: Available via REST APIs and WebSocket
5. **Real-Time**: Live updates pushed to connected clients

## API Usage Examples

### Get User Stats
```typescript
GET /leaderboard/user/123e4567-e89b-12d3-a456-426614174000
```

### Get Top Leaderboard
```typescript
GET /leaderboard/top?limit=50&orderBy=netEarnings
```

### Get User Ranking
```typescript
GET /leaderboard/rank/123e4567-e89b-12d3-a456-426614174000/bestPredictor
```

### WebSocket Connection
```typescript
const ws = new WebSocket('ws://localhost:3000/leaderboard');
ws.send(JSON.stringify({
  type: 'subscribe',
  data: { type: 'user-stats', userId: '123e4567...' }
}));
```

## Performance Features

### Gas Efficiency
- Batch processing of events
- Optimized database queries with indexes
- Materialized views for common queries

### Real-Time Performance
- WebSocket connections for instant updates
- Efficient data structures
- Minimal database round trips

### Scalability
- Horizontal scaling support via WebSocket clustering
- Database connection pooling
- Event-driven architecture

## Monitoring & Health

### Sync Status
```typescript
GET /leaderboard/stats
```
Returns sync service health and last sync times.

### Error Handling
- Comprehensive error logging
- Graceful degradation on service failures
- Automatic retry mechanisms

## Future Enhancements

### Advanced Analytics
- Machine learning for trend prediction
- Advanced risk-adjusted metrics
- Behavioral pattern analysis

### Performance Optimization
- Redis caching for frequently accessed data
- Database query optimization
- CDN integration for global distribution

## Integration Points

### Blockchain Integration
- Event listeners for staking contracts
- Real-time blockchain data fetching
- Transaction monitoring

### Off-Chain Integration
- Bet processing systems
- External data sources
- Third-party analytics providers

This implementation provides a robust foundation for leaderboard functionality with real-time updates, comprehensive metrics, and scalable architecture suitable for production use.
