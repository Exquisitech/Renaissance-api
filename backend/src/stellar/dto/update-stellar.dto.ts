import { PartialType } from '@nestjs/swagger';
import { CreateStellarDto } from './create-stellar.dto';

export class UpdateStellarDto extends PartialType(CreateStellarDto) {}
