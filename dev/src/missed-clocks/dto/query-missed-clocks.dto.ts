import { IsOptional, IsString, IsIn, IsInt, Min, Max } from 'class-validator';

export class QueryMissedClocksDto {
  @IsOptional()
  @IsString({ message: 'status 必須是字串' })
  @IsIn(['pending', 'approved', 'rejected'], { message: 'status 必須是 pending, approved 或 rejected' })
  status?: string;

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
