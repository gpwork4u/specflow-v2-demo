import {
  Injectable,
  HttpException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { QueryDepartmentDto } from './dto/query-department.dto';
import { PaginatedResult } from '../common/dto/pagination.dto';

@Injectable()
export class DepartmentsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 建立部門
   */
  async create(dto: CreateDepartmentDto) {
    // 檢查名稱唯一
    const existingName = await this.prisma.department.findUnique({
      where: { name: dto.name },
    });
    if (existingName) {
      throw new HttpException(
        { code: 'DUPLICATE_NAME', message: '部門名稱已存在' },
        HttpStatus.CONFLICT,
      );
    }

    // 檢查代碼唯一
    const existingCode = await this.prisma.department.findUnique({
      where: { code: dto.code },
    });
    if (existingCode) {
      throw new HttpException(
        { code: 'DUPLICATE_CODE', message: '部門代碼已存在' },
        HttpStatus.CONFLICT,
      );
    }

    // 檢查 manager_id 是否為 active 的 User
    if (dto.manager_id) {
      const manager = await this.prisma.user.findUnique({
        where: { id: dto.manager_id },
        select: { id: true, status: true },
      });
      if (!manager || manager.status !== 'ACTIVE') {
        throw new HttpException(
          { code: 'INVALID_INPUT', message: 'manager_id 對應的使用者不存在或非活躍狀態' },
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    // 檢查 parent_id 是否存在，且階層不超過 3 層
    if (dto.parent_id) {
      const parentDept = await this.prisma.department.findUnique({
        where: { id: dto.parent_id },
      });
      if (!parentDept) {
        throw new HttpException(
          { code: 'INVALID_INPUT', message: '父部門不存在' },
          HttpStatus.BAD_REQUEST,
        );
      }

      const depth = await this.getDepartmentDepth(dto.parent_id);
      if (depth >= 2) {
        throw new HttpException(
          { code: 'INVALID_INPUT', message: '部門階層不可超過 3 層' },
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    const department = await this.prisma.department.create({
      data: {
        name: dto.name,
        code: dto.code,
        managerId: dto.manager_id,
        parentId: dto.parent_id,
      },
      include: {
        manager: { select: { id: true, name: true, email: true } },
        parent: { select: { id: true, name: true, code: true } },
      },
    });

    return this.formatDepartment(department);
  }

  /**
   * 部門列表（含搜尋 + 分頁）
   */
  async findAll(query: QueryDepartmentDto): Promise<PaginatedResult<unknown>> {
    const { search, page = 1, limit = 20 } = query;

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [departments, total] = await Promise.all([
      this.prisma.department.findMany({
        where,
        include: {
          manager: { select: { id: true, name: true, email: true } },
          parent: { select: { id: true, name: true, code: true } },
          _count: { select: { members: true } },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.department.count({ where }),
    ]);

    return {
      data: departments.map((dept) => ({
        id: dept.id,
        name: dept.name,
        code: dept.code,
        manager: dept.manager
          ? { id: dept.manager.id, name: dept.manager.name, email: dept.manager.email }
          : null,
        parent: dept.parent
          ? { id: dept.parent.id, name: dept.parent.name, code: dept.parent.code }
          : null,
        member_count: dept._count.members,
        created_at: dept.createdAt.toISOString(),
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * 部門詳情含 members
   */
  async findOne(id: string) {
    const department = await this.prisma.department.findUnique({
      where: { id },
      include: {
        manager: { select: { id: true, name: true, email: true } },
        parent: { select: { id: true, name: true, code: true } },
        children: { select: { id: true, name: true, code: true } },
        members: {
          select: {
            id: true,
            employeeId: true,
            name: true,
            email: true,
            role: true,
            status: true,
          },
        },
      },
    });

    if (!department) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: '部門不存在',
      });
    }

    return {
      id: department.id,
      name: department.name,
      code: department.code,
      manager: department.manager
        ? { id: department.manager.id, name: department.manager.name, email: department.manager.email }
        : null,
      parent: department.parent
        ? { id: department.parent.id, name: department.parent.name, code: department.parent.code }
        : null,
      children: department.children.map((c) => ({
        id: c.id,
        name: c.name,
        code: c.code,
      })),
      members: department.members.map((m) => ({
        id: m.id,
        employee_id: m.employeeId,
        name: m.name,
        email: m.email,
        role: m.role.toLowerCase(),
        status: m.status.toLowerCase(),
      })),
      member_count: department.members.length,
      created_at: department.createdAt.toISOString(),
    };
  }

  /**
   * 更新部門（partial update）
   */
  async update(id: string, dto: UpdateDepartmentDto) {
    const existing = await this.prisma.department.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: '部門不存在',
      });
    }

    // 檢查名稱唯一（排除自己）
    if (dto.name && dto.name !== existing.name) {
      const existingName = await this.prisma.department.findUnique({
        where: { name: dto.name },
      });
      if (existingName) {
        throw new HttpException(
          { code: 'DUPLICATE_NAME', message: '部門名稱已存在' },
          HttpStatus.CONFLICT,
        );
      }
    }

    // 檢查代碼唯一（排除自己）
    if (dto.code && dto.code !== existing.code) {
      const existingCode = await this.prisma.department.findUnique({
        where: { code: dto.code },
      });
      if (existingCode) {
        throw new HttpException(
          { code: 'DUPLICATE_CODE', message: '部門代碼已存在' },
          HttpStatus.CONFLICT,
        );
      }
    }

    // 檢查 manager_id
    if (dto.manager_id) {
      const manager = await this.prisma.user.findUnique({
        where: { id: dto.manager_id },
        select: { id: true, status: true },
      });
      if (!manager || manager.status !== 'ACTIVE') {
        throw new HttpException(
          { code: 'INVALID_INPUT', message: 'manager_id 對應的使用者不存在或非活躍狀態' },
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    // 檢查 parent_id 階層
    if (dto.parent_id) {
      if (dto.parent_id === id) {
        throw new HttpException(
          { code: 'INVALID_INPUT', message: '部門不可將自己設為父部門' },
          HttpStatus.BAD_REQUEST,
        );
      }

      const parentDept = await this.prisma.department.findUnique({
        where: { id: dto.parent_id },
      });
      if (!parentDept) {
        throw new HttpException(
          { code: 'INVALID_INPUT', message: '父部門不存在' },
          HttpStatus.BAD_REQUEST,
        );
      }

      const depth = await this.getDepartmentDepth(dto.parent_id);
      if (depth >= 2) {
        throw new HttpException(
          { code: 'INVALID_INPUT', message: '部門階層不可超過 3 層' },
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    const updateData: Record<string, unknown> = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.code !== undefined) updateData.code = dto.code;
    if (dto.manager_id !== undefined) updateData.managerId = dto.manager_id;
    if (dto.parent_id !== undefined) updateData.parentId = dto.parent_id;

    const department = await this.prisma.department.update({
      where: { id },
      data: updateData,
      include: {
        manager: { select: { id: true, name: true, email: true } },
        parent: { select: { id: true, name: true, code: true } },
      },
    });

    return this.formatDepartment(department);
  }

  /**
   * 刪除部門（有員工時不可刪）
   */
  async remove(id: string) {
    const department = await this.prisma.department.findUnique({
      where: { id },
      include: { _count: { select: { members: true } } },
    });

    if (!department) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: '部門不存在',
      });
    }

    if (department._count.members > 0) {
      throw new HttpException(
        { code: 'HAS_MEMBERS', message: '部門仍有員工，無法刪除，請先轉移員工' },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    await this.prisma.department.delete({ where: { id } });
  }

  // ── Private Methods ──

  /**
   * 取得部門的階層深度（0 = 根部門）
   */
  private async getDepartmentDepth(departmentId: string): Promise<number> {
    let depth = 0;
    let currentId: string | null = departmentId;

    while (currentId) {
      const dept = await this.prisma.department.findUnique({
        where: { id: currentId },
        select: { parentId: true },
      });
      if (!dept || !dept.parentId) break;
      depth++;
      currentId = dept.parentId;
    }

    return depth;
  }

  /**
   * 格式化部門輸出
   */
  private formatDepartment(department: {
    id: string;
    name: string;
    code: string;
    createdAt: Date;
    manager?: { id: string; name: string; email: string } | null;
    parent?: { id: string; name: string; code: string } | null;
  }) {
    return {
      id: department.id,
      name: department.name,
      code: department.code,
      manager: department.manager
        ? { id: department.manager.id, name: department.manager.name, email: department.manager.email }
        : null,
      parent: department.parent
        ? { id: department.parent.id, name: department.parent.name, code: department.parent.code }
        : null,
      created_at: department.createdAt.toISOString(),
    };
  }
}
