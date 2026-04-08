import {
  IsString,
  IsDateString,
  Matches,
  MinLength,
  MaxLength,
} from 'class-validator';

export class CreateOvertimeDto {
  @IsDateString()
  date: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'start_time 必須為 HH:mm 格式',
  })
  start_time: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'end_time 必須為 HH:mm 格式',
  })
  end_time: string;

  @IsString()
  @MinLength(1, { message: 'reason 不可為空' })
  @MaxLength(500, { message: 'reason 不得超過 500 字' })
  reason: string;
}
