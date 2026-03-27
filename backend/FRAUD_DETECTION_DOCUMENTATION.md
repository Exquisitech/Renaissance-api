# Enhanced Fraud Detection Module

## Overview
The fraud detection module has been enhanced with advanced pattern recognition capabilities to detect and prevent fraudulent activities across the platform.

## Features Implemented

### 1. Multi-Account Detection
**Purpose**: Detect users creating multiple accounts to gain unfair advantages.

**Detection Methods**:
- **Same IP Detection**: Flags when >3 accounts access from the same IP address
- **Same Device Detection**: Critical alert when multiple accounts use the same device ID

**Risk Levels**:
- Same IP: HIGH
- Same Device: CRITICAL

**Integration Point**:
```typescript
// In auth/login flow
await fraudService.checkLogin(userId, ipAddress, deviceId);
```

### 2. Collusion Detection
**Purpose**: Identify users coordinating bets to manipulate outcomes.

**Detection Methods**:
- Monitors bets on same match within 30-minute windows
- Flags coordinated betting patterns with similar amounts
- Detects groups of users betting in coordination

**Threshold**: ≥3 coordinated bets triggers alert

**Risk Level**: HIGH

### 3. Unusual Betting Pattern Detection
**Purpose**: Identify abnormal betting behavior that may indicate fraud.

**Detection Methods**:
- **Sudden Large Bets**: Bets >5x user's average bet size
- **Abnormal Increase**: Progressive bet increases (3+ consecutive increases)
- **Pattern Anomaly**: Statistical deviations from normal behavior

**Risk Levels**:
- Sudden Large Bet: MEDIUM
- Abnormal Increase: MEDIUM

### 4. Time-Based Anomaly Detection
**Purpose**: Detect suspicious activity based on timing patterns.

**Detection Methods**:
- **Unusual Hours**: High activity during 2 AM - 5 AM
- **Rapid Succession**: Bets placed <2 seconds apart
- **High Frequency**: >10 activities per hour during unusual hours

**Risk Levels**:
- Unusual Time Activity: LOW
- Rapid Succession: MEDIUM

### 5. Suspicious Transaction Flagging
**Purpose**: Monitor financial transactions for money laundering indicators.

**Detection Methods**:
- **Large Transactions**: Transactions >80% of wallet balance AND >$500
- **Structuring**: Multiple transactions just below $1000 threshold (≥3 in 24h)
- **Money Laundering Red Flags**: Complex transaction patterns

**Risk Levels**:
- Suspicious Transaction: HIGH
- Structuring: CRITICAL
- Money Laundering: CRITICAL

### 6. Existing Detections (Enhanced)
- **Rapid Spin**: >20 spins in 10 seconds
- **High Frequency Betting**: >50 bets in 30 seconds
- **Win Streak**: ≥10 consecutive wins

## Risk Level Framework

| Level | Auto-Restrict | Admin Notification | Description |
|-------|---------------|---------------------|-------------|
| LOW | No | No | Minor anomalies, informational only |
| MEDIUM | No | No | Notable patterns, may need review |
| HIGH | Yes | Yes | Serious concerns, immediate action |
| CRITICAL | Yes | Yes | Severe threats, urgent intervention |

## Database Schema Changes

### New Fields in `fraud_logs` Table:
- `riskLevel`: Enum (LOW, MEDIUM, HIGH, CRITICAL)
- Additional indexes for performance

### New Migration:
```bash
npm run typeorm -- migration:run
```

## API Endpoints

### Admin Fraud Management

#### Generate Fraud Report
```http
GET /admin/fraud/report?startDate=2024-01-01&endDate=2024-01-31
Authorization: Bearer <admin-jwt>
```

**Response**:
```json
{
  "summary": {
    "totalIncidents": 45,
    "byRiskLevel": {
      "low": 10,
      "medium": 20,
      "high": 10,
      "critical": 5
    },
    "byStatus": {
      "flagged": 30,
      "underReview": 10,
      "restricted": 5,
      "cleared": 0
    },
    "byReason": {
      "SUDDEN_LARGE_BET": 15,
      "COLLUSION_SUSPECTED": 5,
      ...
    }
  },
  "incidents": [...],
  "topOffenders": [...],
  "period": {
    "start": "2024-01-01T00:00:00.000Z",
    "end": "2024-01-31T23:59:59.999Z"
  }
}
```

#### Get Suspicious Users
```http
GET /admin/fraud/suspicious-users
Authorization: Bearer <admin-jwt>
```

#### Mark User for Review
```http
POST /admin/fraud/users/:id/review
Authorization: Bearer <admin-jwt>
```

#### Clear Fraud Flags
```http
POST /admin/fraud/users/:id/clear
Authorization: Bearer <admin-jwt>
```

#### Get Fraud Metrics
```http
GET /admin/fraud/metrics
Authorization: Bearer <admin-jwt>
```

## Integration Points

### 1. Authentication Flow
```typescript
// In login controller
await this.fraudService.checkLogin(userId, ipAddress, deviceId);
```

### 2. Bet Placement
```typescript
// In bet service
await this.fraudService.checkBetActivity(userId, amount);
await this.fraudService.detectCollusion(userId, matchId, amount);
```

### 3. Transaction Processing
```typescript
// In transaction service
await this.fraudService.checkTransaction(userId, amount, type);
```

### 4. Win/Loss Processing
```typescript
// In settlement service
await this.fraudService.checkWin(userId, isWin);
```

## Auto-Restriction System

Users are automatically restricted when:
1. HIGH or CRITICAL risk level detected
2. ≥3 fraud incidents (any risk level)

**Restriction Details**:
- Duration: 15 minutes (automatic)
- Status: RESTRICTED
- Reason: MANUAL_REVIEW
- Can be extended by admin

## Admin Notifications

High-risk activities trigger automatic admin notifications:
- **Risk Level**: HIGH or CRITICAL
- **Method**: Logger warning (integrates with notification system)
- **Information**: User ID, reason, risk level, metadata

## Report Generation

### Automated Reports
- **Period**: Last 7 days (default)
- **Custom Range**: Via query parameters
- **Includes**: Summary statistics, incidents, top offenders

### Key Metrics Tracked
- Total incidents by risk level
- Incident status distribution
- Fraud reason breakdown
- Top offending users
- Temporal patterns

## Configuration

### Thresholds (Configurable in service)
```typescript
// Multi-account detection
IP_ACCOUNT_THRESHOLD = 3;
DEVICE_ACCOUNT_THRESHOLD = 1;

// Betting patterns
LARGE_BET_MULTIPLIER = 5;
RAPID_BET_WINDOW_MS = 2000;

// Time-based
UNUSUAL_HOURS_START = 2;
UNUSUAL_HOURS_END = 5;

// Transaction monitoring
STRUCTURING_THRESHOLD = 1000;
STRUCTURING_COUNT = 3;
```

## Performance Considerations

### In-Memory Tracking
- Uses Map structures for real-time tracking
- Automatic cleanup of old entries
- Memory-efficient sliding windows

### Database Indexes
- userId for quick lookups
- reason, status, riskLevel for filtering
- createdAt for temporal queries

## Monitoring & Maintenance

### Regular Tasks
1. Review flagged users daily
2. Analyze false positives
3. Adjust thresholds based on patterns
4. Update detection rules as needed

### Alerts to Monitor
- CRITICAL risk detections
- Users with repeated flags
- Unusual patterns in reports

## Future Enhancements

### Potential Additions
- Machine learning model integration
- Network analysis for collusion rings
- Behavioral biometrics
- Real-time dashboard
- Automated reporting schedules
- Integration with external fraud databases

## Compliance Notes

### Data Retention
- Fraud logs retained per regulatory requirements
- Metadata includes full audit trail
- Support for data export requests

### Privacy Considerations
- IP/device tracking disclosed in ToS
- Right to explanation for automated decisions
- Appeal process for restrictions

## Troubleshooting

### Common Issues

**False Positives**:
- Adjust thresholds in service
- Review specific user patterns
- Consider legitimate use cases

**Performance Issues**:
- Monitor memory usage of trackers
- Optimize database queries
- Consider Redis for distributed tracking

**Integration Issues**:
- Verify dependency injection
- Check repository imports
- Ensure migrations ran successfully

## Support

For questions or issues:
1. Check implementation code comments
2. Review test cases
3. Consult admin documentation
4. Contact development team
