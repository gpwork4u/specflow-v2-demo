import {
  Controller,
  Get,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { LeaveApprovalService } from './leave-approval.service';
import { QueryPendingDto } from './dto/query-pending.dto';
import { ApproveLeaveDto } from './dto/approve-leave.dto';
import { RejectLeaveDto } from './dto/reject-leave.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import {
  CurrentUser,
  CurrentUserData,
} from '../auth/decorators/current-user.decorator';

@Controller('leaves')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LeaveApprovalController {
  constructor(
    private readonly leaveApprovalService: LeaveApprovalService,
  ) {}

  /**
   * 查看待審核清單
   * GET /api/v1/leaves/pending
   */
  @Get('pending')
  @Roles('MANAGER', 'ADMIN')
  async getPendingLeaves(
    @CurrentUser() user: CurrentUserData,
    @Query() query: QueryPendingDto,
  ) {
    return this.leaveApprovalService.getPendingLeaves(user, query);
  }

  /**
   * 核准請假
   * PUT /api/v1/leaves/:id/approve
   */
  @Put(':id/approve')
  @Roles('MANAGER', 'ADMIN')
  async approveLeave(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserData,
    @Body() dto: ApproveLeaveDto,
  ) {
    return this.leaveApprovalService.approveLeave(id, user, dto.comment);
  }

  /**
   * 駁回請假
   * PUT /api/v1/leaves/:id/reject
   */
  @Put(':id/reject')
  @Roles('MANAGER', 'ADMIN')
  async rejectLeave(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserData,
    @Body() dto: RejectLeaveDto,
  ) {
    return this.leaveApprovalService.rejectLeave(id, user, dto.comment);
  }
}
