# XLM Wallet API Testing Guide

## Overview
Comprehensive XLM wallet management API with balance tracking, transaction history, withdrawals, and deposit processing.

## API Endpoints

### 1. Get User Balance
```
GET /wallet/:userId/balance
```
- **Authentication**: Required (JWT)
- **Returns**: Available balance, locked balance, total balance
- **Caching**: 1 minute cache

**Response:**
```json
{
  "userId": "123e4567-e89b-12d3-a456-426614174000",
  "availableBalance": 125.50,
  "lockedBalance": 25.00,
  "totalBalance": 150.50,
  "lastUpdated": "2024-03-15T12:00:00Z"
}
```

### 2. Get Transaction History
```
GET /wallet/:userId/transactions?page=1&limit=10&type=CREDIT&source=DEPOSIT
```
- **Authentication**: Required (JWT)
- **Pagination**: Configurable (1-100 per page)
- **Filtering**: By transaction type and source
- **Sorting**: By creation date (DESC)

**Response:**
```json
{
  "data": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "amount": 25.50,
      "type": "CREDIT",
      "source": "DEPOSIT",
      "referenceId": "abc123def456...",
      "previousBalance": 100.00,
      "newBalance": 125.50,
      "createdAt": "2024-03-15T10:30:00Z"
    }
  ],
  "total": 50,
  "page": 1,
  "limit": 10,
  "totalPages": 5
}
```

### 3. Process Withdrawal
```
POST /wallet/:userId/withdraw
```
- **Authentication**: Required (JWT)
- **Validation**: Address format, balance, limits
- **Processing**: Atomic transaction with fee deduction
- **Status**: Pending → Completed/Failed

**Request:**
```json
{
  "amount": 10.50,
  "destinationAddress": "GABCDEF1234567890ABCDEF1234567890ABCDEF12",
  "memo": "Withdrawal for user123"
}
```

**Response:**
```json
{
  "transactionId": "withdrawal_1710523400000",
  "status": "pending",
  "amount": 10.50,
  "fee": 0.00001,
  "destinationAddress": "GABCDEF1234567890ABCDEF1234567890ABCDEF12",
  "estimatedCompletion": "2024-03-15T12:05:00Z"
}
```

### 4. Track Deposit (Admin Only)
```
POST /wallet/deposit/track
```
- **Authentication**: Required (Admin JWT)
- **Purpose**: Credit incoming deposits to user wallets
- **Confirmation**: Requires blockchain confirmations

**Request:**
```json
{
  "amount": 25.00,
  "sourceAddress": "GABCDEF1234567890ABCDEF1234567890ABCDEF12",
  "transactionHash": "abc123def4567890abc123def4567890abc123def4567890abc123def4567890"
}
```

**Response:**
```json
{
  "transactionId": "abc123def4567890abc123def4567890abc123def4567890abc123def4567890",
  "amount": 25.00,
  "sourceAddress": "GABCDEF1234567890ABCDEF1234567890ABCDEF12",
  "status": "pending",
  "confirmations": 0,
  "requiredConfirmations": 3
}
```

### 5. Confirm Deposit (Admin Only)
```
POST /wallet/deposit/confirm
```
- **Authentication**: Required (Admin JWT)
- **Purpose**: Update deposit confirmation status
- **Processing**: Updates status based on blockchain confirmations

**Request:**
```json
{
  "transactionHash": "abc123def4567890abc123def4567890abc123def4567890abc123def4567890",
  "confirmations": 3
}
```

### 6. Get Withdrawal Limits
```
GET /wallet/:userId/limits
```
- **Authentication**: Required (JWT)
- **Returns**: Daily usage, limits, remaining amount
- **Daily Limit**: 10,000 XLM

**Response:**
```json
{
  "used": 50.25,
  "limit": 10000,
  "remaining": 9949.75
}
```

### 7. Get Wallet Statistics
```
GET /wallet/:userId/stats
```
- **Authentication**: Required (JWT)
- **Analytics**: Comprehensive wallet statistics
- **Metrics**: Transaction counts, volumes, averages

**Response:**
```json
{
  "totalTransactions": 150,
  "totalDeposits": 500.75,
  "totalWithdrawals": 125.50,
  "totalEarned": 75.25,
  "averageTransactionSize": 3.34
}
```

## Features Implemented

✅ **Balance retrieves correctly** - Real-time balance with caching
✅ **Transactions tracked** - Complete transaction history with filtering
✅ **Withdrawals processed** - Secure withdrawal processing with validation
✅ **Proper validations** - Address format, balance, limits validation
✅ **History accurate** - Atomic transactions with proper logging

## Security Features

### 1. Authentication & Authorization
- JWT authentication required for all endpoints
- Admin role required for deposit operations
- User-scoped access control

### 2. Balance Validation
- Minimum balance requirements (0.5 XLM)
- Sufficient funds validation
- Daily withdrawal limits (10,000 XLM)

### 3. Address Validation
- Stellar address format validation
- 56-character length check
- 'G' prefix validation

### 4. Transaction Security
- Atomic database transactions
- Pessimistic locking for balance updates
- Complete audit trail with metadata

## XLM-Specific Features

### 1. Transaction Fees
- Minimum fee: 0.00001 XLM
- Automatic fee deduction
- Fee tracking in metadata

### 2. Confirmations
- Required confirmations: 3
- Status tracking: pending → completed
- Automatic status updates

### 3. Balance Types
- Available balance: Spendable funds
- Locked balance: Frozen/staked funds
- Total balance: Combined amount

## Performance Optimizations

### 1. Caching Strategy
- Balance cache: 1 minute
- Transaction cache: 30 seconds
- Limits cache: 1 minute
- Stats cache: 1 minute

### 2. Database Optimization
- Indexed queries on userId, type, source
- Efficient pagination with LIMIT/OFFSET
- Optimized transaction queries

### 3. Concurrent Safety
- Pessimistic locking for balance updates
- Atomic transactions
- Race condition prevention

## Error Handling

### 1. Validation Errors
```json
{
  "statusCode": 400,
  "message": "Withdrawal amount must be positive",
  "error": "Bad Request"
}
```

### 2. Insufficient Balance
```json
{
  "statusCode": 400,
  "message": "Insufficient balance",
  "error": "Bad Request"
}
```

### 3. Invalid Address
```json
{
  "statusCode": 400,
  "message": "Invalid destination address",
  "error": "Bad Request"
}
```

### 4. Daily Limit Exceeded
```json
{
  "statusCode": 400,
  "message": "Daily withdrawal limit exceeded. Remaining: 9949.75 XLM",
  "error": "Bad Request"
}
```

## Testing Commands

```bash
# Get user balance
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  "http://localhost:3000/wallet/123e4567-e89b-12d3-a456-426614174000/balance"

# Get transaction history
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  "http://localhost:3000/wallet/123e4567-e89b-12d3-a456-426614174000/transactions?page=1&limit=10"

# Process withdrawal
curl -X POST \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 10.50,
    "destinationAddress": "GABCDEF1234567890ABCDEF1234567890ABCDEF12",
    "memo": "Test withdrawal"
  }' \
  "http://localhost:3000/wallet/123e4567-e89b-12d3-a456-426614174000/withdraw"

# Get withdrawal limits
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  "http://localhost:3000/wallet/123e4567-e89b-12d3-a456-426614174000/limits"

# Get wallet statistics
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  "http://localhost:3000/wallet/123e4567-e89b-12d3-a456-426614174000/stats"

# Track deposit (Admin only)
curl -X POST \
  -H "Authorization: Bearer ADMIN_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 25.00,
    "sourceAddress": "GABCDEF1234567890ABCDEF1234567890ABCDEF12",
    "transactionHash": "abc123def4567890abc123def4567890abc123def4567890abc123def4567890"
  }' \
  "http://localhost:3000/wallet/deposit/track"
```

## Transaction Sources

| Source | Type | Description |
|--------|------|-------------|
| DEPOSIT | CREDIT | Incoming XLM deposits |
| WITHDRAWAL | DEBIT | Outgoing XLM withdrawals |
| BET | CREDIT/DEBIT | Betting winnings/losses |
| STAKE | CREDIT/DEBIT | Staking rewards/locks |
| REWARD | CREDIT | Platform rewards |

## Transaction Types

| Type | Description |
|------|-------------|
| CREDIT | Increases balance |
| DEBIT | Decreases balance |

## Monitoring & Analytics

All endpoints include:
- Request/response logging
- Error tracking
- Performance metrics
- Transaction audit trails
- Balance change tracking

## Integration Points

### 1. Stellar Network
- Address validation
- Transaction fee calculation
- Confirmation tracking
- Blockchain integration (future)

### 2. Betting System
- Automatic balance updates
- Bet settlement integration
- Reward distribution

### 3. Staking System
- Lock/unlock balance
- Reward distribution
- Stake tracking
