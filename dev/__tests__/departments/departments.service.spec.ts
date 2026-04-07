import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus, NotFoundException } from '@nestjs/common';
import { DepartmentsService } from '../../src/departments/departments.service';
import { PrismaService } from '../../src/prisma/prisma.service';

describe('DepartmentsService', () => {
  let service: DepartmentsService;
  let prisma: {
    department: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
      count: jest.Mock;
    };
    user: {
      findUnique: jest.Mock;
    };
  };

  const mockDepartment = {
    id: 'dept-uuid-1',
    name: '工程部',
    code: 'ENG',
    managerId: null,
    parentId: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    manager: null,
    parent: null,
  };

  beforeEach(async () => {
    prisma = {
      department: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DepartmentsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<DepartmentsService>(DepartmentsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a department successfully', async () => {
      prisma.department.findUnique.mockResolvedValue(null); // no duplicates
      prisma.department.create.mockResolvedValue(mockDepartment);

      const result = await service.create({ name: '工程部', code: 'ENG' });

      expect(result.id).toBe('dept-uuid-1');
      expect(result.name).toBe('工程部');
      expect(result.code).toBe('ENG');
      expect(result.manager).toBeNull();
      expect(result.parent).toBeNull();
    });

    it('should throw DUPLICATE_NAME when name already exists', async () => {
      prisma.department.findUnique.mockResolvedValueOnce(mockDepartment); // name exists

      try {
        await service.create({ name: '工程部', code: 'ENG2' });
        fail('Expected exception');
      } catch (e) {
        const exception = e as HttpException;
        expect(exception.getStatus()).toBe(HttpStatus.CONFLICT);
        const response = exception.getResponse() as Record<string, string>;
        expect(response.code).toBe('DUPLICATE_NAME');
      }
    });

    it('should throw DUPLICATE_CODE when code already exists', async () => {
      prisma.department.findUnique
        .mockResolvedValueOnce(null) // name check passes
        .mockResolvedValueOnce(mockDepartment); // code exists

      try {
        await service.create({ name: '新部門', code: 'ENG' });
        fail('Expected exception');
      } catch (e) {
        const exception = e as HttpException;
        expect(exception.getStatus()).toBe(HttpStatus.CONFLICT);
        const response = exception.getResponse() as Record<string, string>;
        expect(response.code).toBe('DUPLICATE_CODE');
      }
    });

    it('should validate manager_id is an active user', async () => {
      prisma.department.findUnique.mockResolvedValue(null); // no duplicates
      prisma.user.findUnique.mockResolvedValue(null); // manager not found

      try {
        await service.create({
          name: '工程部',
          code: 'ENG',
          manager_id: 'nonexistent-uuid',
        });
        fail('Expected exception');
      } catch (e) {
        const exception = e as HttpException;
        expect(exception.getStatus()).toBe(HttpStatus.BAD_REQUEST);
      }
    });

    it('should validate parent_id exists', async () => {
      prisma.department.findUnique
        .mockResolvedValueOnce(null) // name check
        .mockResolvedValueOnce(null) // code check
        .mockResolvedValueOnce(null); // parent not found

      try {
        await service.create({
          name: '子部門',
          code: 'SUB',
          parent_id: 'nonexistent-parent',
        });
        fail('Expected exception');
      } catch (e) {
        const exception = e as HttpException;
        expect(exception.getStatus()).toBe(HttpStatus.BAD_REQUEST);
        const response = exception.getResponse() as Record<string, string>;
        expect(response.message).toContain('父部門不存在');
      }
    });

    it('should reject hierarchy deeper than 3 levels', async () => {
      // name check, code check pass
      prisma.department.findUnique
        .mockResolvedValueOnce(null) // name
        .mockResolvedValueOnce(null) // code
        .mockResolvedValueOnce({ id: 'level-2', parentId: 'level-1' }) // parent exists
        .mockResolvedValueOnce({ parentId: 'root' }) // depth traversal: level-2 -> level-1
        .mockResolvedValueOnce({ parentId: null }); // depth traversal: level-1 -> root (depth = 2)

      try {
        await service.create({
          name: '深層子部門',
          code: 'DEEP',
          parent_id: 'level-2',
        });
        fail('Expected exception');
      } catch (e) {
        const exception = e as HttpException;
        expect(exception.getStatus()).toBe(HttpStatus.BAD_REQUEST);
        const response = exception.getResponse() as Record<string, string>;
        expect(response.message).toContain('3 層');
      }
    });
  });

  describe('findAll', () => {
    it('should return paginated departments', async () => {
      const deptWithCount = {
        ...mockDepartment,
        _count: { members: 5 },
      };
      prisma.department.findMany.mockResolvedValue([deptWithCount]);
      prisma.department.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toHaveProperty('member_count', 5);
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
      expect(result.meta.totalPages).toBe(1);
    });

    it('should support search by name or code', async () => {
      prisma.department.findMany.mockResolvedValue([]);
      prisma.department.count.mockResolvedValue(0);

      await service.findAll({ search: '工程', page: 1, limit: 20 });

      expect(prisma.department.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { name: { contains: '工程', mode: 'insensitive' } },
              { code: { contains: '工程', mode: 'insensitive' } },
            ],
          },
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return department with members', async () => {
      const deptWithMembers = {
        ...mockDepartment,
        children: [],
        members: [
          {
            id: 'user-1',
            employeeId: 'EMP001',
            name: '王小明',
            email: 'wang@company.com',
            role: 'EMPLOYEE',
            status: 'ACTIVE',
          },
        ],
      };
      prisma.department.findUnique.mockResolvedValue(deptWithMembers);

      const result = await service.findOne('dept-uuid-1');

      expect(result.id).toBe('dept-uuid-1');
      expect(result.members).toHaveLength(1);
      expect(result.members[0].employee_id).toBe('EMP001');
      expect(result.members[0].role).toBe('employee');
      expect(result.member_count).toBe(1);
    });

    it('should throw NOT_FOUND when department does not exist', async () => {
      prisma.department.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update department name', async () => {
      prisma.department.findUnique
        .mockResolvedValueOnce(mockDepartment) // existing check
        .mockResolvedValueOnce(null); // name uniqueness check
      prisma.department.update.mockResolvedValue({
        ...mockDepartment,
        name: '新工程部',
      });

      const result = await service.update('dept-uuid-1', { name: '新工程部' });

      expect(result.name).toBe('新工程部');
    });

    it('should throw NOT_FOUND when department does not exist', async () => {
      prisma.department.findUnique.mockResolvedValue(null);

      await expect(
        service.update('nonexistent', { name: '新名稱' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw DUPLICATE_NAME when new name conflicts', async () => {
      prisma.department.findUnique
        .mockResolvedValueOnce(mockDepartment) // existing
        .mockResolvedValueOnce({ id: 'other-dept', name: '已存在部門' }); // conflict

      try {
        await service.update('dept-uuid-1', { name: '已存在部門' });
        fail('Expected exception');
      } catch (e) {
        const exception = e as HttpException;
        expect(exception.getStatus()).toBe(HttpStatus.CONFLICT);
        const response = exception.getResponse() as Record<string, string>;
        expect(response.code).toBe('DUPLICATE_NAME');
      }
    });

    it('should reject setting self as parent', async () => {
      prisma.department.findUnique.mockResolvedValueOnce(mockDepartment);

      try {
        await service.update('dept-uuid-1', { parent_id: 'dept-uuid-1' });
        fail('Expected exception');
      } catch (e) {
        const exception = e as HttpException;
        expect(exception.getStatus()).toBe(HttpStatus.BAD_REQUEST);
      }
    });
  });

  describe('remove', () => {
    it('should delete department with no members', async () => {
      prisma.department.findUnique.mockResolvedValue({
        ...mockDepartment,
        _count: { members: 0 },
      });
      prisma.department.delete.mockResolvedValue(mockDepartment);

      await service.remove('dept-uuid-1');

      expect(prisma.department.delete).toHaveBeenCalledWith({
        where: { id: 'dept-uuid-1' },
      });
    });

    it('should throw HAS_MEMBERS when department has employees', async () => {
      prisma.department.findUnique.mockResolvedValue({
        ...mockDepartment,
        _count: { members: 5 },
      });

      try {
        await service.remove('dept-uuid-1');
        fail('Expected exception');
      } catch (e) {
        const exception = e as HttpException;
        expect(exception.getStatus()).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
        const response = exception.getResponse() as Record<string, string>;
        expect(response.code).toBe('HAS_MEMBERS');
      }
    });

    it('should throw NOT_FOUND when department does not exist', async () => {
      prisma.department.findUnique.mockResolvedValue(null);

      await expect(service.remove('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
