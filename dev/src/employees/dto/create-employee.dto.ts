import {
  IsString,
  IsEmail,
  IsOptional,
  IsUUID,
  IsEnum,
  IsDateString,
  MaxLength,
  MinLength,
} from 'class-validator';

export enum RoleEnum {
  EMPLOYEE = 'employee',
  MANAGER = 'manager',
  ADMIN = 'admin',
}

export class CreateEmployeeDto {
  @IsString()
  @MaxLength(20)
  employee_id: string;

  @IsEmail()
  @MaxLength(255)
  email: string;

  @IsString()
  @MinLength(8)
  @MaxLength(100)
  password: string;

  @IsString()
  @MaxLength(100)
  name: string;

  @IsEnum(RoleEnum)
  role: RoleEnum;

  @IsUUID()
  department_id: string;

  @IsOptional()
  @IsUUID()
  manager_id?: string;

  @IsDateString()
  hire_date: string;
}
