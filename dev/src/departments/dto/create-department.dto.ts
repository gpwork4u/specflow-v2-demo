import {
  IsString,
  IsOptional,
  IsUUID,
  MaxLength,
  Matches,
} from 'class-validator';

export class CreateDepartmentDto {
  @IsString()
  @MaxLength(100)
  name: string;

  @IsString()
  @MaxLength(20)
  @Matches(/^[a-zA-Z0-9-]+$/, {
    message: '部門代碼僅允許英數字和連字號',
  })
  code: string;

  @IsOptional()
  @IsUUID()
  manager_id?: string;

  @IsOptional()
  @IsUUID()
  parent_id?: string;
}
