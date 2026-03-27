# Rankings API Testing Guide

## Overview
Comprehensive leaderboard ranking and statistics endpoints with time-based filtering, pagination, and performance optimization.

## API Endpoints

### 1. Highest Earners Ranking
```
GET /rankings/highest-earners?page=1&limit=10&timeFrame=all-time
```
- **Calculation**: Net earnings (total winnings - total staked)
- **Sorting**: By net earnings DESC, then total winnings DESC
- **Time Filters**: daily, weekly, all-time
- **Pagination**: Configurable page size (1-100)

**Response:**
```json
{
  "data": [
    {
      "userId": "123e4567-e89b-12d3-a456-426614174000",
      "username": "pro_bettor",
      "email": "pro@example.com",
      "totalWinnings": 15000.50,
      "netEarnings": 12500.75,
      "roi": 125.5,
      "totalBets": 150,
      "betsWon": 95,
      "bettingAccuracy": 63.33,
      "rank": 1,
      "lastBetAt": "2024-03-15T10:30:00Z"
    }
  ],
  "total": 1000,
  "page": 1,
  "limit": 10,
  "totalPages": 100,
  "timeFrame": "all-time",
  "lastUpdated": "2024-03-15T12:00:00Z"
}
```

### 2. Biggest Stakers Ranking
```
GET /rankings/biggest-stakers?page=1&limit=10&timeFrame=all-time
```
- **Calculation**: Total staked amount + staking ROI
- **Sorting**: By total staked DESC, then staking ROI DESC
- **Filter**: Only users with totalStaked > 0
- **Time Filters**: daily, weekly, all-time

**Response:**
```json
{
  "data": [
    {
      "userId": "123e4567-e89b-12d3-a456-426614174000",
      "username": "whale_staker",
      "email": "whale@example.com",
      "totalStaked": 50000.00,
      "activeStakes": 25000.00,
      "totalStakingRewards": 7500.25,
      "stakingROI": 15.0,
      "rank": 1,
      "lastStakeAt": "2024-03-15T09:15:00Z"
    }
  ],
  "total": 500,
  "page": 1,
  "limit": 10,
  "totalPages": 50,
  "timeFrame": "all-time",
  "lastUpdated": "2024-03-15T12:00:00Z"
}
```

### 3. Best Predictors Ranking
```
GET /rankings/best-predictors?page=1&limit=10&timeFrame=all-time
```
- **Calculation**: Confidence score (accuracy + volume bonus)
- **Sorting**: By confidence DESC, then accuracy DESC, then total bets DESC
- **Filter**: Only users with totalBets >= 5
- **Confidence Formula**: 
  - If totalBets >= 10: accuracy * (1 + totalBets/100)
  - Else: accuracy * 0.5

**Response:**
```json
{
  "data": [
    {
      "userId": "123e4567-e89b-12d3-a456-426614174000",
      "username": "oracle_predictor",
      "email": "oracle@example.com",
      "bettingAccuracy": 78.5,
      "totalBets": 200,
      "betsWon": 157,
      "betsLost": 43,
      "winningStreak": 12,
      "highestWinningStreak": 25,
      "confidence": 85.35,
      "rank": 1,
      "lastBetAt": "2024-03-15T11:45:00Z"
    }
  ],
  "total": 750,
  "page": 1,
  "limit": 10,
  "totalPages": 75,
  "timeFrame": "all-time",
  "lastUpdated": "2024-03-15T12:00:00Z"
}
```

### 4. User Position Lookup
```
GET /rankings/user/:userId/:rankingType
```
- **Ranking Types**: earners, stakers, predictors
- **Returns**: Rank, value, percentile, total users
- **Percentile**: User's position relative to all users

**Response:**
```json
{
  "userId": "123e4567-e89b-12d3-a456-426614174000",
  "username": "pro_bettor",
  "rank": 15,
  "value": 8500.75,
  "percentile": 98.5,
  "totalUsers": 1000
}
```

### 5. Rankings Summary
```
GET /rankings/summary?timeFrame=all-time
```
- **Overview**: Top users and statistics for all categories
- **Metrics**: Top user, total users, averages, top 10% thresholds

**Response:**
```json
{
  "highestEarners": {
    "topUser": {
      "userId": "123e4567-e89b-12d3-a456-426614174000",
      "username": "pro_bettor",
      "totalWinnings": 15000.50
    },
    "totalUsers": 1000,
    "averageEarnings": 1250.75,
    "top10PercentThreshold": 5000.00
  },
  "biggestStakers": {
    "topUser": {
      "userId": "456e7890-f12c-34d5-b678-901234567890",
      "username": "whale_staker",
      "totalStaked": 50000.00
    },
    "totalUsers": 500,
    "averageStaked": 2500.00,
    "top10PercentThreshold": 15000.00
  },
  "bestPredictors": {
    "topUser": {
      "userId": "789e0123-d34f-56g7-c890-123456789012",
      "username": "oracle_predictor",
      "bettingAccuracy": 78.5
    },
    "totalUsers": 750,
    "averageAccuracy": 45.2,
    "top10PercentThreshold": 65.0
  },
  "timeFrame": "all-time",
  "lastUpdated": "2024-03-15T12:00:00Z"
}
```

## Features Implemented

✅ **Rankings calculate correctly** - Advanced formulas for earnings, staking, and predictions
✅ **Pagination works** - Configurable page sizes with total counts
✅ **Performance optimized** - Multi-level caching and database indexing
✅ **Filters functional** - Time-based filtering (daily/weekly/all-time)
✅ **Data accurate** - Real-time calculations with proper SQL queries

## Performance Optimizations

### 1. Database Indexing
- `totalWinnings` index for earnings queries
- `totalStaked` index for staking queries  
- `bettingAccuracy` index for prediction queries
- `userId` unique index for user lookups

### 2. Query Optimization
- Efficient SQL with calculated fields
- Proper JOIN operations
- Optimized WHERE clauses
- Result limiting and pagination

### 3. Caching Strategy
- **Search Results**: 5 minutes
- **User Positions**: 10 minutes
- **Summary Data**: 15 minutes
- **Cache Invalidation**: Manual and automatic

### 4. Time-Based Filtering
- **Daily**: Last 24 hours
- **Weekly**: Last 7 days
- **All-time**: No time restriction
- Filter applied to relevant timestamp fields

## Ranking Algorithms

### Highest Earners
```sql
netEarnings = totalWinnings - totalStaked
roi = ROUND((netEarnings / totalStaked) * 100, 2) WHEN totalStaked > 0
ORDER BY netEarnings DESC, totalWinnings DESC
```

### Biggest Stakers
```sql
stakingROI = ROUND((totalStakingRewards / totalStaked) * 100, 2)
ORDER BY totalStaked DESC, stakingROI DESC
```

### Best Predictors
```sql
confidence = 
  CASE 
    WHEN totalBets >= 10 THEN accuracy * (1 + totalBets/100)
    ELSE accuracy * 0.5
  END
ORDER BY confidence DESC, accuracy DESC, totalBets DESC
```

## Testing Commands

```bash
# Get highest earners (daily)
curl "http://localhost:3000/rankings/highest-earners?page=1&limit=5&timeFrame=daily"

# Get biggest stakers (weekly)
curl "http://localhost:3000/rankings/biggest-stakers?page=1&limit=10&timeFrame=weekly"

# Get best predictors (all-time)
curl "http://localhost:3000/rankings/best-predictors?page=1&limit=20&timeFrame=all-time"

# Get user position in earnings
curl "http://localhost:3000/rankings/user/123e4567-e89b-12d3-a456-426614174000/earners"

# Get rankings summary
curl "http://localhost:3000/rankings/summary?timeFrame=weekly"
```

## Error Handling

- **Invalid Parameters**: Validation with detailed error messages
- **User Not Found**: Returns 404 for user position lookups
- **Database Errors**: Graceful degradation with logging
- **Cache Failures**: Fallback to direct database queries

## Monitoring & Analytics

All endpoints include:
- Response time tracking
- Cache hit/miss ratios
- Query performance metrics
- Error rate monitoring
- User activity analytics

## Data Accuracy

- **Real-time Updates**: Rankings update immediately on bet/stake changes
- **Atomic Operations**: Ensure data consistency during updates
- **Validation**: Input validation and sanitization
- **Audit Trail**: Track ranking changes over time
