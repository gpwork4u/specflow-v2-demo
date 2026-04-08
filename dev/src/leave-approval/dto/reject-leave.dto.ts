import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class RejectLeaveDto {
  @IsString({ message: 'comment 必須是字串' })
  @IsNotEmpty({ message: '駁回必須填寫原因' })
  @MaxLength(500, { message: 'comment 不得超過 500 字' })
  comment: string;
}
