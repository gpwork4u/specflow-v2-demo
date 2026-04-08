import { Module } from '@nestjs/common';
import { LeavesController } from './leaves.controller';
import { LeavesService } from './leaves.service';
import { LeaveQuotasModule } from '../leave-quotas/leave-quotas.module';

@Module({
  imports: [LeaveQuotasModule],
  controllers: [LeavesController],
  providers: [LeavesService],
  exports: [LeavesService],
})
export class LeavesModule {}
