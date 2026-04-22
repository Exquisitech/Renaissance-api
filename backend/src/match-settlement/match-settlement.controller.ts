import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { MatchSettlementService } from './match-settlement.service';
import { CreateMatchSettlementDto } from './dto/create-match-settlement.dto';
import { UpdateMatchSettlementDto } from './dto/update-match-settlement.dto';

@Controller('match-settlement')
export class MatchSettlementController {
  constructor(private readonly matchSettlementService: MatchSettlementService) {}

  @Post()
  create(@Body() createMatchSettlementDto: CreateMatchSettlementDto) {
    return this.matchSettlementService.create(createMatchSettlementDto);
  }

  @Get()
  findAll() {
    return this.matchSettlementService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.matchSettlementService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateMatchSettlementDto: UpdateMatchSettlementDto) {
    return this.matchSettlementService.update(+id, updateMatchSettlementDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.matchSettlementService.remove(+id);
  }
}
