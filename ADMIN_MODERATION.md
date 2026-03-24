# Admin Moderation & Override Tools

## Overview

The Admin Moderation & Override Tools provide administrators with controlled intervention capabilities in exceptional cases such as fraud, bugs, or disputes. All admin actions are fully audited with complete traceability.

## Features

✅ **Bet Cancellation** - Cancel pending bets and refund stakes  
✅ **Balance Correction** - Adjust user wallet balances with audit trails  
✅ **Match Correction** - Fix match scores in case of data errors  
✅ **Complete Audit Logging** - Every action tracked with reason metadata  
✅ **Role-Based Access Control** - Only ADMIN role can access endpoints  
✅ **Transactional Safety** - Database transactions ensure consistency  

## Architecture

### Entities

#### AdminAuditLog
Tracks all admin actions with complete context:
- **Admin ID** - Who performed the action
- **Action Type** - Type of admin action (bet_cancelled, balance_corrected, match_corrected)
- **Affected Entity** - What was modified (user, bet, match)
- **Reason** - Why the action was taken (required metadata)
- **Previous/New Values** - Before and after state
- **Metadata** - Additional context (amounts, balances, etc.)
- **Timestamp** - When the action occurred

### Database Table

**admin_audit_logs**
```sql
id UUID PRIMARY KEY
admin_id UUID FOREIGN KEY (users)
action_type ENUM ('bet_cancelled', 'balance_corrected', 'match_corrected')
affected_user_id UUID
affected_entity_id UUID
affected_entity_type VARCHAR(50)
reason TEXT
previous_values JSONB
new_values JSONB
metadata JSONB
created_at TIMESTAMP
updated_at TIMESTAMP
deleted_at TIMESTAMP
```

### Indexes
- `admin_id` - Query by admin
- `action_type` - Query by action type
- `created_at` - Query by date
- `affected_user_id` - Query by affected user
- Composite indexes for common queries

## API Endpoints

### 1. Cancel Bet

**Endpoint:** `POST /admin/bets/:id/cancel`

**Authentication:** JWT + ADMIN role required

**Request Body:**
```json
{
  "reason": "User requested refund due to accidental placement"
}
```

**Response:**
```json
{
  "message": "Bet cancelled successfully and stake refunded",
  "bet": {
    "id": "uuid",
    "userId": "uuid",
    "matchId": "uuid",
    "stakeAmount": "100.00000000",
    "status": "cancelled",
    "settledAt": "2026-01-26T10:30:00Z",
    "metadata": {}
  }
}
```

**What happens:**
1. Verifies bet exists and is in PENDING status
2. Refunds stake amount to user's wallet
3. Creates BET_CANCELLATION transaction
4. Logs action in admin_audit_logs
5. All changes committed in a single transaction

**Errors:**
- `404` - Bet not found
- `400` - Bet is not in PENDING status
- `403` - User is not ADMIN

---

### 2. Correct Balance

**Endpoint:** `POST /admin/users/:id/balance`

**Authentication:** JWT + ADMIN role required

**Request Body:**
```json
{
  "newBalance": "5000.50000000",
  "reason": "Balance correction due to bug in deposit calculation - ticket #4521"
}
```

**Response:**
```json
{
  "message": "Balance corrected successfully",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "walletBalance": "5000.50000000",
    "role": "user",
    "status": "active"
  }
}
```

**What happens:**
1. Validates user exists
2. Calculates adjustment amount (newBalance - currentBalance)
3. Updates user wallet_balance
4. Creates WALLET_DEPOSIT or WALLET_WITHDRAWAL transaction
5. Logs action with previous and new values
6. All changes committed in a single transaction

**Errors:**
- `404` - User not found
- `400` - New balance equals current balance
- `403` - User is not ADMIN

---

### 3. Correct Match

**Endpoint:** `POST /admin/matches/:id/correct`

**Authentication:** JWT + ADMIN role required

**Request Body:**
```json
{
  "homeScore": 3,
  "awayScore": 2,
  "reason": "Corrected typo: was 3-3, should be 3-2"
}
```

**Response:**
```json
{
  "message": "Match details corrected successfully",
  "match": {
    "id": "uuid",
    "homeTeam": "Team A",
    "awayTeam": "Team B",
    "homeScore": 3,
    "awayScore": 2,
    "outcome": "home_win",
    "status": "finished"
  }
}
```

**What happens:**
1. Verifies match exists
2. Updates specified score fields
3. Logs action with previous and new values
4. Changes committed in a single transaction

**Errors:**
- `404` - Match not found
- `403` - User is not ADMIN

---

### 4. Get Audit Logs

**Endpoint:** `GET /admin/audit-logs?actionType=bet_cancelled&page=1&limit=50`

**Authentication:** JWT + ADMIN role required

**Query Parameters:**
- `page` - Page number (default: 1)
- `limit` - Results per page (default: 50)
- `actionType` - Filter by action type (optional)
  - `bet_cancelled`
  - `balance_corrected`
  - `match_corrected`

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "adminId": "uuid",
      "actionType": "bet_cancelled",
      "affectedUserId": "uuid",
      "affectedEntityId": "uuid",
      "affectedEntityType": "bet",
      "reason": "User requested refund",
      "previousValues": {
        "status": "pending"
      },
      "newValues": {
        "status": "cancelled",
        "settledAt": "2026-01-26T10:30:00Z"
      },
      "metadata": {
        "stakeAmount": "100.00000000",
        "userPreviousBalance": "900.00000000",
        "userNewBalance": "1000.00000000"
      },
      "createdAt": "2026-01-26T10:30:00Z"
    }
  ],
  "total": 150,
  "page": 1,
  "limit": 50
}
```

---

### 5. Get User Audit Logs

**Endpoint:** `GET /admin/users/:id/audit-logs?page=1&limit=50`

**Authentication:** JWT + ADMIN role required

**Query Parameters:**
- `page` - Page number (default: 1)
- `limit` - Results per page (default: 50)

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "adminId": "uuid",
      "actionType": "balance_corrected",
      "affectedUserId": "uuid",
      "affectedEntityId": "uuid",
      "affectedEntityType": "user",
      "reason": "Bug in deposit calculation",
      "previousValues": {
        "walletBalance": "1000.00000000"
      },
      "newValues": {
        "walletBalance": "1500.00000000"
      },
      "metadata": {
        "adjustmentAmount": "500.00000000"
      },
      "createdAt": "2026-01-26T10:00:00Z"
    }
  ],
  "total": 5,
  "page": 1,
  "limit": 50
}
```

## Implementation Details

### Transaction Safety

All operations use database transactions to ensure consistency:

```typescript
const queryRunner = this.dataSource.createQueryRunner();
await queryRunner.connect();
await queryRunner.startTransaction();

try {
  // Perform all operations
  // - Update entities
  // - Create transactions
  // - Create audit log
  await queryRunner.commitTransaction();
} catch (error) {
  await queryRunner.rollbackTransaction();
  throw error;
} finally {
  await queryRunner.release();
}
```

### Audit Trail Structure

Each audit log captures:
1. **Who** - `adminId` of the performing admin
2. **What** - `action_type` and `affected_entity_type`
3. **When** - `createdAt` timestamp
4. **Why** - `reason` field (required)
5. **Before/After** - `previousValues` and `newValues`
6. **Context** - `metadata` for additional details

### Security

- **Role-Based Access Control** - Only ADMIN role (via `@Roles(UserRole.ADMIN)`)
- **JWT Authentication** - All endpoints require valid JWT token
- **Parameter Validation** - UUID validation and DTO validation via class-validator
- **Immutable Audit Logs** - Soft delete only (no hard deletes of audit records)

## Usage Examples

### Example 1: Cancel a Bet (Accidental Placement)

```bash
curl -X POST \
  http://localhost:3000/admin/bets/550e8400-e29b-41d4-a716-446655440000/cancel \
  -H "Authorization: Bearer <jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "User contacted support: accidental placement, should have been on different match"
  }'
```

### Example 2: Correct User Balance

```bash
curl -X POST \
  http://localhost:3000/admin/users/550e8400-e29b-41d4-a716-446655440001/balance \
  -H "Authorization: Bearer <jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "newBalance": "5000.50000000",
    "reason": "Compensation for deposit bug (tkt#4521) - user sent 0.5 BTC, received 0.3 BTC"
  }'
```

### Example 3: Correct Match Score

```bash
curl -X POST \
  http://localhost:3000/admin/matches/550e8400-e29b-41d4-a716-446655440002/correct \
  -H "Authorization: Bearer <jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "homeScore": 2,
    "awayScore": 1,
    "reason": "Operator error: initial entry was 1-2, official result is 2-1"
  }'
```

### Example 4: Query Audit Logs

```bash
# Get all audit logs, sorted by most recent
curl -X GET \
  'http://localhost:3000/admin/audit-logs?page=1&limit=50' \
  -H "Authorization: Bearer <jwt-token>"

# Get bet cancellations only
curl -X GET \
  'http://localhost:3000/admin/audit-logs?actionType=bet_cancelled&page=1&limit=50' \
  -H "Authorization: Bearer <jwt-token>"

# Get all actions for a specific user
curl -X GET \
  'http://localhost:3000/admin/users/550e8400-e29b-41d4-a716-446655440001/audit-logs' \
  -H "Authorization: Bearer <jwt-token>"
```

## File Structure

```
backend/src/admin/
├── admin.controller.ts       # HTTP endpoints
├── admin.service.ts          # Business logic
├── admin.module.ts           # NestJS module
├── entities/
│   └── admin-audit-log.entity.ts  # Database entity
└── dto/
    └── admin.dto.ts          # Request/Response DTOs
```

**Migrations:**
```
backend/src/migrations/
└── 005-create-admin-audit-logs.ts  # Database schema
```

## Testing Checklist

- [ ] Admin can cancel pending bets
- [ ] Non-pending bets cannot be cancelled
- [ ] Stake amount is refunded correctly
- [ ] BET_CANCELLATION transaction is created
- [ ] Audit log is created with reason
- [ ] Admin can correct user balance
- [ ] Adjustment transactions are created (WALLET_DEPOSIT or WALLET_WITHDRAWAL)
- [ ] Admin can correct match scores
- [ ] All changes are transactional (all or nothing)
- [ ] Only ADMIN role can access endpoints
- [ ] Non-authenticated users get 403
- [ ] Audit logs are queryable and filterable
- [ ] Audit logs capture all necessary metadata
- [ ] Soft deletes work properly (deleted_at)

## Migration Commands

Run the migration to create the admin_audit_logs table:

```bash
npm run migration:run
# or
pnpm migration:run
```

To revert the migration:

```bash
npm run migration:revert
# or
pnpm migration:revert
```

## Future Enhancements

1. **Approval Workflow** - Multi-level approval for large balance corrections
2. **Audit Notifications** - Email notifications when sensitive actions occur
3. **Rate Limiting** - Prevent abuse of admin endpoints
4. **Advanced Filtering** - Filter by date range, amount range, etc.
5. **Export Functionality** - Export audit logs to CSV/Excel
6. **Webhook Integration** - Send events to external systems
7. **Two-Factor Authentication** - Additional security for admin operations
