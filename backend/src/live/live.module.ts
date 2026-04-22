import { Module } from '@nestjs/common';
import { LiveGateway } from './live.gateway';
import { LiveService } from './live.service';
import { LiveController } from './live.controller';

@Module({
  providers: [LiveGateway, LiveService],
  controllers: [LiveController],
  exports: [LiveService],
})
export class LiveModule {}
