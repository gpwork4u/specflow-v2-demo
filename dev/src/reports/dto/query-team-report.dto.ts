import { IsOptional, IsUUID } from 'class-validator';
import { QueryReportDto } from './query-report.dto';

export class QueryTeamReportDto extends QueryReportDto {
  @IsOptional()
  @IsUUID()
  department_id?: string;
}
