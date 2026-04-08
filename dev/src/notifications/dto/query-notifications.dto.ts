import {
  IsOptional,
  IsBoolean,
  IsInt,
  Min,
  Max,
} from 'class-validator';

export class QueryNotificationsDto {
  @IsOptional()
  @IsBoolean()
  is_read?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;
}
