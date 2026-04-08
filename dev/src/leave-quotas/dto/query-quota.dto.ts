import { IsOptional, IsInt, Min } from 'class-validator';

export class QueryQuotaDto {
  @IsOptional()
  @IsInt()
  @Min(2000)
  year?: number;
}
