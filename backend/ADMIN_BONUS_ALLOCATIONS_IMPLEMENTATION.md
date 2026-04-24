# Admin-Managed Bonus Allocations & Audit Trail

## Overview

This document outlines the implementation of an admin-managed bonus allocation system with mandatory audit trails, justification tracking, and comprehensive reasoning documentation for all bonus or penalty adjustments.

## Features

### 1. Admin Bonus Management
- Allocate bonuses based on multiple reasons
- Justification categories:
  - **Loyalty**: Rewarding long-term users
  - **Anomaly Detection Refund**: Compensation for system errors or fraud incidents
  - **Goodwill**: Discretionary compensation
  - **VIP Tier**: High-value customer retention
  - **Promotion**: Campaign-specific bonuses
- Bulk operations for multiple users
- Immediate or scheduled bonus distribution

### 2. Mandatory Audit Trail
- Complete history of every allocation
- Admin identity and timestamp
- Detailed justification and reasoning
- Supporting documentation links
- Approval chain for large allocations
- Immutable audit records

### 3. Compliance & Controls
- Role-based bonus allocation limits
- Approval requirements for thresholds
- Fraud prevention checks
- Bonus limit per user per period
- Reason validation
- Automatic notifications to finance/compliance

## Database Schema

### Bonus Allocation Table
```sql
CREATE TABLE bonus_allocations (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  admin_id UUID NOT NULL REFERENCES admins(id),
  allocation_type ENUM(
    'loyalty',
    'anomaly_refund',
    'goodwill',
    'vip_tier',
    'promotion'
  ) NOT NULL,
  amount DECIMAL(20,8) NOT NULL,
  currency VARCHAR(10) DEFAULT 'USD',
  status ENUM('pending_approval', 'approved', 'rejected', 'distributed', 'expired') DEFAULT 'pending_approval',
  reason_category VARCHAR(100) NOT NULL,
  detailed_reason TEXT NOT NULL,
  justification TEXT NOT NULL,
  supporting_doc_url VARCHAR(512),
  supporting_incident_id UUID,
  approved_by_admin_id UUID REFERENCES admins(id),
  approval_timestamp TIMESTAMP,
  rejection_reason TEXT,
  distribution_scheduled_at TIMESTAMP,
  distributed_at TIMESTAMP,
  bonus_expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_admin_id (admin_id),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at),
  INDEX idx_allocation_type (allocation_type)
);
```

### Bonus Audit Log Table
```sql
CREATE TABLE bonus_audit_logs (
  id UUID PRIMARY KEY,
  bonus_allocation_id UUID NOT NULL REFERENCES bonus_allocations(id),
  admin_id UUID NOT NULL REFERENCES admins(id),
  action ENUM(
    'created',
    'approved',
    'rejected',
    'distributed',
    'cancelled',
    'expired',
    'modified'
  ) NOT NULL,
  previous_value JSON,
  new_value JSON,
  change_description TEXT,
  ip_address VARCHAR(45),
  user_agent VARCHAR(512),
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  session_id VARCHAR(255),
  INDEX idx_bonus_id (bonus_allocation_id),
  INDEX idx_admin_id (admin_id),
  INDEX idx_timestamp (timestamp),
  INDEX idx_action (action)
);
```

### Bonus Justification Templates Table
```sql
CREATE TABLE bonus_justification_templates (
  id UUID PRIMARY KEY,
  allocation_type VARCHAR(100) NOT NULL,
  template_name VARCHAR(255) NOT NULL,
  template_description TEXT,
  required_fields JSON,
  max_amount DECIMAL(20,8),
  requires_approval BOOLEAN DEFAULT true,
  approval_level INT DEFAULT 1,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(allocation_type, template_name)
);
```

### Bonus Admin Permissions Table
```sql
CREATE TABLE admin_bonus_permissions (
  id UUID PRIMARY KEY,
  admin_id UUID NOT NULL REFERENCES admins(id) UNIQUE,
  can_allocate_loyalty_bonus BOOLEAN DEFAULT false,
  can_allocate_refund_bonus BOOLEAN DEFAULT false,
  can_allocate_goodwill_bonus BOOLEAN DEFAULT false,
  max_single_allocation DECIMAL(20,8) NOT NULL DEFAULT 1000,
  max_daily_allocation DECIMAL(20,8) NOT NULL DEFAULT 10000,
  requires_secondary_approval BOOLEAN DEFAULT false,
  bonus_allocation_types JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### Bonus Limits & Thresholds Table
```sql
CREATE TABLE bonus_allocation_limits (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  allocation_type VARCHAR(100) NOT NULL,
  total_allocated_this_month DECIMAL(20,8) DEFAULT 0,
  total_allocated_this_year DECIMAL(20,8) DEFAULT 0,
  last_allocation_date TIMESTAMP,
  allocation_count_this_month INT DEFAULT 0,
  max_allowed_this_month DECIMAL(20,8),
  max_allowed_this_year DECIMAL(20,8),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE(user_id, allocation_type)
);
```

## Implementation Details

### Bonus Allocation Service

#### BonusService (Core Logic)
```typescript
@Injectable()
export class BonusService {
  constructor(
    @InjectRepository(BonusAllocation) private bonusRepo: Repository<BonusAllocation>,
    @InjectRepository(BonusAuditLog) private auditLogRepo: Repository<BonusAuditLog>,
    @InjectRepository(GeneralLedger) private generalLedgerRepo: Repository<GeneralLedger>,
    @InjectRepository(AdminBonusPermissions) private permissionRepo: Repository<AdminBonusPermissions>,
    private walletsService: WalletsService,
    private userService: UserService,
    private auditService: AuditService,
    private notificationService: NotificationService,
    private logger: LoggerService,
  ) {}

  // Create bonus allocation with validation
  async createBonusAllocation(
    request: CreateBonusAllocationDto,
    adminId: string,
    requestMetadata: RequestMetadata,
  ): Promise<BonusAllocation> {
    // Validate admin permissions
    await this.validateAdminPermissions(adminId, request.allocation_type, request.amount);

    // Validate justification
    await this.validateJustification(request);

    // Check user bonus limits
    await this.checkUserBonusLimits(request.user_id, request.allocation_type, request.amount);

    // Create allocation record
    const allocation = await this.bonusRepo.save({
      user_id: request.user_id,
      admin_id: adminId,
      allocation_type: request.allocation_type,
      amount: request.amount,
      currency: request.currency,
      reason_category: request.reason_category,
      detailed_reason: request.detailed_reason,
      justification: request.justification,
      supporting_doc_url: request.supporting_doc_url,
      supporting_incident_id: request.incident_id,
      distribution_scheduled_at: request.scheduled_at,
      status: 'pending_approval',
      created_at: new Date(),
    });

    // Create audit log entry
    await this.auditLogRepo.save({
      bonus_allocation_id: allocation.id,
      admin_id: adminId,
      action: 'created',
      new_value: allocation,
      change_description: `Bonus allocation created: ${request.allocation_type} of ${request.amount} ${request.currency}`,
      ip_address: requestMetadata.ip,
      user_agent: requestMetadata.userAgent,
      session_id: requestMetadata.sessionId,
    });

    // Notify compliance team
    await this.notificationService.notifyComplianceTeam({
      type: 'bonus_created',
      allocation_id: allocation.id,
      amount: request.amount,
      reason: request.allocation_type,
    });

    this.logger.log(`Bonus allocation created: ${allocation.id}`);
    return allocation;
  }

  // Approve bonus allocation
  async approveBonusAllocation(
    allocationId: string,
    approverAdminId: string,
    requestMetadata: RequestMetadata,
  ): Promise<BonusAllocation> {
    const allocation = await this.bonusRepo.findOne(allocationId);
    
    if (!allocation) {
      throw new NotFoundException(`Bonus allocation ${allocationId} not found`);
    }

    if (allocation.status !== 'pending_approval') {
      throw new BadRequestException(`Cannot approve allocation with status: ${allocation.status}`);
    }

    // Validate approver has permissions
    await this.validateApproverPermissions(approverAdminId, allocation.amount);

    // Update allocation status
    allocation.status = 'approved';
    allocation.approved_by_admin_id = approverAdminId;
    allocation.approval_timestamp = new Date();

    await this.bonusRepo.save(allocation);

    // Create audit log
    await this.auditLogRepo.save({
      bonus_allocation_id: allocationId,
      admin_id: approverAdminId,
      action: 'approved',
      change_description: `Bonus allocation approved: ${allocation.amount} ${allocation.currency}`,
      ip_address: requestMetadata.ip,
      user_agent: requestMetadata.userAgent,
      session_id: requestMetadata.sessionId,
    });

    // Schedule immediate distribution if not scheduled
    if (!allocation.distribution_scheduled_at) {
      await this.distributeBonusImmediate(allocationId);
    }

    return allocation;
  }

  // Reject bonus allocation
  async rejectBonusAllocation(
    allocationId: string,
    rejectorAdminId: string,
    reason: string,
    requestMetadata: RequestMetadata,
  ): Promise<BonusAllocation> {
    const allocation = await this.bonusRepo.findOne(allocationId);
    
    if (!allocation) {
      throw new NotFoundException(`Bonus allocation ${allocationId} not found`);
    }

    allocation.status = 'rejected';
    allocation.rejection_reason = reason;

    await this.bonusRepo.save(allocation);

    // Create audit log
    await this.auditLogRepo.save({
      bonus_allocation_id: allocationId,
      admin_id: rejectorAdminId,
      action: 'rejected',
      change_description: `Bonus allocation rejected: ${reason}`,
      ip_address: requestMetadata.ip,
      user_agent: requestMetadata.userAgent,
      session_id: requestMetadata.sessionId,
    });

    this.logger.log(`Bonus allocation rejected: ${allocationId}`);
    return allocation;
  }

  // Distribute bonus to user wallet
  async distributeBonusImmediate(allocationId: string): Promise<void> {
    const allocation = await this.bonusRepo.findOne(allocationId);
    
    if (allocation.status !== 'approved') {
      throw new BadRequestException('Only approved allocations can be distributed');
    }

    try {
      // Create ledger entry
      const ledgerEntry = await this.generalLedgerRepo.save({
        user_id: allocation.user_id,
        transaction_type: 'bonus_allocation',
        amount: allocation.amount,
        currency: allocation.currency,
        description: `${allocation.allocation_type} bonus from admin`,
        reference_id: allocation.id,
        created_at: new Date(),
      });

      // Update user wallet
      await this.walletsService.addBonus(allocation.user_id, allocation.amount, allocation.currency);

      // Update allocation status
      allocation.status = 'distributed';
      allocation.distributed_at = new Date();
      
      // Set expiration if needed
      if (allocation.allocation_type === 'promotion') {
        allocation.bonus_expires_at = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
      }

      await this.bonusRepo.save(allocation);

      // Create audit log
      await this.auditLogRepo.save({
        bonus_allocation_id: allocationId,
        admin_id: allocation.admin_id,
        action: 'distributed',
        change_description: `Bonus distributed to user: ${allocation.amount} ${allocation.currency}`,
      });

      this.logger.log(`Bonus distributed: ${allocationId} to user ${allocation.user_id}`);
    } catch (error) {
      this.logger.error(`Failed to distribute bonus ${allocationId}: ${error.message}`);
      throw error;
    }
  }

  // Get complete audit trail
  async getAuditTrail(allocationId: string): Promise<BonusAuditLog[]> {
    return this.auditLogRepo.find({
      bonus_allocation_id: allocationId,
      order: { timestamp: 'DESC' },
    });
  }

  // Validate admin permissions
  private async validateAdminPermissions(
    adminId: string,
    allocationType: string,
    amount: Decimal,
  ): Promise<void> {
    const permissions = await this.permissionRepo.findOne(adminId);
    
    if (!permissions) {
      throw new ForbiddenException(`No bonus permissions for admin ${adminId}`);
    }

    if (amount > permissions.max_single_allocation) {
      throw new BadRequestException(
        `Amount exceeds max single allocation: ${permissions.max_single_allocation}`
      );
    }

    // Check specific allocation type permission
    const typePermissionMap = {
      loyalty: permissions.can_allocate_loyalty_bonus,
      anomaly_refund: permissions.can_allocate_refund_bonus,
      goodwill: permissions.can_allocate_goodwill_bonus,
    };

    if (!typePermissionMap[allocationType]) {
      throw new ForbiddenException(
        `Admin not permitted to allocate ${allocationType} bonuses`
      );
    }
  }

  // Validate justification
  private async validateJustification(request: CreateBonusAllocationDto): Promise<void> {
    if (!request.justification || request.justification.trim().length === 0) {
      throw new BadRequestException('Justification is required');
    }

    if (request.justification.length < 20) {
      throw new BadRequestException('Justification must be at least 20 characters');
    }

    // For refunds, require incident reference
    if (request.allocation_type === 'anomaly_refund' && !request.incident_id) {
      throw new BadRequestException('Incident ID required for anomaly refunds');
    }
  }

  // Check user bonus limits
  private async checkUserBonusLimits(
    userId: string,
    allocationType: string,
    amount: Decimal,
  ): Promise<void> {
    const limit = await this.bonusLimitsRepo.findOne({
      user_id: userId,
      allocation_type: allocationType,
    });

    if (limit) {
      const totalThisMonth = limit.total_allocated_this_month + amount;
      if (limit.max_allowed_this_month && totalThisMonth > limit.max_allowed_this_month) {
        throw new BadRequestException(
          `User bonus limit exceeded this month: ${totalThisMonth} > ${limit.max_allowed_this_month}`
        );
      }
    }
  }

  // Validate approver permissions
  private async validateApproverPermissions(
    approverId: string,
    amount: Decimal,
  ): Promise<void> {
    const permissions = await this.permissionRepo.findOne(approverId);
    
    if (!permissions || !permissions.requires_secondary_approval === false) {
      throw new ForbiddenException(`Admin ${approverId} not authorized to approve bonuses`);
    }
  }
}
```

### Bonus Justification Validator

#### JustificationValidator Service
```typescript
@Injectable()
export class JustificationValidatorService {
  private readonly validReasons = new Set([
    'loyalty_reward',
    'anomaly_detection',
    'system_error_refund',
    'user_complaint_resolution',
    'vip_retention',
    'promotional_campaign',
    'goodwill_gesture',
    'fraud_incident_compensation',
  ]);

  async validateReason(reason: string): Promise<boolean> {
    return this.validReasons.has(reason);
  }

  async validateJustificationLength(justification: string): Promise<boolean> {
    return justification.length >= 20 && justification.length <= 2000;
  }

  async validateIncidentReference(
    allocationType: string,
    incidentId: string,
  ): Promise<boolean> {
    if (allocationType === 'anomaly_refund') {
      // Verify incident exists in fraud detection system
      return await this.fraudService.incidentExists(incidentId);
    }
    return true;
  }
}
```

### Scheduled Distribution Service

#### ScheduledDistributionService
```typescript
@Injectable()
export class ScheduledDistributionService {
  constructor(
    @InjectRepository(BonusAllocation) private bonusRepo: Repository<BonusAllocation>,
    private bonusService: BonusService,
  ) {}

  @Cron('0 * * * *') // Every hour
  async processScheduledDistributions(): Promise<void> {
    const now = new Date();
    const allocations = await this.bonusRepo.find({
      status: 'approved',
      distribution_scheduled_at: LessThanOrEqual(now),
    });

    for (const allocation of allocations) {
      await this.bonusService.distributeBonusImmediate(allocation.id);
    }
  }
}
```

## API Endpoints

### Controller Implementation
```typescript
@Controller('admin/bonuses')
@UseGuards(AuthGuard, AdminGuard)
export class BonusController {
  constructor(private bonusService: BonusService) {}

  // Create bonus allocation
  @Post('allocate')
  @UseInterceptors(AuditInterceptor)
  async allocateBonus(
    @Body() request: CreateBonusAllocationDto,
    @GetAdmin() admin: Admin,
    @GetRequestMetadata() metadata: RequestMetadata,
  ): Promise<BonusAllocation> {
    return this.bonusService.createBonusAllocation(request, admin.id, metadata);
  }

  // Approve bonus allocation
  @Post('approve/:allocationId')
  @UseInterceptors(AuditInterceptor)
  async approveBonus(
    @Param('allocationId') allocationId: string,
    @GetAdmin() admin: Admin,
    @GetRequestMetadata() metadata: RequestMetadata,
  ): Promise<BonusAllocation> {
    return this.bonusService.approveBonusAllocation(allocationId, admin.id, metadata);
  }

  // Reject bonus allocation
  @Post('reject/:allocationId')
  @UseInterceptors(AuditInterceptor)
  async rejectBonus(
    @Param('allocationId') allocationId: string,
    @Body() request: RejectBonusDto,
    @GetAdmin() admin: Admin,
    @GetRequestMetadata() metadata: RequestMetadata,
  ): Promise<BonusAllocation> {
    return this.bonusService.rejectBonusAllocation(
      allocationId,
      admin.id,
      request.reason,
      metadata,
    );
  }

  // Get audit trail for bonus
  @Get('audit/:allocationId')
  async getAuditTrail(
    @Param('allocationId') allocationId: string,
  ): Promise<BonusAuditLog[]> {
    return this.bonusService.getAuditTrail(allocationId);
  }

  // List allocations with filters
  @Get('list')
  async listAllocations(
    @Query() filters: ListBonusFiltersDto,
  ): Promise<PaginatedResult<BonusAllocation>> {}
}
```

## DTOs & Types

```typescript
export class CreateBonusAllocationDto {
  @IsUUID()
  user_id: string;

  @IsEnum(['loyalty', 'anomaly_refund', 'goodwill', 'vip_tier', 'promotion'])
  allocation_type: string;

  @IsDecimal()
  amount: Decimal;

  @IsOptional()
  @IsString()
  currency: string = 'USD';

  @IsNotEmpty()
  @MinLength(20)
  @MaxLength(2000)
  justification: string;

  @IsNotEmpty()
  @IsString()
  reason_category: string;

  @IsNotEmpty()
  @MinLength(10)
  detailed_reason: string;

  @IsOptional()
  @IsUrl()
  supporting_doc_url?: string;

  @IsOptional()
  @IsUUID()
  incident_id?: string;

  @IsOptional()
  @IsISO8601()
  scheduled_at?: Date;
}

export class RejectBonusDto {
  @IsNotEmpty()
  @MinLength(10)
  reason: string;
}
```

## Configuration

```env
# Bonus Settings
BONUS_APPROVAL_REQUIRED=true
BONUS_MAX_SINGLE_ALLOCATION=5000.00
BONUS_MAX_DAILY_ALLOCATION=50000.00
BONUS_PROMOTION_EXPIRY_DAYS=30
BONUS_AUDIT_RETENTION_YEARS=7

# Thresholds requiring secondary approval
BONUS_SECONDARY_APPROVAL_THRESHOLD=1000.00

# Notification
BONUS_NOTIFY_COMPLIANCE=true
BONUS_NOTIFY_FINANCE=true
```

## Compliance & Security

- **Segregation of Duties**: Request by one admin, approval by another
- **Immutable Audit Logs**: All changes permanently recorded
- **Request Metadata**: IP, user agent, session tracking
- **Limit Enforcement**: Per-user, per-day, per-month limits
- **Reason Validation**: Predefined allocation categories
- **Supporting Documentation**: Mandatory links for refunds
- **Automated Alerts**: Large allocations trigger notifications
- **Access Control**: Role-based permissions per admin
- **Expiry Management**: Promotional bonuses auto-expire

## Monitoring & Alerts

- Bonus allocation volume and value tracking
- Approval rate and rejection rate monitoring
- Allocations by reason category
- Admin allocation patterns (detect abuse)
- Failed distribution attempts
- Budget utilization tracking

## Testing Strategy

1. Unit tests for permission validation
2. Integration tests for audit log creation
3. End-to-end tests for full allocation workflow
4. Security tests for unauthorized access attempts
5. Limit enforcement tests
6. Scheduled distribution tests
