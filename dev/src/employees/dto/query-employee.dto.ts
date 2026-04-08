import { IsOptional, IsString, IsUUID, IsEnum } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class QueryEmployeeDto extends PaginationDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsUUID()
  department_id?: string;

  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  @IsString()
  status?: string;
}
