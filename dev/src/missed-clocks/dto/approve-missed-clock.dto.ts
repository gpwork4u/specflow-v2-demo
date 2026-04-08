import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ApproveMissedClockDto {
  @IsOptional()
  @IsString({ message: 'comment 必須是字串' })
  @MaxLength(500, { message: 'comment 不得超過 500 字' })
  comment?: string;
}
