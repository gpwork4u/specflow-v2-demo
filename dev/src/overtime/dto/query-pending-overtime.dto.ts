import { IsOptional, IsUUID, IsInt, Min, Max } from 'class-validator';

export class QueryPendingOvertimeDto {
  @IsOptional()
  @IsUUID('4', { message: 'department_id 必須是有效的 UUID' })
  department_id?: string;

  @IsOptional()
  @IsInt({ message: 'page 必須是整數' })
  @Min(1, { message: 'page 必須 >= 1' })
  page?: number;

  @IsOptional()
  @IsInt({ message: 'limit 必須是整數' })
  @Min(1, { message: 'limit 必須 >= 1' })
  @Max(50, { message: 'limit 不得超過 50' })
  limit?: number;
}
