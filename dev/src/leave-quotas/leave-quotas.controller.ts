import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { LeaveQuotasService } from './leave-quotas.service';
import { QueryQuotaDto } from './dto/query-quota.dto';
import { UpdateQuotaDto } from './dto/update-quota.dto';
import { BatchQuotaDto } from './dto/batch-quota.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, CurrentUserData } from '../auth/decorators/current-user.decorator';

@Controller('leave-quotas')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LeaveQuotasController {
  constructor(private readonly leaveQuotasService: LeaveQuotasService) {}

  /**
   * 員工查看自己的額度
   * GET /api/v1/leave-quotas/me
   */
  @Get('me')
  async getMyQuotas(
    @CurrentUser() user: CurrentUserData,
    @Query() query: QueryQuotaDto,
  ) {
    return this.leaveQuotasService.getQuotas(user.userId, query.year);
  }

  /**
   * Admin 查看員工額度
   * GET /api/v1/leave-quotas/employees/:userId
   */
  @Get('employees/:userId')
  @Roles('ADMIN')
  async getEmployeeQuotas(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query() query: QueryQuotaDto,
  ) {
    return this.leaveQuotasService.getQuotas(userId, query.year);
  }

  /**
   * Admin 設定員工額度
   * PUT /api/v1/leave-quotas/employees/:userId
   */
  @Put('employees/:userId')
  @Roles('ADMIN')
  async updateEmployeeQuotas(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: UpdateQuotaDto,
  ) {
    return this.leaveQuotasService.updateQuotas(userId, dto);
  }

  /**
   * Admin 批次設定額度
   * POST /api/v1/leave-quotas/batch
   */
  @Post('batch')
  @Roles('ADMIN')
  async batchUpdateQuotas(@Body() dto: BatchQuotaDto) {
    return this.leaveQuotasService.batchUpdateQuotas(dto);
  }
}
