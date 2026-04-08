import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus, NotFoundException } from '@nestjs/common';
import { LeaveQuotasService } from '../../src/leave-quotas/leave-quotas.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { Prisma } from '@prisma/client';

const Decimal = Prisma.Decimal;

describe('LeaveQuotasService', () => {
  let service: LeaveQuotasService;
  let prisma: {
    user: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
    };
    leaveQuota: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      upsert: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  const mockUser = {
    id: 'user-uuid-1',
    employeeId: 'EMP001',
    email: 'wang@company.com',
    name: '王小明',
    role: 'EMPLOYEE',
    departmentId: 'dept-uuid-1',
    hireDate: new Date('2024-03-01'),
    status: 'ACTIVE',
  };

  const mockQuotas = [
    {
      id: 'quota-1',
      userId: 'user-uuid-1',
      leaveType: 'ANNUAL',
      year: 2026,
      totalHours: new Decimal(56),
      usedHours: new Decimal(16),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'quota-2',
      userId: 'user-uuid-1',
      leaveType: 'PERSONAL',
      year: 2026,
      totalHours: new Decimal(56),
      usedHours: new Decimal(0),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'quota-3',
      userId: 'user-uuid-1',
      leaveType: 'SICK',
      year: 2026,
      totalHours: new Decimal(240),
      usedHours: new Decimal(8),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      leaveQuota: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeaveQuotasService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<LeaveQuotasService>(LeaveQuotasService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getQuotas', () => {
    it('should return quotas for a user and year', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.leaveQuota.findMany.mockResolvedValue(mockQuotas);

      const result = await service.getQuotas('user-uuid-1', 2026);

      expect(result.user_id).toBe('user-uuid-1');
      expect(result.year).toBe(2026);
      expect(result.quotas).toHaveLength(3);

      const annual = result.quotas.find((q) => q.leave_type === 'annual');
      expect(annual).toBeDefined();
      expect(annual!.total_hours).toBe(56);
      expect(annual!.used_hours).toBe(16);
      expect(annual!.remaining_hours).toBe(40);
      expect(annual!.leave_type_label).toBe('特休');
    });

    it('should default to current year when year not provided', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.leaveQuota.findMany.mockResolvedValue([]);

      const result = await service.getQuotas('user-uuid-1');

      expect(result.year).toBe(new Date().getFullYear());
      expect(prisma.leaveQuota.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-uuid-1', year: new Date().getFullYear() },
        orderBy: { leaveType: 'asc' },
      });
    });

    it('should throw NOT_FOUND when user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getQuotas('nonexistent', 2026)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return empty quotas when no quotas exist for the year', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.leaveQuota.findMany.mockResolvedValue([]);

      const result = await service.getQuotas('user-uuid-1', 2025);

      expect(result.quotas).toHaveLength(0);
      expect(result.year).toBe(2025);
    });

    it('should include leave_type_label for all quota types', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.leaveQuota.findMany.mockResolvedValue([
        { ...mockQuotas[0], leaveType: 'SICK' },
        { ...mockQuotas[0], leaveType: 'OFFICIAL' },
      ]);

      const result = await service.getQuotas('user-uuid-1', 2026);

      expect(result.quotas[0].leave_type_label).toBe('病假');
      expect(result.quotas[1].leave_type_label).toBe('公假');
    });
  });

  describe('updateQuotas', () => {
    const updateDto = {
      year: 2026,
      quotas: [
        { leave_type: 'ANNUAL', total_hours: 120 },
        { leave_type: 'PERSONAL', total_hours: 56 },
      ],
    };

    it('should update quotas successfully', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.leaveQuota.findUnique.mockResolvedValue(null); // no existing quota
      prisma.$transaction.mockResolvedValue([
        { ...mockQuotas[0], totalHours: new Decimal(120), updatedAt: new Date('2026-04-07T10:00:00Z') },
        { ...mockQuotas[1], updatedAt: new Date('2026-04-07T10:00:00Z') },
      ]);
      prisma.leaveQuota.findMany.mockResolvedValue([
        { ...mockQuotas[0], totalHours: new Decimal(120) },
        { ...mockQuotas[1] },
      ]);

      const result = await service.updateQuotas('user-uuid-1', updateDto);

      expect(result.user_id).toBe('user-uuid-1');
      expect(result.year).toBe(2026);
      expect(result.quotas).toHaveLength(2);
      expect(result.updated_at).toBeDefined();
    });

    it('should throw NOT_FOUND when user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.updateQuotas('nonexistent', updateDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw QUOTA_BELOW_USED when total_hours < used_hours', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.leaveQuota.findUnique.mockResolvedValue({
        ...mockQuotas[0],
        usedHours: new Decimal(24),
      });

      const belowUsedDto = {
        year: 2026,
        quotas: [{ leave_type: 'ANNUAL', total_hours: 16 }],
      };

      try {
        await service.updateQuotas('user-uuid-1', belowUsedDto);
        fail('Expected exception');
      } catch (e) {
        const exception = e as HttpException;
        expect(exception.getStatus()).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
        const response = exception.getResponse() as Record<string, string>;
        expect(response.code).toBe('QUOTA_BELOW_USED');
      }
    });

    it('should allow setting total_hours equal to used_hours', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.leaveQuota.findUnique.mockResolvedValue({
        ...mockQuotas[0],
        usedHours: new Decimal(24),
      });
      prisma.$transaction.mockResolvedValue([
        { ...mockQuotas[0], totalHours: new Decimal(24), updatedAt: new Date() },
      ]);
      prisma.leaveQuota.findMany.mockResolvedValue([
        { ...mockQuotas[0], totalHours: new Decimal(24) },
      ]);

      const equalDto = {
        year: 2026,
        quotas: [{ leave_type: 'ANNUAL', total_hours: 24 }],
      };

      const result = await service.updateQuotas('user-uuid-1', equalDto);
      expect(result.user_id).toBe('user-uuid-1');
    });
  });

  describe('batchUpdateQuotas', () => {
    const batchDto = {
      year: 2026,
      department_id: 'dept-uuid-1',
      quotas: [{ leave_type: 'PERSONAL', total_hours: 56 }],
    };

    it('should batch update quotas for department', async () => {
      prisma.user.findMany.mockResolvedValue([
        { id: 'user-1' },
        { id: 'user-2' },
        { id: 'user-3' },
      ]);
      prisma.$transaction.mockResolvedValue([]);

      const result = await service.batchUpdateQuotas(batchDto);

      expect(result.updated_count).toBe(3);
      expect(result.year).toBe(2026);
      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: { departmentId: 'dept-uuid-1', status: 'ACTIVE' },
        select: { id: true },
      });
    });

    it('should batch update quotas for specific user_ids', async () => {
      prisma.$transaction.mockResolvedValue([]);

      const result = await service.batchUpdateQuotas({
        year: 2026,
        user_ids: ['user-1', 'user-2'],
        quotas: [{ leave_type: 'SICK', total_hours: 240 }],
      });

      expect(result.updated_count).toBe(2);
      expect(result.year).toBe(2026);
    });

    it('should throw INVALID_INPUT when neither department_id nor user_ids provided', async () => {
      const invalidDto = {
        year: 2026,
        quotas: [{ leave_type: 'PERSONAL', total_hours: 56 }],
      };

      try {
        await service.batchUpdateQuotas(invalidDto);
        fail('Expected exception');
      } catch (e) {
        const exception = e as HttpException;
        expect(exception.getStatus()).toBe(HttpStatus.BAD_REQUEST);
        const response = exception.getResponse() as Record<string, string>;
        expect(response.code).toBe('INVALID_INPUT');
      }
    });

    it('should return updated_count 0 when no users found in department', async () => {
      prisma.user.findMany.mockResolvedValue([]);

      const result = await service.batchUpdateQuotas(batchDto);

      expect(result.updated_count).toBe(0);
    });
  });

  describe('calculateAnnualHours', () => {
    it('should return 0 for less than 0.5 years', () => {
      const hireDate = new Date('2025-09-01');
      expect(service.calculateAnnualHours(hireDate, 2026)).toBe(0);
    });

    it('should return 24 for 0.5-1 years', () => {
      const hireDate = new Date('2025-03-01');
      expect(service.calculateAnnualHours(hireDate, 2026)).toBe(24);
    });

    it('should return 56 for 1-2 years', () => {
      const hireDate = new Date('2024-06-01');
      expect(service.calculateAnnualHours(hireDate, 2026)).toBe(56);
    });

    it('should return 80 for 2-3 years', () => {
      const hireDate = new Date('2023-06-01');
      expect(service.calculateAnnualHours(hireDate, 2026)).toBe(80);
    });

    it('should return 112 for 3-5 years', () => {
      const hireDate = new Date('2022-06-01');
      expect(service.calculateAnnualHours(hireDate, 2026)).toBe(112);
    });

    it('should return 120 for 5-10 years', () => {
      const hireDate = new Date('2019-06-01');
      expect(service.calculateAnnualHours(hireDate, 2026)).toBe(120);
    });

    it('should return 128 for exactly 10 years', () => {
      const hireDate = new Date('2016-01-01');
      expect(service.calculateAnnualHours(hireDate, 2026)).toBe(128);
    });

    it('should cap at 240 for very long tenure', () => {
      const hireDate = new Date('1980-01-01');
      expect(service.calculateAnnualHours(hireDate, 2026)).toBe(240);
    });
  });

  describe('createDefaultQuotas', () => {
    it('should create default quotas for all leave types', async () => {
      prisma.$transaction.mockResolvedValue([]);

      await service.createDefaultQuotas(
        'user-uuid-1',
        new Date('2024-03-01'),
        2026,
      );

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      // Should create 8 leave types
      const operations = prisma.$transaction.mock.calls[0][0];
      expect(operations).toHaveLength(8);
    });

    it('should default to current year when year not provided', async () => {
      prisma.$transaction.mockResolvedValue([]);

      await service.createDefaultQuotas(
        'user-uuid-1',
        new Date('2024-03-01'),
      );

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });
  });
});
