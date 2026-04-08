import {
  IsInt,
  IsArray,
  ValidateNested,
  IsOptional,
  IsString,
  IsUUID,
  ArrayMinSize,
  IsEnum,
  IsNumber,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

enum LeaveTypeEnum {
  PERSONAL = 'PERSONAL',
  SICK = 'SICK',
  ANNUAL = 'ANNUAL',
  MARRIAGE = 'MARRIAGE',
  BEREAVEMENT = 'BEREAVEMENT',
  MATERNITY = 'MATERNITY',
  PATERNITY = 'PATERNITY',
  OFFICIAL = 'OFFICIAL',
}

export class BatchQuotaItemDto {
  @IsEnum(LeaveTypeEnum, { message: 'leave_type 必須是有效的假別' })
  leave_type: string;

  @IsNumber({}, { message: 'total_hours 必須是數字' })
  @Min(0, { message: 'total_hours 不得為負數' })
  total_hours: number;
}

export class BatchQuotaDto {
  @IsInt({ message: 'year 必須是整數' })
  @Min(2000, { message: 'year 必須大於 2000' })
  year: number;

  @IsOptional()
  @IsString()
  @IsUUID()
  department_id?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  user_ids?: string[];

  @IsArray()
  @ArrayMinSize(1, { message: '至少需要一筆額度設定' })
  @ValidateNested({ each: true })
  @Type(() => BatchQuotaItemDto)
  quotas: BatchQuotaItemDto[];
}
