import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SorobanService } from './soroban.service';
import { Settlement, SettlementStatus } from './entities/settlement.entity';

@Injectable()
export class SettlementService {
  private readonly logger = new Logger(SettlementService.name);

  constructor(
    private sorobanService: SorobanService,
    @InjectRepository(Settlement)
    private settlementRepository: Repository<Settlement>,
  ) {}

  async settleBet(
    betId: string,
    outcome: string,
    amount: number,
  ): Promise<Settlement> {
    const referenceId = `settle_${betId}`;
    this.logger.log(`Initiating settlement for Bet ${betId} (Ref: ${referenceId})`);

    // 1. Idempotency Check
    const existing = await this.settlementRepository.findOne({
      where: { referenceId },
    });

    if (existing) {
      if (existing.status === SettlementStatus.CONFIRMED) {
        this.logger.warn(`Settlement ${referenceId} already confirmed.`);
        return existing;
      }
      if (existing.status === SettlementStatus.PENDING) {
        this.logger.warn(`Settlement ${referenceId} is pending. Waiting for reconciliation.`);
        return existing;
      }
      // If FAILED, we might retry, but for now lets return identifying it failed previously
      // Or we can allow retry if implicit
    }

    // 2. Create Record (PENDING)
    const settlement = this.settlementRepository.create({
      referenceId,
      betId,
      outcome,
      amount,
      status: SettlementStatus.PENDING,
    });
    await this.settlementRepository.save(settlement);

    try {
      // 3. Submit to Blockchain
      // Converting amount to appropriate on-chain unit if necessary (assuming 1:1 for now or handled in soroban service)
      const args = [betId, outcome, amount.toString()]; 
      const txHash = await this.sorobanService.invokeContract('settle', args);

      this.logger.log(`Settlement submitted. Tx Hash: ${txHash}`);

      // 4. Update Record with Hash
      settlement.txHash = txHash;
      await this.settlementRepository.save(settlement);

      return settlement;
    } catch (error) {
      this.logger.error(`Failed to settle bet ${betId}`, error);
      settlement.status = SettlementStatus.FAILED;
      await this.settlementRepository.save(settlement);
      throw error;
    }
  }

  async reconcile(): Promise<void> {
    this.logger.log('Starting reconciliation process...');
    
    // Find all PENDING settlements
    const pendingSettlements = await this.settlementRepository.find({
      where: { status: SettlementStatus.PENDING },
    });

    for (const settlement of pendingSettlements) {
      if (!settlement.txHash) {
         // Should not happen if correctly saved step 4, but if crash between step 3 and 4...
         // We might need to query by reference ID on chain or mark failed
         this.logger.warn(`Settlement ${settlement.id} has no txHash. Marking FAILED.`);
         settlement.status = SettlementStatus.FAILED;
         await this.settlementRepository.save(settlement);
         continue;
      }

      try {
        // In a real implementation:
        // const txStatus = await this.sorobanService.getTransactionStatus(settlement.txHash);
        // For now, we'll simulate check or assume if it exists it's confirmed or logic needs expansion
        // This requires adding getTransactionStatus to SorobanService
        
        // Mock verification:
        this.logger.log(`Verifying tx ${settlement.txHash}...`);
        
        // Assume success for now
        settlement.status = SettlementStatus.CONFIRMED;
        await this.settlementRepository.save(settlement);
        this.logger.log(`Settlement ${settlement.id} confirmed.`);
        
      } catch (e) {
        this.logger.error(`Error reconciling settlement ${settlement.id}`, e);
      }
    }
  }
}
