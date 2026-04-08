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
import { LeavesService } from './leaves.service';
import { CreateLeaveDto } from './dto/create-leave.dto';
import { QueryLeavesDto } from './dto/query-leaves.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserData } from '../auth/decorators/current-user.decorator';

@Controller('leaves')
@UseGuards(JwtAuthGuard)
export class LeavesController {
  constructor(private readonly leavesService: LeavesService) {}

  /**
   * 申請請假
   * POST /api/v1/leaves
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createLeave(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: CreateLeaveDto,
  ) {
    return this.leavesService.createLeave(user.userId, dto);
  }

  /**
   * 查詢個人請假紀錄
   * GET /api/v1/leaves
   */
  @Get()
  async getLeaves(
    @CurrentUser() user: CurrentUserData,
    @Query() query: QueryLeavesDto,
  ) {
    return this.leavesService.getLeaves(user.userId, query);
  }

  /**
   * 請假詳情
   * GET /api/v1/leaves/:id
   */
  @Get(':id')
  async getLeaveById(
    @CurrentUser() user: CurrentUserData,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.leavesService.getLeaveById(
      id,
      user.userId,
      user.role,
      user.departmentId,
    );
  }

  /**
   * 取消請假
   * PUT /api/v1/leaves/:id/cancel
   */
  @Put(':id/cancel')
  async cancelLeave(
    @CurrentUser() user: CurrentUserData,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.leavesService.cancelLeave(id, user.userId);
  }
}
