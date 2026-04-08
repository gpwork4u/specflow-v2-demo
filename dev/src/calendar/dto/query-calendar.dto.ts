import { IsInt, Min, Max, IsOptional, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryPersonalCalendarDto {
  @Type(() => Number)
  @IsInt()
  @Min(2020)
  @Max(2099)
  year: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month: number;
}

export class QueryTeamCalendarDto {
  @Type(() => Number)
  @IsInt()
  @Min(2020)
  @Max(2099)
  year: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month: number;

  @IsOptional()
  @IsUUID()
  department_id?: string;
}
