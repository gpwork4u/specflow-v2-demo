import { Module } from '@nestjs/common';
import { MissedClocksController } from './missed-clocks.controller';
import { MissedClocksService } from './missed-clocks.service';

@Module({
  controllers: [MissedClocksController],
  providers: [MissedClocksService],
  exports: [MissedClocksService],
})
export class MissedClocksModule {}
