import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditReport, AuditViolation } from './audit-report.entity';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditReport)
    private readonly reportRepo: Repository<AuditReport>,
    // Inject services for treasury, staking, betting, NFT as needed
  ) {}

  async runAudit(): Promise<AuditReport> {
    const violations: AuditViolation[] = [];
    let status = 'PASS';

    // 1. Sum of user balances ≤ treasury reserves
    // TODO: Replace with actual logic
    const sumUserBalances = await this.mockSumUserBalances();
    const treasuryReserves = await this.mockTreasuryReserves();
    if (sumUserBalances > treasuryReserves) {
      violations.push({
        type: 'TREASURY_MISMATCH',
        message: `Sum of user balances (${sumUserBalances}) exceeds treasury reserves (${treasuryReserves})`,
        severity: 'CRITICAL',
        details: { sumUserBalances, treasuryReserves },
      });
      status = 'FAIL';
    }

    // 2. Locked bet amounts reflected in escrow contract
    const lockedBets = await this.mockLockedBets();
    const escrowLocked = await this.mockEscrowLocked();
    if (lockedBets !== escrowLocked) {
      violations.push({
        type: 'ESCROW_MISMATCH',
        message: `Locked bets (${lockedBets}) do not match escrow contract (${escrowLocked})`,
        severity: 'WARNING',
        details: { lockedBets, escrowLocked },
      });
      if (status !== 'FAIL') status = 'WARNING';
    }

    // 3. NFT mint count matches backend records
    const backendNFTCount = await this.mockBackendNFTCount();
    const contractNFTCount = await this.mockContractNFTCount();
    if (backendNFTCount !== contractNFTCount) {
      violations.push({
        type: 'NFT_MINT_MISMATCH',
        message: `NFT mint count mismatch: backend (${backendNFTCount}) vs contract (${contractNFTCount})`,
        severity: 'WARNING',
        details: { backendNFTCount, contractNFTCount },
      });
      if (status !== 'FAIL') status = 'WARNING';
    }

    const report = this.reportRepo.create({ status, violations });
    await this.reportRepo.save(report);
    this.logger.log(
      `Audit completed. Status: ${status}, Violations: ${violations.length}`,
    );
    return report;
  }

  // --- Mocked methods for demonstration ---
  private async mockSumUserBalances(): Promise<number> {
    return 100000;
  }
  private async mockTreasuryReserves(): Promise<number> {
    return 120000;
  }
  private async mockLockedBets(): Promise<number> {
    return 5000;
  }
  private async mockEscrowLocked(): Promise<number> {
    return 5000;
  }
  private async mockBackendNFTCount(): Promise<number> {
    return 1000;
  }
  private async mockContractNFTCount(): Promise<number> {
    return 1000;
  }
}
