import {
  Controller,
  Post,
  Get,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { OvertimeService } from './overtime.service';
import { CreateOvertimeDto } from './dto/create-overtime.dto';
import { QueryOvertimeDto } from './dto/query-overtime.dto';
import { QueryPendingOvertimeDto } from './dto/query-pending-overtime.dto';
import { ApproveOvertimeDto } from './dto/approve-overtime.dto';
import { RejectOvertimeDto } from './dto/reject-overtime.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import {
  CurrentUser,
  CurrentUserData,
} from '../auth/decorators/current-user.decorator';

@Controller('overtime')
@UseGuards(JwtAuthGuard)
export class OvertimeController {
  constructor(private readonly overtimeService: OvertimeService) {}

  /**
   * 申請加班
   * POST /api/v1/overtime
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createOvertime(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: CreateOvertimeDto,
  ) {
    return this.overtimeService.createOvertime(user.userId, dto);
  }

  /**
   * 查詢個人加班紀錄
   * GET /api/v1/overtime
   */
  @Get()
  async getOvertimeList(
    @CurrentUser() user: CurrentUserData,
    @Query() query: QueryOvertimeDto,
  ) {
    return this.overtimeService.getOvertimeList(user.userId, query);
  }

  /**
   * 待審核加班申請（manager/admin）
   * GET /api/v1/overtime/pending
   * 注意：此路由必須在 :id 路由之前定義
   */
  @Get('pending')
  @UseGuards(RolesGuard)
  @Roles('MANAGER', 'ADMIN')
  async getPendingOvertimes(
    @CurrentUser() user: CurrentUserData,
    @Query() query: QueryPendingOvertimeDto,
  ) {
    return this.overtimeService.getPendingOvertimes(user, query);
  }

  /**
   * 加班詳情
   * GET /api/v1/overtime/:id
   */
  @Get(':id')
  async getOvertimeById(
    @CurrentUser() user: CurrentUserData,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.overtimeService.getOvertimeById(
      id,
      user.userId,
      user.role,
      user.departmentId,
    );
  }

  /**
   * 取消加班申請
   * PUT /api/v1/overtime/:id/cancel
   */
  @Put(':id/cancel')
  async cancelOvertime(
    @CurrentUser() user: CurrentUserData,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.overtimeService.cancelOvertime(id, user.userId);
  }

  /**
   * 核准加班
   * PUT /api/v1/overtime/:id/approve
   */
  @Put(':id/approve')
  @UseGuards(RolesGuard)
  @Roles('MANAGER', 'ADMIN')
  async approveOvertime(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserData,
    @Body() dto: ApproveOvertimeDto,
  ) {
    return this.overtimeService.approveOvertime(id, user, dto.comment);
  }

  /**
   * 駁回加班
   * PUT /api/v1/overtime/:id/reject
   */
  @Put(':id/reject')
  @UseGuards(RolesGuard)
  @Roles('MANAGER', 'ADMIN')
  async rejectOvertime(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserData,
    @Body() dto: RejectOvertimeDto,
  ) {
    return this.overtimeService.rejectOvertime(id, user, dto.comment);
  }
}
