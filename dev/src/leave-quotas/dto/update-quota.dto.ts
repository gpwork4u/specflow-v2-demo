import {
  IsInt,
  IsArray,
  ValidateNested,
  IsEnum,
  IsNumber,
  Min,
  ArrayMinSize,
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

export class QuotaItemDto {
  @IsEnum(LeaveTypeEnum, { message: 'leave_type 必須是有效的假別' })
  leave_type: string;

  @IsNumber({}, { message: 'total_hours 必須是數字' })
  @Min(0, { message: 'total_hours 不得為負數' })
  total_hours: number;
}

export class UpdateQuotaDto {
  @IsInt({ message: 'year 必須是整數' })
  @Min(2000, { message: 'year 必須大於 2000' })
  year: number;

  @IsArray()
  @ArrayMinSize(1, { message: '至少需要一筆額度設定' })
  @ValidateNested({ each: true })
  @Type(() => QuotaItemDto)
  quotas: QuotaItemDto[];
}
