import { IsString, MinLength, MaxLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  @MinLength(8, { message: '密碼長度至少 8 個字元' })
  current_password: string;

  @IsString()
  @MinLength(8, { message: '新密碼長度至少 8 個字元' })
  @MaxLength(100, { message: '新密碼長度不得超過 100 個字元' })
  new_password: string;
}
