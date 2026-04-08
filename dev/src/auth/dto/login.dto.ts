import { IsEmail, IsString, MinLength, MaxLength } from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: 'email 格式不正確' })
  @MaxLength(255)
  email: string;

  @IsString()
  @MinLength(8, { message: '密碼長度至少 8 個字元' })
  @MaxLength(100, { message: '密碼長度不得超過 100 個字元' })
  password: string;
}
