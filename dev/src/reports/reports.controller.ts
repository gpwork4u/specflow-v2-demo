import {
  Controller,
  Get,
  Query,
  UseGuards,
  Res,
  ForbiddenException,
} from '@nestjs/common';
import { Response } from 'express';
import { ReportsService } from './reports.service';
import { QueryReportDto } from './dto/query-report.dto';
import { QueryTeamReportDto } from './dto/query-team-report.dto';
import { ExportReportDto } from './dto/export-report.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import {
  CurrentUser,
  CurrentUserData,
} from '../auth/decorators/current-user.decorator';

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('personal')
  async getPersonalReport(
    @CurrentUser() user: CurrentUserData,
    @Query() query: QueryReportDto,
  ) {
    return this.reportsService.getPersonalReport(
      user.userId,
      query.year,
      query.month,
    );
  }

  @Get('team')
  @Roles('MANAGER', 'ADMIN')
  async getTeamReport(
    @CurrentUser() user: CurrentUserData,
    @Query() query: QueryTeamReportDto,
  ) {
    return this.reportsService.getTeamReport(
      user,
      query.year,
      query.month,
      query.department_id,
    );
  }

  @Get('company')
  @Roles('ADMIN')
  async getCompanyReport(@Query() query: QueryReportDto) {
    return this.reportsService.getCompanyReport(query.year, query.month);
  }

  @Get('export')
  @Roles('MANAGER', 'ADMIN')
  async exportReport(
    @CurrentUser() user: CurrentUserData,
    @Query() query: ExportReportDto,
    @Res() res: Response,
  ) {
    // Admin 才能匯出 company scope
    if (query.scope === 'company' && user.role !== 'ADMIN') {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: '權限不足',
      });
    }

    const csv = await this.reportsService.exportReport(
      user,
      query.year,
      query.month,
      query.scope,
      query.department_id,
    );

    const filename = `report_${query.scope}_${query.year}_${query.month}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"`,
    );
    // 加入 BOM 讓 Excel 正確顯示中文
    res.send('\uFEFF' + csv);
  }
}
