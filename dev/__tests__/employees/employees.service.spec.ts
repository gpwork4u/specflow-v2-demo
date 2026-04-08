import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus, NotFoundException } from '@nestjs/common';
import { EmployeesService } from '../../src/employees/employees.service';
import { PrismaService } from '../../src/prisma/prisma.service';

// Mock bcrypt
jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('$2b$10$hashedPassword'),
  compare: jest.fn(),
}));

describe('EmployeesService', () => {
  let service: EmployeesService;
  let prisma: {
    user: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      count: jest.Mock;
    };
    department: {
      findUnique: jest.Mock;
    };
  };

  const mockDepartment = {
    id: 'dept-uuid-1',
    name: '工程部',
    code: 'ENG',
  };

  const mockUser = {
    id: 'user-uuid-1',
    employeeId: 'EMP001',
    email: 'wang@company.com',
    passwordHash: '$2b$10$hashedPassword',
    name: '王小明',
    role: 'EMPLOYEE',
    departmentId: 'dept-uuid-1',
    managerId: null,
    hireDate: new Date('2024-03-01'),
    status: 'ACTIVE',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    department: { id: 'dept-uuid-1', name: '工程部' },
    manager: null,
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      department: {
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmployeesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<EmployeesService>(EmployeesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto = {
      employee_id: 'EMP001',
      email: 'wang@company.com',
      password: 'initPass123',
      name: '王小明',
      role: 'employee' as const,
      department_id: 'dept-uuid-1',
      hire_date: '2024-03-01',
    };

    it('should create an employee successfully', async () => {
      prisma.user.findUnique
        .mockResolvedValueOnce(null) // employee_id check
        .mockResolvedValueOnce(null); // email check
      prisma.department.findUnique.mockResolvedValue(mockDepartment);
      prisma.user.create.mockResolvedValue(mockUser);

      const result = await service.create(createDto);

      expect(result.id).toBe('user-uuid-1');
      expect(result.employee_id).toBe('EMP001');
      expect(result.email).toBe('wang@company.com');
      expect(result.name).toBe('王小明');
      expect(result.role).toBe('employee');
      expect(result.status).toBe('active');
      expect(result.department).toEqual({ id: 'dept-uuid-1', name: '工程部' });
      expect(result.hire_date).toBe('2024-03-01');
    });

    it('should throw DUPLICATE_EMPLOYEE_ID when employee_id exists', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(mockUser); // employee_id exists

      try {
        await service.create(createDto);
        fail('Expected exception');
      } catch (e) {
        const exception = e as HttpException;
        expect(exception.getStatus()).toBe(HttpStatus.CONFLICT);
        const response = exception.getResponse() as Record<string, string>;
        expect(response.code).toBe('DUPLICATE_EMPLOYEE_ID');
      }
    });

    it('should throw DUPLICATE_EMAIL when email exists', async () => {
      prisma.user.findUnique
        .mockResolvedValueOnce(null) // employee_id OK
        .mockResolvedValueOnce(mockUser); // email exists

      try {
        await service.create(createDto);
        fail('Expected exception');
      } catch (e) {
        const exception = e as HttpException;
        expect(exception.getStatus()).toBe(HttpStatus.CONFLICT);
        const response = exception.getResponse() as Record<string, string>;
        expect(response.code).toBe('DUPLICATE_EMAIL');
      }
    });

    it('should throw DEPARTMENT_NOT_FOUND when department does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null); // no duplicates
      prisma.department.findUnique.mockResolvedValue(null); // dept not found

      try {
        await service.create(createDto);
        fail('Expected exception');
      } catch (e) {
        const exception = e as HttpException;
        expect(exception.getStatus()).toBe(HttpStatus.NOT_FOUND);
        const response = exception.getResponse() as Record<string, string>;
        expect(response.code).toBe('DEPARTMENT_NOT_FOUND');
      }
    });

    it('should throw INVALID_INPUT when manager_id is not a manager role', async () => {
      prisma.user.findUnique
        .mockResolvedValueOnce(null) // employee_id check
        .mockResolvedValueOnce(null) // email check
        .mockResolvedValueOnce({ id: 'emp-user', role: 'EMPLOYEE', status: 'ACTIVE' }); // manager check
      prisma.department.findUnique.mockResolvedValue(mockDepartment);

      try {
        await service.create({
          ...createDto,
          manager_id: 'emp-user',
        });
        fail('Expected exception');
      } catch (e) {
        const exception = e as HttpException;
        expect(exception.getStatus()).toBe(HttpStatus.BAD_REQUEST);
        const response = exception.getResponse() as Record<string, string>;
        expect(response.code).toBe('INVALID_INPUT');
        expect(response.message).toContain('manager');
      }
    });

    it('should accept valid manager_id with manager role', async () => {
      const managerUser = {
        id: 'manager-uuid',
        role: 'MANAGER',
        status: 'ACTIVE',
      };
      prisma.user.findUnique
        .mockResolvedValueOnce(null) // employee_id
        .mockResolvedValueOnce(null) // email
        .mockResolvedValueOnce(managerUser); // manager check
      prisma.department.findUnique.mockResolvedValue(mockDepartment);
      prisma.user.create.mockResolvedValue({
        ...mockUser,
        managerId: 'manager-uuid',
        manager: { id: 'manager-uuid', name: '主管', email: 'mgr@company.com' },
      });

      const result = await service.create({
        ...createDto,
        manager_id: 'manager-uuid',
      });

      expect(result.manager).toEqual({
        id: 'manager-uuid',
        name: '主管',
        email: 'mgr@company.com',
      });
    });
  });

  describe('findAll', () => {
    it('should return paginated employee list', async () => {
      prisma.user.findMany.mockResolvedValue([mockUser]);
      prisma.user.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toHaveProperty('employee_id', 'EMP001');
      expect(result.meta.total).toBe(1);
    });

    it('should support search by name, email, or employee_id', async () => {
      prisma.user.findMany.mockResolvedValue([]);
      prisma.user.count.mockResolvedValue(0);

      await service.findAll({ search: '王小明', page: 1, limit: 20 });

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { name: { contains: '王小明', mode: 'insensitive' } },
              { email: { contains: '王小明', mode: 'insensitive' } },
              { employeeId: { contains: '王小明', mode: 'insensitive' } },
            ],
          },
        }),
      );
    });

    it('should filter by department_id', async () => {
      prisma.user.findMany.mockResolvedValue([]);
      prisma.user.count.mockResolvedValue(0);

      await service.findAll({
        department_id: 'dept-uuid-1',
        page: 1,
        limit: 20,
      });

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { departmentId: 'dept-uuid-1' },
        }),
      );
    });

    it('should filter by role', async () => {
      prisma.user.findMany.mockResolvedValue([]);
      prisma.user.count.mockResolvedValue(0);

      await service.findAll({ role: 'admin', page: 1, limit: 20 });

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { role: 'ADMIN' },
        }),
      );
    });

    it('should filter by status', async () => {
      prisma.user.findMany.mockResolvedValue([]);
      prisma.user.count.mockResolvedValue(0);

      await service.findAll({ status: 'active', page: 1, limit: 20 });

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'ACTIVE' },
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return employee details', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.findOne('user-uuid-1');

      expect(result.id).toBe('user-uuid-1');
      expect(result.employee_id).toBe('EMP001');
      expect(result.role).toBe('employee');
    });

    it('should throw NOT_FOUND when employee does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update employee name', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser); // existing check
      prisma.user.update.mockResolvedValue({
        ...mockUser,
        name: '王大明',
      });

      const result = await service.update('user-uuid-1', { name: '王大明' });

      expect(result.name).toBe('王大明');
    });

    it('should update employee status to inactive', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.user.update.mockResolvedValue({
        ...mockUser,
        status: 'INACTIVE',
      });

      const result = await service.update('user-uuid-1', {
        status: 'inactive' as const,
      });

      expect(result.status).toBe('inactive');
    });

    it('should throw NOT_FOUND when employee does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.update('nonexistent', { name: '新名稱' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw DEPARTMENT_NOT_FOUND when new department does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.department.findUnique.mockResolvedValue(null);

      try {
        await service.update('user-uuid-1', {
          department_id: 'nonexistent-dept',
        });
        fail('Expected exception');
      } catch (e) {
        const exception = e as HttpException;
        expect(exception.getStatus()).toBe(HttpStatus.NOT_FOUND);
        const response = exception.getResponse() as Record<string, string>;
        expect(response.code).toBe('DEPARTMENT_NOT_FOUND');
      }
    });

    it('should validate manager_id must be manager role', async () => {
      prisma.user.findUnique
        .mockResolvedValueOnce(mockUser) // existing check
        .mockResolvedValueOnce({ id: 'emp-user', role: 'EMPLOYEE' }); // manager check

      try {
        await service.update('user-uuid-1', { manager_id: 'emp-user' });
        fail('Expected exception');
      } catch (e) {
        const exception = e as HttpException;
        expect(exception.getStatus()).toBe(HttpStatus.BAD_REQUEST);
        const response = exception.getResponse() as Record<string, string>;
        expect(response.code).toBe('INVALID_INPUT');
      }
    });
  });

  describe('resetPassword', () => {
    it('should reset password successfully', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.user.update.mockResolvedValue(mockUser);

      const result = await service.resetPassword('user-uuid-1', {
        new_password: 'newSecurePass123',
      });

      expect(result.message).toBe('密碼已重設');
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-uuid-1' },
        data: { passwordHash: '$2b$10$hashedPassword' },
      });
    });

    it('should throw NOT_FOUND when employee does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.resetPassword('nonexistent', {
          new_password: 'newPass123',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
