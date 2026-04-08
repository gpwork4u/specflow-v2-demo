import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { QueryReportDto } from './query-report.dto';

export class ExportReportDto extends QueryReportDto {
  @IsEnum(['team', 'company'])
  scope!: 'team' | 'company';

  @IsOptional()
  @IsUUID()
  department_id?: string;

  @IsOptional()
  @IsEnum(['csv', 'xlsx'])
  format?: 'csv' | 'xlsx' = 'csv';
}
