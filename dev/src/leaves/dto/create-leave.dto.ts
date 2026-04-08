import {
  IsString,
  IsEnum,
  IsDateString,
  IsOptional,
  MinLength,
  MaxLength,
} from 'class-validator';

export enum LeaveTypeEnum {
  PERSONAL = 'personal',
  SICK = 'sick',
  ANNUAL = 'annual',
  MARRIAGE = 'marriage',
  BEREAVEMENT = 'bereavement',
  MATERNITY = 'maternity',
  PATERNITY = 'paternity',
  OFFICIAL = 'official',
}

export enum HalfDayEnum {
  FULL = 'full',
  MORNING = 'morning',
  AFTERNOON = 'afternoon',
}

export class CreateLeaveDto {
  @IsEnum(LeaveTypeEnum)
  leave_type: LeaveTypeEnum;

  @IsDateString()
  start_date: string;

  @IsDateString()
  end_date: string;

  @IsOptional()
  @IsEnum(HalfDayEnum)
  start_half?: HalfDayEnum = HalfDayEnum.FULL;

  @IsOptional()
  @IsEnum(HalfDayEnum)
  end_half?: HalfDayEnum = HalfDayEnum.FULL;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason: string;
}
