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
import { MissedClocksService } from './missed-clocks.service';
import { CreateMissedClockDto } from './dto/create-missed-clock.dto';
import { QueryMissedClocksDto } from './dto/query-missed-clocks.dto';
import { QueryPendingMissedClocksDto } from './dto/query-pending.dto';
import { ApproveMissedClockDto } from './dto/approve-missed-clock.dto';
import { RejectMissedClockDto } from './dto/reject-missed-clock.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import {
  CurrentUser,
  CurrentUserData,
} from '../auth/decorators/current-user.decorator';

@Controller('missed-clocks')
@UseGuards(JwtAuthGuard)
export class MissedClocksController {
  constructor(
    private readonly missedClocksService: MissedClocksService,
  ) {}

  /**
   * 申請補打卡
   * POST /api/v1/missed-clocks
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: CreateMissedClockDto,
  ) {
    return this.missedClocksService.create(user.userId, dto);
  }

  /**
   * 查詢個人補打卡紀錄
   * GET /api/v1/missed-clocks
   */
  @Get()
  async findAll(
    @CurrentUser() user: CurrentUserData,
    @Query() query: QueryMissedClocksDto,
  ) {
    return this.missedClocksService.findAll(user.userId, query);
  }

  /**
   * 查詢待審核補打卡清單
   * GET /api/v1/missed-clocks/pending
   */
  @Get('pending')
  @UseGuards(RolesGuard)
  @Roles('MANAGER', 'ADMIN')
  async findPending(
    @CurrentUser() user: CurrentUserData,
    @Query() query: QueryPendingMissedClocksDto,
  ) {
    return this.missedClocksService.findPending(user, query);
  }

  /**
   * 查詢補打卡詳情
   * GET /api/v1/missed-clocks/:id
   */
  @Get(':id')
  async findOne(
    @CurrentUser() user: CurrentUserData,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.missedClocksService.findOne(id, user.userId, user.role);
  }

  /**
   * 核准補打卡
   * PUT /api/v1/missed-clocks/:id/approve
   */
  @Put(':id/approve')
  @UseGuards(RolesGuard)
  @Roles('MANAGER', 'ADMIN')
  async approve(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserData,
    @Body() dto: ApproveMissedClockDto,
  ) {
    return this.missedClocksService.approve(id, user, dto.comment);
  }

  /**
   * 駁回補打卡
   * PUT /api/v1/missed-clocks/:id/reject
   */
  @Put(':id/reject')
  @UseGuards(RolesGuard)
  @Roles('MANAGER', 'ADMIN')
  async reject(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserData,
    @Body() dto: RejectMissedClockDto,
  ) {
    return this.missedClocksService.reject(id, user, dto.comment);
  }
}
