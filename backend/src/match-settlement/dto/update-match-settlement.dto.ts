import { PartialType } from '@nestjs/swagger';
import { CreateMatchSettlementDto } from './create-match-settlement.dto';

export class UpdateMatchSettlementDto extends PartialType(CreateMatchSettlementDto) {}
