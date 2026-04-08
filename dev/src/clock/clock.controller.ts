import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ClockService } from './clock.service';
import { ClockInDto } from './dto/clock-in.dto';
import { ClockOutDto } from './dto/clock-out.dto';
import { QueryClockRecordsDto } from './dto/query-clock-records.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserData } from '../auth/decorators/current-user.decorator';

@Controller('clock')
@UseGuards(JwtAuthGuard)
export class ClockController {
  constructor(private readonly clockService: ClockService) {}

  @Post('in')
  @HttpCode(HttpStatus.CREATED)
  async clockIn(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: ClockInDto,
  ) {
    return this.clockService.clockIn(user.userId, dto);
  }

  @Post('out')
  @HttpCode(HttpStatus.OK)
  async clockOut(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: ClockOutDto,
  ) {
    return this.clockService.clockOut(user.userId, dto);
  }

  @Get('today')
  async getToday(@CurrentUser() user: CurrentUserData) {
    return this.clockService.getToday(user.userId);
  }

  @Get('records')
  async getRecords(
    @CurrentUser() user: CurrentUserData,
    @Query() query: QueryClockRecordsDto,
  ) {
    return this.clockService.getRecords(user.userId, query);
  }
}
