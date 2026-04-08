import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CalendarService } from './calendar.service';
import { QueryPersonalCalendarDto, QueryTeamCalendarDto } from './dto/query-calendar.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, CurrentUserData } from '../auth/decorators/current-user.decorator';

@Controller('calendar')
@UseGuards(JwtAuthGuard)
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @Get('personal')
  async getPersonalCalendar(
    @CurrentUser() user: CurrentUserData,
    @Query() query: QueryPersonalCalendarDto,
  ) {
    return this.calendarService.getPersonalCalendar(user.userId, query);
  }

  @Get('team')
  @UseGuards(RolesGuard)
  @Roles('MANAGER', 'ADMIN')
  async getTeamCalendar(
    @CurrentUser() user: CurrentUserData,
    @Query() query: QueryTeamCalendarDto,
  ) {
    return this.calendarService.getTeamCalendar(
      user.userId,
      user.role,
      user.departmentId,
      query,
    );
  }
}
