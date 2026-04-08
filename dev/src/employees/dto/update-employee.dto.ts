import {
  IsString,
  IsOptional,
  IsUUID,
  IsEnum,
  MaxLength,
} from 'class-validator';

export enum UpdateRoleEnum {
  EMPLOYEE = 'employee',
  MANAGER = 'manager',
  ADMIN = 'admin',
}

export enum StatusEnum {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
}

export class UpdateEmployeeDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsEnum(UpdateRoleEnum)
  role?: UpdateRoleEnum;

  @IsOptional()
  @IsUUID()
  department_id?: string;

  @IsOptional()
  @IsUUID()
  manager_id?: string;

  @IsOptional()
  @IsEnum(StatusEnum)
  status?: StatusEnum;
}
