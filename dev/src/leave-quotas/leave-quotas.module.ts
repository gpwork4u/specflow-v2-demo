import { Module } from '@nestjs/common';
import { LeaveQuotasController } from './leave-quotas.controller';
import { LeaveQuotasService } from './leave-quotas.service';

@Module({
  controllers: [LeaveQuotasController],
  providers: [LeaveQuotasService],
  exports: [LeaveQuotasService],
})
export class LeaveQuotasModule {}
