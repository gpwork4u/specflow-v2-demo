import {
  Injectable,
  HttpException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { QueryEmployeeDto } from './dto/query-employee.dto';
import { PaginatedResult } from '../common/dto/pagination.dto';

const BCRYPT_ROUNDS = 10;

@Injectable()
export class EmployeesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 建立員工
   */
  async create(dto: CreateEmployeeDto) {
    // 檢查員工編號唯一
    const existingEmployeeId = await this.prisma.user.findUnique({
      where: { employeeId: dto.employee_id },
    });
    if (existingEmployeeId) {
      throw new HttpException(
        { code: 'DUPLICATE_EMPLOYEE_ID', message: '員工編號已存在' },
        HttpStatus.CONFLICT,
      );
    }

    // 檢查 email 唯一
    const existingEmail = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existingEmail) {
      throw new HttpException(
        { code: 'DUPLICATE_EMAIL', message: 'Email 已存在' },
        HttpStatus.CONFLICT,
      );
    }

    // 檢查部門是否存在
    const department = await this.prisma.department.findUnique({
      where: { id: dto.department_id },
    });
    if (!department) {
      throw new HttpException(
        { code: 'DEPARTMENT_NOT_FOUND', message: '部門不存在' },
        HttpStatus.NOT_FOUND,
      );
    }

    // 檢查 manager_id 必須是 role=MANAGER 的 User
    if (dto.manager_id) {
      const manager = await this.prisma.user.findUnique({
        where: { id: dto.manager_id },
        select: { id: true, role: true, status: true },
      });
      if (!manager) {
        throw new HttpException(
          { code: 'INVALID_INPUT', message: 'manager_id 對應的使用者不存在' },
          HttpStatus.BAD_REQUEST,
        );
      }
      if (manager.role !== 'MANAGER') {
        throw new HttpException(
          { code: 'INVALID_INPUT', message: 'manager_id 必須是 manager 角色的使用者' },
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    // Hash 密碼
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    const user = await this.prisma.user.create({
      data: {
        employeeId: dto.employee_id,
        email: dto.email,
        passwordHash,
        name: dto.name,
        role: dto.role.toUpperCase() as 'EMPLOYEE' | 'MANAGER' | 'ADMIN',
        departmentId: dto.department_id,
        managerId: dto.manager_id,
        hireDate: new Date(dto.hire_date),
      },
      include: {
        department: { select: { id: true, name: true } },
        manager: { select: { id: true, name: true, email: true } },
      },
    });

    return this.formatEmployee(user);
  }

  /**
   * 員工列表（含搜尋 + 篩選 + 分頁）
   */
  async findAll(query: QueryEmployeeDto): Promise<PaginatedResult<unknown>> {
    const { search, department_id, role, status, page = 1, limit = 20 } = query;

    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { employeeId: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (department_id) {
      where.departmentId = department_id;
    }

    if (role) {
      where.role = role.toUpperCase();
    }

    if (status) {
      where.status = status.toUpperCase();
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: {
          department: { select: { id: true, name: true } },
          manager: { select: { id: true, name: true, email: true } },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users.map((user) => this.formatEmployee(user)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * 員工詳情
   */
  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        department: { select: { id: true, name: true } },
        manager: { select: { id: true, name: true, email: true } },
      },
    });

    if (!user) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: '員工不存在',
      });
    }

    return this.formatEmployee(user);
  }

  /**
   * 更新員工（partial update，不含 password）
   */
  async update(id: string, dto: UpdateEmployeeDto) {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: '員工不存在',
      });
    }

    // 檢查 department_id
    if (dto.department_id) {
      const department = await this.prisma.department.findUnique({
        where: { id: dto.department_id },
      });
      if (!department) {
        throw new HttpException(
          { code: 'DEPARTMENT_NOT_FOUND', message: '部門不存在' },
          HttpStatus.NOT_FOUND,
        );
      }
    }

    // 檢查 manager_id
    if (dto.manager_id) {
      const manager = await this.prisma.user.findUnique({
        where: { id: dto.manager_id },
        select: { id: true, role: true },
      });
      if (!manager) {
        throw new HttpException(
          { code: 'INVALID_INPUT', message: 'manager_id 對應的使用者不存在' },
          HttpStatus.BAD_REQUEST,
        );
      }
      if (manager.role !== 'MANAGER') {
        throw new HttpException(
          { code: 'INVALID_INPUT', message: 'manager_id 必須是 manager 角色的使用者' },
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    const updateData: Record<string, unknown> = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.role !== undefined) updateData.role = dto.role.toUpperCase();
    if (dto.department_id !== undefined) updateData.departmentId = dto.department_id;
    if (dto.manager_id !== undefined) updateData.managerId = dto.manager_id;
    if (dto.status !== undefined) updateData.status = dto.status.toUpperCase();

    const user = await this.prisma.user.update({
      where: { id },
      data: updateData,
      include: {
        department: { select: { id: true, name: true } },
        manager: { select: { id: true, name: true, email: true } },
      },
    });

    return this.formatEmployee(user);
  }

  /**
   * 重設密碼
   */
  async resetPassword(id: string, dto: ResetPasswordDto) {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: '員工不存在',
      });
    }

    const passwordHash = await bcrypt.hash(dto.new_password, BCRYPT_ROUNDS);
    await this.prisma.user.update({
      where: { id },
      data: { passwordHash },
    });

    return { message: '密碼已重設' };
  }

  // ── Private Methods ──

  /**
   * 格式化員工輸出（排除敏感欄位）
   */
  private formatEmployee(user: {
    id: string;
    employeeId: string;
    email: string;
    name: string;
    role: string;
    status: string;
    hireDate: Date;
    createdAt: Date;
    department?: { id: string; name: string } | null;
    manager?: { id: string; name: string; email: string } | null;
  }) {
    return {
      id: user.id,
      employee_id: user.employeeId,
      email: user.email,
      name: user.name,
      role: user.role.toLowerCase(),
      department: user.department
        ? { id: user.department.id, name: user.department.name }
        : null,
      manager: user.manager
        ? { id: user.manager.id, name: user.manager.name, email: user.manager.email }
        : null,
      hire_date: user.hireDate.toISOString().split('T')[0],
      status: user.status.toLowerCase(),
      created_at: user.createdAt.toISOString(),
    };
  }
}
