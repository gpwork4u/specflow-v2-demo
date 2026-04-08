import { Module } from '@nestjs/common';
import { LeaveApprovalController } from './leave-approval.controller';
import { LeaveApprovalService } from './leave-approval.service';

@Module({
  controllers: [LeaveApprovalController],
  providers: [LeaveApprovalService],
  exports: [LeaveApprovalService],
})
export class LeaveApprovalModule {}
