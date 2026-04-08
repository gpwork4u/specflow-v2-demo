import { IsString, IsNotEmpty, IsIn, MaxLength, MinLength, Matches } from 'class-validator';

export class CreateMissedClockDto {
  @IsString({ message: 'date 必須是字串' })
  @IsNotEmpty({ message: 'date 為必填' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date 格式必須為 YYYY-MM-DD' })
  date: string;

  @IsString({ message: 'clock_type 必須是字串' })
  @IsIn(['clock_in', 'clock_out'], { message: 'clock_type 必須是 clock_in 或 clock_out' })
  clock_type: string;

  @IsString({ message: 'requested_time 必須是字串' })
  @IsNotEmpty({ message: 'requested_time 為必填' })
  requested_time: string;

  @IsString({ message: 'reason 必須是字串' })
  @IsNotEmpty({ message: 'reason 為必填' })
  @MinLength(1, { message: 'reason 不得為空' })
  @MaxLength(500, { message: 'reason 不得超過 500 字' })
  reason: string;
}
