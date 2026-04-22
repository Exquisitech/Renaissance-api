# Analytics System

A comprehensive analytics system for tracking user behavior, platform performance, and business metrics.

## Features

### User Event Tracking
- Track user interactions across the platform
- Categorize events by type and category
- Store metadata, IP addresses, and session information
- Support for monetary values and custom metadata

### Behavior Analysis
- User engagement scoring
- Session analysis
- Event sequence tracking
- Usage pattern identification

### Performance Metrics
- Platform-wide statistics
- User activity metrics
- Prediction accuracy tracking
- Match performance analysis

### Revenue Tracking
- Bet revenue analysis
- Spin game revenue
- NFT marketplace revenue
- Transaction volume tracking

### Usage Patterns
- Hourly/daily/weekly activity patterns
- Popular features identification
- User journey analysis

## API Endpoints

### Event Tracking
```
POST /admin/analytics/events/track
```
Track a user event with metadata.

### Analytics Queries
```
GET /admin/analytics/events
GET /admin/analytics/events/usage-patterns
GET /admin/analytics/users/:userId/behavior
GET /admin/analytics/platform/metrics
```

### Business Metrics
```
GET /admin/analytics/staked
GET /admin/analytics/spin
GET /admin/analytics/popular-nfts
GET /admin/analytics/bet-settlement
GET /admin/analytics/user-engagement
GET /admin/analytics/revenue
GET /admin/analytics/performance
```

## Event Types

### Authentication
- `user_login`
- `user_register`

### Gambling
- `bet_placed`
- `bet_settled`
- `spin_played`

### NFT
- `nft_purchased`

### Predictions
- `prediction_made`

### Social
- `post_created`
- `comment_added`

### Engagement
- `achievement_unlocked`
- `page_view`
- `feature_usage`

### Wallet
- `wallet_transaction`

## Usage

### Tracking Events in Services

```typescript
import { AnalyticsTrackingService } from './analytics/providers/analytics-tracking.service';

@Injectable()
export class SomeService {
  constructor(private analyticsTracking: AnalyticsTrackingService) {}

  async someAction(userId: string) {
    // Track user action
    await this.analyticsTracking.trackBetPlaced(userId, betId, amount);

    // Perform action
    // ...
  }
}
```

### Querying Analytics

```typescript
import { AnalyticsService } from './analytics/providers/analytics.service';

@Injectable()
export class SomeController {
  constructor(private analyticsService: AnalyticsService) {}

  @Get('revenue')
  async getRevenue(@Query() dateRange: DateRangeDto) {
    return this.analyticsService.revenueAnalytics(dateRange);
  }
}
```

## Database Schema

The `analytics_events` table stores all user events with the following structure:

- `id`: UUID primary key
- `userId`: Foreign key to users table
- `eventType`: Enum of event types
- `category`: Enum of event categories
- `metadata`: JSON field for additional data
- `ipAddress`: User's IP address
- `userAgent`: Browser/device info
- `sessionId`: Session identifier
- `value`: Monetary value (if applicable)
- `currency`: Currency code (default: USD)
- `createdAt`: Timestamp

## Performance Considerations

- Events are cached for 5 minutes to reduce database load
- Indexes on userId+eventType+createdAt, eventType+createdAt, and category+createdAt
- Asynchronous event tracking to avoid blocking main operations
- Graceful error handling - analytics failures don't break core functionality

## Migration

Run the migration to create the analytics events table:

```bash
npm run migration:run
```

## Testing

Run analytics tests:

```bash
npm run test analytics
```

## Monitoring

Monitor analytics performance through:
- Event tracking success rates
- Query response times
- Database performance metrics
- Cache hit rates