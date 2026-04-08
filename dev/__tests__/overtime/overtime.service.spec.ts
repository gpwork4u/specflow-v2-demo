import { Test, TestingModule } from '@nestjs/testing';
import {
  HttpException,
  HttpStatus,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { OvertimeService } from '../../src/overtime/overtime.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { Prisma } from '@prisma/client';

const Decimal = Prisma.Decimal;

describe('OvertimeService', () => {
  let service: OvertimeService;
  let prisma: {
    overtimeRequest: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
      count: jest.Mock;
      aggregate: jest.Mock;
    };
    user: {
      findUnique: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  const employeeUser = {
    userId: 'employee-uuid-1',
    role: 'EMPLOYEE',
    departmentId: 'dept-uuid-1',
  };

  const managerUser = {
    userId: 'manager-uuid-1',
    role: 'MANAGER',
    departmentId: 'dept-uuid-1',
  };

  const adminUser = {
    userId: 'admin-uuid-1',
    role: 'ADMIN',
    departmentId: 'dept-uuid-1',
  };

  const mockOvertime = {
    id: 'overtime-uuid-1',
    userId: 'employee-uuid-1',
    date: new Date('2026-04-07'),
    startTime: '18:00',
    endTime: '21:00',
    hours: new Decimal(3),
    reason: '趕專案 deadline',
    status: 'PENDING',
    reviewerId: null,
    reviewedAt: null,
    reviewComment: null,
    createdAt: new Date('2026-04-07T10:00:00Z'),
    updatedAt: new Date('2026-04-07T10:00:00Z'),
    user: {
      id: 'employee-uuid-1',
      managerId: 'manager-uuid-1',
      departmentId: 'dept-uuid-1',
    },
  };

  const mockReviewerUser = {
    id: 'manager-uuid-1',
    name: '李大華',
  };

  beforeEach(async () => {
    prisma = {
      overtimeRequest: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
        aggregate: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OvertimeService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<OvertimeService>(OvertimeService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ── calculateOvertimeHours ──

  describe('calculateOvertimeHours', () => {
    it('should calculate 3.0 hours for 18:00-21:00', () => {
      expect(service.calculateOvertimeHours('18:00', '21:00')).toBe(3.0);
    });

    it('should round up to 0.5 for 18:00-19:20 (1h20m -> 1.5)', () => {
      expect(service.calculateOvertimeHours('18:00', '19:20')).toBe(1.5);
    });

    it('should return 0.5 for 18:00-18:10 (10min -> 0.5)', () => {
      expect(service.calculateOvertimeHours('18:00', '18:10')).toBe(0.5);
    });

    it('should return exact 1.0 for 18:00-19:00', () => {
      expect(service.calculateOvertimeHours('18:00', '19:00')).toBe(1.0);
    });

    it('should return -1 when end_time <= start_time', () => {
      expect(service.calculateOvertimeHours('21:00', '18:00')).toBe(-1);
    });

    it('should return -1 when times are equal', () => {
      expect(service.calculateOvertimeHours('18:00', '18:00')).toBe(-1);
    });

    it('should return 2.5 for 18:00-20:25 (2h25m -> 2.5)', () => {
      expect(service.calculateOvertimeHours('18:00', '20:25')).toBe(2.5);
    });

    it('should return 2.5 for 18:00-20:31 (2h31m -> 3.0 is wrong, check: ceil(2.5167*2)/2 = ceil(5.033)/2 = 6/2 = 3.0)', () => {
      expect(service.calculateOvertimeHours('18:00', '20:31')).toBe(3.0);
    });
  });

  // ── createOvertime ──

  describe('createOvertime', () => {
    const validDto = {
      date: '2026-04-10',
      start_time: '18:00',
      end_time: '21:00',
      reason: '趕專案 deadline',
    };

    beforeEach(() => {
      // 預設：無衝突、月累計 0 小時
      prisma.overtimeRequest.findFirst.mockResolvedValue(null);
      prisma.overtimeRequest.aggregate.mockResolvedValue({
        _sum: { hours: null },
      });
    });

    it('should create overtime request successfully', async () => {
      const created = {
        id: 'overtime-uuid-1',
        userId: 'employee-uuid-1',
        date: new Date('2026-04-10'),
        startTime: '18:00',
        endTime: '21:00',
        hours: new Decimal(3),
        reason: '趕專案 deadline',
        status: 'PENDING',
        reviewerId: null,
        reviewedAt: null,
        reviewComment: null,
        createdAt: new Date('2026-04-07T10:00:00Z'),
      };
      prisma.overtimeRequest.create.mockResolvedValue(created);

      const result = await service.createOvertime('employee-uuid-1', validDto);

      expect(result.id).toBe('overtime-uuid-1');
      expect(result.hours).toBe(3.0);
      expect(result.status).toBe('pending');
      expect(result.date).toBe('2026-04-10');
      expect(result.start_time).toBe('18:00');
      expect(result.end_time).toBe('21:00');
    });

    it('should throw INVALID_TIME_RANGE when end_time <= start_time', async () => {
      try {
        await service.createOvertime('employee-uuid-1', {
          ...validDto,
          start_time: '21:00',
          end_time: '18:00',
        });
        fail('Expected exception');
      } catch (e) {
        const ex = e as HttpException;
        expect(ex.getStatus()).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
        const body = ex.getResponse() as Record<string, string>;
        expect(body.code).toBe('INVALID_TIME_RANGE');
      }
    });

    it('should throw INVALID_TIME_RANGE when single overtime exceeds 12 hours', async () => {
      try {
        await service.createOvertime('employee-uuid-1', {
          ...validDto,
          start_time: '06:00',
          end_time: '19:00', // 13 hours
        });
        fail('Expected exception');
      } catch (e) {
        const ex = e as HttpException;
        expect(ex.getStatus()).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
        const body = ex.getResponse() as Record<string, string>;
        expect(body.code).toBe('INVALID_TIME_RANGE');
      }
    });

    it('should throw PAST_DATE when date is more than 7 days ago', async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 8);
      const dateStr = oldDate.toISOString().split('T')[0];

      try {
        await service.createOvertime('employee-uuid-1', {
          ...validDto,
          date: dateStr,
        });
        fail('Expected exception');
      } catch (e) {
        const ex = e as HttpException;
        expect(ex.getStatus()).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
        const body = ex.getResponse() as Record<string, string>;
        expect(body.code).toBe('PAST_DATE');
      }
    });

    it('should allow retroactive request within 7 days', async () => {
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 5);
      const dateStr = recentDate.toISOString().split('T')[0];

      const created = {
        id: 'overtime-uuid-2',
        userId: 'employee-uuid-1',
        date: recentDate,
        startTime: '18:00',
        endTime: '21:00',
        hours: new Decimal(3),
        reason: '趕專案 deadline',
        status: 'PENDING',
        reviewerId: null,
        reviewedAt: null,
        reviewComment: null,
        createdAt: new Date(),
      };
      prisma.overtimeRequest.create.mockResolvedValue(created);

      const result = await service.createOvertime('employee-uuid-1', {
        ...validDto,
        date: dateStr,
      });

      expect(result.status).toBe('pending');
    });

    it('should throw DATE_CONFLICT when same date has pending/approved request', async () => {
      prisma.overtimeRequest.findFirst.mockResolvedValue({ id: 'existing' });

      try {
        await service.createOvertime('employee-uuid-1', validDto);
        fail('Expected exception');
      } catch (e) {
        const ex = e as HttpException;
        expect(ex.getStatus()).toBe(HttpStatus.CONFLICT);
        const body = ex.getResponse() as Record<string, string>;
        expect(body.code).toBe('DATE_CONFLICT');
      }
    });

    it('should throw MONTHLY_LIMIT_EXCEEDED when exceeding 46 hours/month', async () => {
      prisma.overtimeRequest.aggregate.mockResolvedValue({
        _sum: { hours: new Decimal(44) },
      });

      try {
        await service.createOvertime('employee-uuid-1', validDto);
        fail('Expected exception');
      } catch (e) {
        const ex = e as HttpException;
        expect(ex.getStatus()).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
        const body = ex.getResponse() as Record<string, string>;
        expect(body.code).toBe('MONTHLY_LIMIT_EXCEEDED');
        expect(body.message).toContain('2');
      }
    });
  });

  // ── getOvertimeList ──

  describe('getOvertimeList', () => {
    it('should return overtime list with pagination', async () => {
      const mockData = [{
        id: 'overtime-uuid-1',
        date: new Date('2026-04-07'),
        startTime: '18:00',
        endTime: '21:00',
        hours: new Decimal(3),
        reason: '趕專案',
        status: 'PENDING',
        createdAt: new Date('2026-04-07T10:00:00Z'),
      }];
      prisma.overtimeRequest.findMany.mockResolvedValue(mockData);
      prisma.overtimeRequest.count.mockResolvedValue(1);

      const result = await service.getOvertimeList('employee-uuid-1', {});

      expect(result.data).toHaveLength(1);
      expect(result.data[0].hours).toBe(3.0);
      expect(result.data[0].status).toBe('pending');
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(20);
    });

    it('should filter by status', async () => {
      prisma.overtimeRequest.findMany.mockResolvedValue([]);
      prisma.overtimeRequest.count.mockResolvedValue(0);

      await service.getOvertimeList('employee-uuid-1', { status: 'approved' as never });

      expect(prisma.overtimeRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'APPROVED',
          }),
        }),
      );
    });
  });

  // ── getOvertimeById ──

  describe('getOvertimeById', () => {
    it('should return overtime detail for owner', async () => {
      const detail = {
        ...mockOvertime,
        updatedAt: new Date('2026-04-07T10:00:00Z'),
        user: {
          id: 'employee-uuid-1',
          name: '王小明',
          employeeId: 'EMP001',
          departmentId: 'dept-uuid-1',
          department: { id: 'dept-uuid-1', name: '工程部' },
        },
        reviewer: null,
      };
      prisma.overtimeRequest.findUnique.mockResolvedValue(detail);

      const result = await service.getOvertimeById(
        'overtime-uuid-1',
        'employee-uuid-1',
        'EMPLOYEE',
        'dept-uuid-1',
      );

      expect(result.id).toBe('overtime-uuid-1');
      expect(result.user.name).toBe('王小明');
    });

    it('should throw NOT_FOUND when overtime does not exist', async () => {
      prisma.overtimeRequest.findUnique.mockResolvedValue(null);

      await expect(
        service.getOvertimeById('nonexistent', 'employee-uuid-1', 'EMPLOYEE', 'dept-uuid-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw FORBIDDEN when employee views another user overtime', async () => {
      const detail = {
        ...mockOvertime,
        userId: 'other-employee',
        updatedAt: new Date(),
        user: {
          id: 'other-employee',
          name: '他人',
          employeeId: 'EMP002',
          departmentId: 'dept-uuid-2',
          department: { id: 'dept-uuid-2', name: '業務部' },
        },
        reviewer: null,
      };
      prisma.overtimeRequest.findUnique.mockResolvedValue(detail);

      await expect(
        service.getOvertimeById('overtime-uuid-1', 'employee-uuid-1', 'EMPLOYEE', 'dept-uuid-1'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ── cancelOvertime ──

  describe('cancelOvertime', () => {
    it('should cancel a pending overtime', async () => {
      prisma.overtimeRequest.findUnique.mockResolvedValue(mockOvertime);
      prisma.overtimeRequest.update.mockResolvedValue({
        ...mockOvertime,
        status: 'CANCELLED',
      });

      const result = await service.cancelOvertime('overtime-uuid-1', 'employee-uuid-1');

      expect(result.id).toBe('overtime-uuid-1');
      expect(result.status).toBe('cancelled');
    });

    it('should throw NOT_FOUND when overtime does not exist', async () => {
      prisma.overtimeRequest.findUnique.mockResolvedValue(null);

      await expect(
        service.cancelOvertime('nonexistent', 'employee-uuid-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw FORBIDDEN when cancelling someone else overtime', async () => {
      prisma.overtimeRequest.findUnique.mockResolvedValue(mockOvertime);

      await expect(
        service.cancelOvertime('overtime-uuid-1', 'other-user'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw CANNOT_CANCEL when not pending', async () => {
      prisma.overtimeRequest.findUnique.mockResolvedValue({
        ...mockOvertime,
        status: 'APPROVED',
      });

      try {
        await service.cancelOvertime('overtime-uuid-1', 'employee-uuid-1');
        fail('Expected exception');
      } catch (e) {
        const ex = e as HttpException;
        expect(ex.getStatus()).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
        const body = ex.getResponse() as Record<string, string>;
        expect(body.code).toBe('CANNOT_CANCEL');
      }
    });
  });

  // ── getPendingOvertimes ──

  describe('getPendingOvertimes', () => {
    it('should return pending overtimes for manager (subordinates only)', async () => {
      const mockData = [{
        id: 'overtime-uuid-1',
        date: new Date('2026-04-07'),
        startTime: '18:00',
        endTime: '21:00',
        hours: new Decimal(3),
        reason: '趕專案',
        status: 'PENDING',
        createdAt: new Date('2026-04-07T10:00:00Z'),
        user: {
          id: 'employee-uuid-1',
          name: '王小明',
          employeeId: 'EMP001',
          department: { id: 'dept-uuid-1', name: '工程部' },
        },
      }];
      prisma.overtimeRequest.findMany.mockResolvedValue(mockData);
      prisma.overtimeRequest.count.mockResolvedValue(1);

      const result = await service.getPendingOvertimes(managerUser, {});

      expect(result.data).toHaveLength(1);
      expect(result.data[0].user.employee_id).toBe('EMP001');
      expect(prisma.overtimeRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            status: 'PENDING',
            user: { managerId: 'manager-uuid-1' },
          },
        }),
      );
    });

    it('should return all pending overtimes for admin', async () => {
      prisma.overtimeRequest.findMany.mockResolvedValue([]);
      prisma.overtimeRequest.count.mockResolvedValue(0);

      await service.getPendingOvertimes(adminUser, {});

      expect(prisma.overtimeRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'PENDING' },
        }),
      );
    });

    it('should filter by department_id for admin', async () => {
      prisma.overtimeRequest.findMany.mockResolvedValue([]);
      prisma.overtimeRequest.count.mockResolvedValue(0);

      await service.getPendingOvertimes(adminUser, {
        department_id: 'dept-uuid-2',
      });

      expect(prisma.overtimeRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            status: 'PENDING',
            user: { departmentId: 'dept-uuid-2' },
          },
        }),
      );
    });
  });

  // ── approveOvertime ──

  describe('approveOvertime', () => {
    it('should approve a pending overtime', async () => {
      prisma.overtimeRequest.findUnique.mockResolvedValue(mockOvertime);
      prisma.user.findUnique.mockResolvedValue(mockReviewerUser);

      prisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          overtimeRequest: {
            findUnique: jest.fn().mockResolvedValue(mockOvertime),
            update: jest.fn().mockResolvedValue({
              ...mockOvertime,
              status: 'APPROVED',
              reviewerId: 'manager-uuid-1',
              reviewedAt: new Date('2026-04-07T14:00:00Z'),
              reviewComment: '核准',
              updatedAt: new Date('2026-04-07T14:00:00Z'),
            }),
          },
        };
        return callback(tx);
      });

      const result = await service.approveOvertime(
        'overtime-uuid-1',
        managerUser,
        '核准',
      );

      expect(result.id).toBe('overtime-uuid-1');
      expect(result.status).toBe('approved');
      expect(result.reviewer).toEqual({ id: 'manager-uuid-1', name: '李大華' });
      expect(result.review_comment).toBe('核准');
    });

    it('should throw NOT_FOUND when overtime does not exist', async () => {
      prisma.overtimeRequest.findUnique.mockResolvedValue(null);

      await expect(
        service.approveOvertime('nonexistent', managerUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NOT_PENDING when already approved', async () => {
      prisma.overtimeRequest.findUnique.mockResolvedValue({
        ...mockOvertime,
        status: 'APPROVED',
      });

      try {
        await service.approveOvertime('overtime-uuid-1', managerUser);
        fail('Expected exception');
      } catch (e) {
        const ex = e as HttpException;
        expect(ex.getStatus()).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
        const body = ex.getResponse() as Record<string, string>;
        expect(body.code).toBe('NOT_PENDING');
      }
    });

    it('should throw FORBIDDEN when approving own overtime', async () => {
      prisma.overtimeRequest.findUnique.mockResolvedValue({
        ...mockOvertime,
        userId: 'manager-uuid-1',
        user: {
          id: 'manager-uuid-1',
          managerId: 'upper-manager',
          departmentId: 'dept-uuid-1',
        },
      });

      try {
        await service.approveOvertime('overtime-uuid-1', managerUser);
        fail('Expected exception');
      } catch (e) {
        const ex = e as ForbiddenException;
        const body = ex.getResponse() as Record<string, string>;
        expect(body.code).toBe('FORBIDDEN');
        expect(body.message).toContain('不可審核自己');
      }
    });

    it('should throw FORBIDDEN when manager approves non-subordinate', async () => {
      prisma.overtimeRequest.findUnique.mockResolvedValue({
        ...mockOvertime,
        user: {
          id: 'employee-uuid-1',
          managerId: 'other-manager-uuid',
          departmentId: 'dept-uuid-2',
        },
      });

      await expect(
        service.approveOvertime('overtime-uuid-1', managerUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow admin to approve any overtime', async () => {
      const overtimeOtherDept = {
        ...mockOvertime,
        user: {
          id: 'employee-uuid-1',
          managerId: 'other-manager',
          departmentId: 'dept-uuid-2',
        },
      };
      prisma.overtimeRequest.findUnique.mockResolvedValue(overtimeOtherDept);
      prisma.user.findUnique.mockResolvedValue({
        id: 'admin-uuid-1',
        name: 'Admin',
      });

      prisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          overtimeRequest: {
            findUnique: jest.fn().mockResolvedValue(overtimeOtherDept),
            update: jest.fn().mockResolvedValue({
              ...overtimeOtherDept,
              status: 'APPROVED',
              reviewerId: 'admin-uuid-1',
              reviewedAt: new Date(),
              reviewComment: null,
              updatedAt: new Date(),
            }),
          },
        };
        return callback(tx);
      });

      const result = await service.approveOvertime('overtime-uuid-1', adminUser);
      expect(result.status).toBe('approved');
    });
  });

  // ── rejectOvertime ──

  describe('rejectOvertime', () => {
    it('should reject a pending overtime with comment', async () => {
      prisma.overtimeRequest.findUnique.mockResolvedValue(mockOvertime);
      prisma.user.findUnique.mockResolvedValue(mockReviewerUser);

      prisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          overtimeRequest: {
            findUnique: jest.fn().mockResolvedValue(mockOvertime),
            update: jest.fn().mockResolvedValue({
              ...mockOvertime,
              status: 'REJECTED',
              reviewerId: 'manager-uuid-1',
              reviewedAt: new Date('2026-04-07T14:00:00Z'),
              reviewComment: '加班理由不充分',
              updatedAt: new Date('2026-04-07T14:00:00Z'),
            }),
          },
        };
        return callback(tx);
      });

      const result = await service.rejectOvertime(
        'overtime-uuid-1',
        managerUser,
        '加班理由不充分',
      );

      expect(result.id).toBe('overtime-uuid-1');
      expect(result.status).toBe('rejected');
      expect(result.review_comment).toBe('加班理由不充分');
      expect(result.reviewer).toEqual({ id: 'manager-uuid-1', name: '李大華' });
    });

    it('should throw NOT_FOUND when overtime does not exist', async () => {
      prisma.overtimeRequest.findUnique.mockResolvedValue(null);

      await expect(
        service.rejectOvertime('nonexistent', managerUser, '原因'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw FORBIDDEN when rejecting own overtime', async () => {
      prisma.overtimeRequest.findUnique.mockResolvedValue({
        ...mockOvertime,
        userId: 'manager-uuid-1',
        user: {
          id: 'manager-uuid-1',
          managerId: 'upper-manager',
          departmentId: 'dept-uuid-1',
        },
      });

      try {
        await service.rejectOvertime('overtime-uuid-1', managerUser, '原因');
        fail('Expected exception');
      } catch (e) {
        const ex = e as ForbiddenException;
        const body = ex.getResponse() as Record<string, string>;
        expect(body.code).toBe('FORBIDDEN');
      }
    });

    it('should throw FORBIDDEN when manager rejects non-subordinate', async () => {
      prisma.overtimeRequest.findUnique.mockResolvedValue({
        ...mockOvertime,
        user: {
          id: 'employee-uuid-1',
          managerId: 'other-manager-uuid',
          departmentId: 'dept-uuid-2',
        },
      });

      await expect(
        service.rejectOvertime('overtime-uuid-1', managerUser, '原因'),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
