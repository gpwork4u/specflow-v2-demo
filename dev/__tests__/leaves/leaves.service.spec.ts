import { Test, TestingModule } from '@nestjs/testing';
import {
  HttpException,
  HttpStatus,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { LeavesService } from '../../src/leaves/leaves.service';
import { LeaveQuotasService } from '../../src/leave-quotas/leave-quotas.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { HalfDayEnum } from '../../src/leaves/dto/create-leave.dto';

const Decimal = Prisma.Decimal;

describe('LeavesService', () => {
  let service: LeavesService;
  let prisma: {
    leaveRequest: {
      create: jest.Mock;
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      update: jest.Mock;
    };
    leaveQuota: {
      findUnique: jest.Mock;
      updateMany: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let leaveQuotasService: { getQuotas: jest.Mock };

  // 固定 "today" 為 2026-04-07
  const MOCK_TODAY = new Date('2026-04-07T00:00:00.000Z');

  const mockLeave = {
    id: 'leave-uuid-1',
    userId: 'user-uuid-1',
    leaveType: 'ANNUAL',
    startDate: new Date('2026-04-10T00:00:00.000Z'),
    endDate: new Date('2026-04-10T00:00:00.000Z'),
    startHalf: 'FULL',
    endHalf: 'FULL',
    hours: new Decimal(8),
    reason: '個人事務',
    status: 'PENDING',
    reviewerId: null,
    reviewedAt: null,
    reviewComment: null,
    createdAt: new Date('2026-04-07T10:00:00.000Z'),
    updatedAt: new Date('2026-04-07T10:00:00.000Z'),
  };

  const mockQuota = {
    id: 'quota-uuid-1',
    userId: 'user-uuid-1',
    leaveType: 'ANNUAL',
    year: 2026,
    totalHours: new Decimal(56),
    usedHours: new Decimal(0),
  };

  beforeEach(async () => {
    // Mock Date 讓 today 固定
    jest.useFakeTimers();
    jest.setSystemTime(MOCK_TODAY);

    prisma = {
      leaveRequest: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
      },
      leaveQuota: {
        findUnique: jest.fn(),
        updateMany: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    leaveQuotasService = {
      getQuotas: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeavesService,
        { provide: PrismaService, useValue: prisma },
        { provide: LeaveQuotasService, useValue: leaveQuotasService },
      ],
    }).compile();

    service = module.get<LeavesService>(LeavesService);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  // ── calculateLeaveHours ──

  describe('calculateLeaveHours', () => {
    it('should return 8 for a full day', () => {
      const start = new Date('2026-04-10');
      const end = new Date('2026-04-10');
      expect(
        service.calculateLeaveHours(start, end, HalfDayEnum.FULL, HalfDayEnum.FULL),
      ).toBe(8);
    });

    it('should return 4 for a half day (morning)', () => {
      const start = new Date('2026-04-10');
      const end = new Date('2026-04-10');
      expect(
        service.calculateLeaveHours(start, end, HalfDayEnum.MORNING, HalfDayEnum.MORNING),
      ).toBe(4);
    });

    it('should return 4 for a half day (afternoon)', () => {
      const start = new Date('2026-04-10');
      const end = new Date('2026-04-10');
      expect(
        service.calculateLeaveHours(start, end, HalfDayEnum.AFTERNOON, HalfDayEnum.AFTERNOON),
      ).toBe(4);
    });

    it('should return 16 for 2 full days', () => {
      const start = new Date('2026-04-10');
      const end = new Date('2026-04-11');
      expect(
        service.calculateLeaveHours(start, end, HalfDayEnum.FULL, HalfDayEnum.FULL),
      ).toBe(16);
    });

    it('should return 36 for 5 days with start_half=afternoon, end_half=full', () => {
      // 4 + 8 + 8 + 8 + 8 = 36
      const start = new Date('2026-04-10');
      const end = new Date('2026-04-14');
      expect(
        service.calculateLeaveHours(
          start,
          end,
          HalfDayEnum.AFTERNOON,
          HalfDayEnum.FULL,
        ),
      ).toBe(36);
    });

    it('should return 12 for 2 days with start_half=afternoon, end_half=full', () => {
      // 4 + 8 = 12
      const start = new Date('2026-04-10');
      const end = new Date('2026-04-11');
      expect(
        service.calculateLeaveHours(
          start,
          end,
          HalfDayEnum.AFTERNOON,
          HalfDayEnum.FULL,
        ),
      ).toBe(12);
    });

    it('should return 8 for 2 days with start_half=morning, end_half=morning', () => {
      // 4 + 4 = 8
      const start = new Date('2026-04-10');
      const end = new Date('2026-04-11');
      expect(
        service.calculateLeaveHours(
          start,
          end,
          HalfDayEnum.MORNING,
          HalfDayEnum.MORNING,
        ),
      ).toBe(8);
    });
  });

  // ── createLeave ──

  describe('createLeave', () => {
    const createDto = {
      leave_type: 'annual' as const,
      start_date: '2026-04-10',
      end_date: '2026-04-10',
      reason: '個人事務',
    };

    it('should create a leave request successfully (Scenario: 申請特休一天)', async () => {
      prisma.leaveRequest.findFirst.mockResolvedValue(null); // no conflict
      prisma.leaveQuota.findUnique.mockResolvedValue(mockQuota); // quota available
      prisma.leaveRequest.create.mockResolvedValue(mockLeave);

      const result = await service.createLeave('user-uuid-1', createDto as any);

      expect(result.id).toBe('leave-uuid-1');
      expect(result.status).toBe('pending');
      expect(result.hours).toBe(8);
      expect(result.leave_type).toBe('annual');
      expect(prisma.leaveRequest.create).toHaveBeenCalledTimes(1);
    });

    it('should create a half-day leave (Scenario: 申請半天假)', async () => {
      const halfDayLeave = {
        ...mockLeave,
        startHalf: 'MORNING',
        endHalf: 'MORNING',
        hours: new Decimal(4),
      };

      prisma.leaveRequest.findFirst.mockResolvedValue(null);
      prisma.leaveQuota.findUnique.mockResolvedValue(mockQuota);
      prisma.leaveRequest.create.mockResolvedValue(halfDayLeave);

      const dto = {
        leave_type: 'personal' as const,
        start_date: '2026-04-10',
        end_date: '2026-04-10',
        start_half: 'morning' as const,
        end_half: 'morning' as const,
        reason: '看診',
      };

      const result = await service.createLeave('user-uuid-1', dto as any);

      expect(result.hours).toBe(4);
      expect(result.start_half).toBe('morning');
    });

    it('should create multi-day leave (Scenario: 申請跨多天假)', async () => {
      const multiDayLeave = {
        ...mockLeave,
        startDate: new Date('2026-04-10T00:00:00.000Z'),
        endDate: new Date('2026-04-14T00:00:00.000Z'),
        startHalf: 'AFTERNOON',
        endHalf: 'FULL',
        hours: new Decimal(36),
      };

      prisma.leaveRequest.findFirst.mockResolvedValue(null);
      prisma.leaveQuota.findUnique.mockResolvedValue({
        ...mockQuota,
        totalHours: new Decimal(120),
      });
      prisma.leaveRequest.create.mockResolvedValue(multiDayLeave);

      const dto = {
        leave_type: 'annual' as const,
        start_date: '2026-04-10',
        end_date: '2026-04-14',
        start_half: 'afternoon' as const,
        end_half: 'full' as const,
        reason: '出國旅遊',
      };

      const result = await service.createLeave('user-uuid-1', dto as any);

      expect(result.hours).toBe(36);
    });

    it('should throw PAST_DATE when start_date is in the past', async () => {
      const dto = {
        leave_type: 'annual' as const,
        start_date: '2026-04-01',
        end_date: '2026-04-01',
        reason: '過去的日期',
      };

      try {
        await service.createLeave('user-uuid-1', dto as any);
        fail('Expected exception');
      } catch (e) {
        const ex = e as HttpException;
        expect(ex.getStatus()).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
        const resp = ex.getResponse() as Record<string, string>;
        expect(resp.code).toBe('PAST_DATE');
      }
    });

    it('should allow sick leave 3 days ago (Scenario: 病假可追溯 3 天)', async () => {
      // today = 2026-04-07, start_date = 2026-04-04 => ok
      prisma.leaveRequest.findFirst.mockResolvedValue(null);
      prisma.leaveQuota.findUnique.mockResolvedValue({
        ...mockQuota,
        leaveType: 'SICK',
        totalHours: new Decimal(240),
      });
      prisma.leaveRequest.create.mockResolvedValue({
        ...mockLeave,
        leaveType: 'SICK',
        startDate: new Date('2026-04-04T00:00:00.000Z'),
      });

      const dto = {
        leave_type: 'sick' as const,
        start_date: '2026-04-04',
        end_date: '2026-04-04',
        reason: '身體不適',
      };

      const result = await service.createLeave('user-uuid-1', dto as any);
      expect(result.leave_type).toBe('sick');
    });

    it('should reject sick leave more than 3 days ago (Scenario: 病假追溯超過 3 天)', async () => {
      // today = 2026-04-07, start_date = 2026-04-03 => reject
      const dto = {
        leave_type: 'sick' as const,
        start_date: '2026-04-03',
        end_date: '2026-04-03',
        reason: '身體不適',
      };

      try {
        await service.createLeave('user-uuid-1', dto as any);
        fail('Expected exception');
      } catch (e) {
        const ex = e as HttpException;
        expect(ex.getStatus()).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
        const resp = ex.getResponse() as Record<string, string>;
        expect(resp.code).toBe('PAST_DATE');
      }
    });

    it('should throw DATE_CONFLICT when date overlaps (Scenario: 日期衝突)', async () => {
      prisma.leaveRequest.findFirst.mockResolvedValue(mockLeave); // conflict exists

      try {
        await service.createLeave('user-uuid-1', createDto as any);
        fail('Expected exception');
      } catch (e) {
        const ex = e as HttpException;
        expect(ex.getStatus()).toBe(HttpStatus.CONFLICT);
        const resp = ex.getResponse() as Record<string, string>;
        expect(resp.code).toBe('DATE_CONFLICT');
      }
    });

    it('should throw INSUFFICIENT_QUOTA when quota is not enough (Scenario: 額度不足)', async () => {
      prisma.leaveRequest.findFirst.mockResolvedValue(null);
      prisma.leaveQuota.findUnique.mockResolvedValue({
        ...mockQuota,
        totalHours: new Decimal(4),
        usedHours: new Decimal(0),
      });

      try {
        await service.createLeave('user-uuid-1', createDto as any);
        fail('Expected exception');
      } catch (e) {
        const ex = e as HttpException;
        expect(ex.getStatus()).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
        const resp = ex.getResponse() as Record<string, string>;
        expect(resp.code).toBe('INSUFFICIENT_QUOTA');
      }
    });

    it('should throw INSUFFICIENT_QUOTA when no quota exists', async () => {
      prisma.leaveRequest.findFirst.mockResolvedValue(null);
      prisma.leaveQuota.findUnique.mockResolvedValue(null);

      try {
        await service.createLeave('user-uuid-1', createDto as any);
        fail('Expected exception');
      } catch (e) {
        const ex = e as HttpException;
        expect(ex.getStatus()).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
        const resp = ex.getResponse() as Record<string, string>;
        expect(resp.code).toBe('INSUFFICIENT_QUOTA');
      }
    });

    it('should throw INVALID_INPUT when end_date < start_date', async () => {
      const dto = {
        leave_type: 'annual' as const,
        start_date: '2026-04-12',
        end_date: '2026-04-10',
        reason: '日期錯誤',
      };

      try {
        await service.createLeave('user-uuid-1', dto as any);
        fail('Expected exception');
      } catch (e) {
        const ex = e as HttpException;
        expect(ex.getStatus()).toBe(HttpStatus.BAD_REQUEST);
        const resp = ex.getResponse() as Record<string, string>;
        expect(resp.code).toBe('INVALID_INPUT');
      }
    });

    it('should accept reason with exactly 500 chars (Scenario: reason 恰好 500 字)', async () => {
      prisma.leaveRequest.findFirst.mockResolvedValue(null);
      prisma.leaveQuota.findUnique.mockResolvedValue(mockQuota);
      prisma.leaveRequest.create.mockResolvedValue({
        ...mockLeave,
        reason: 'a'.repeat(500),
      });

      const dto = {
        leave_type: 'annual' as const,
        start_date: '2026-04-10',
        end_date: '2026-04-10',
        reason: 'a'.repeat(500),
      };

      const result = await service.createLeave('user-uuid-1', dto as any);
      expect(result.reason).toHaveLength(500);
    });
  });

  // ── getLeaves ──

  describe('getLeaves', () => {
    it('should return paginated leave list (Scenario: 查詢個人請假紀錄)', async () => {
      const leaves = [
        { ...mockLeave, reviewer: null },
        { ...mockLeave, id: 'leave-uuid-2', reviewer: null },
        { ...mockLeave, id: 'leave-uuid-3', reviewer: null },
      ];
      prisma.leaveRequest.findMany.mockResolvedValue(leaves);
      prisma.leaveRequest.count.mockResolvedValue(3);

      const result = await service.getLeaves('user-uuid-1', {} as any);

      expect(result.data).toHaveLength(3);
      expect(result.meta.total).toBe(3);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(20);
      expect(result.meta.totalPages).toBe(1);
    });

    it('should filter by status', async () => {
      prisma.leaveRequest.findMany.mockResolvedValue([]);
      prisma.leaveRequest.count.mockResolvedValue(0);

      await service.getLeaves('user-uuid-1', { status: 'pending' } as any);

      expect(prisma.leaveRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'PENDING' }),
        }),
      );
    });

    it('should filter by leave_type', async () => {
      prisma.leaveRequest.findMany.mockResolvedValue([]);
      prisma.leaveRequest.count.mockResolvedValue(0);

      await service.getLeaves('user-uuid-1', { leave_type: 'annual' } as any);

      expect(prisma.leaveRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ leaveType: 'ANNUAL' }),
        }),
      );
    });

    it('should filter by date range', async () => {
      prisma.leaveRequest.findMany.mockResolvedValue([]);
      prisma.leaveRequest.count.mockResolvedValue(0);

      await service.getLeaves('user-uuid-1', {
        start_date: '2026-04-01',
        end_date: '2026-04-30',
      } as any);

      expect(prisma.leaveRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            startDate: {
              gte: new Date('2026-04-01T00:00:00.000Z'),
              lte: new Date('2026-04-30T00:00:00.000Z'),
            },
          }),
        }),
      );
    });

    it('should support pagination', async () => {
      prisma.leaveRequest.findMany.mockResolvedValue([]);
      prisma.leaveRequest.count.mockResolvedValue(50);

      const result = await service.getLeaves('user-uuid-1', {
        page: 2,
        limit: 10,
      } as any);

      expect(prisma.leaveRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
        }),
      );
      expect(result.meta.totalPages).toBe(5);
    });
  });

  // ── getLeaveById ──

  describe('getLeaveById', () => {
    const mockLeaveWithUser = {
      ...mockLeave,
      updatedAt: new Date('2026-04-07T10:00:00.000Z'),
      user: {
        id: 'user-uuid-1',
        name: '王小明',
        employeeId: 'EMP001',
        departmentId: 'dept-uuid-1',
        department: { id: 'dept-uuid-1', name: '工程部' },
      },
      reviewer: null,
    };

    it('should return leave detail for own leave', async () => {
      prisma.leaveRequest.findUnique.mockResolvedValue(mockLeaveWithUser);

      const result = await service.getLeaveById(
        'leave-uuid-1',
        'user-uuid-1',
        'EMPLOYEE',
        'dept-uuid-1',
      );

      expect(result.id).toBe('leave-uuid-1');
      expect(result.user.name).toBe('王小明');
      expect(result.user.department.name).toBe('工程部');
    });

    it('should throw NOT_FOUND when leave does not exist', async () => {
      prisma.leaveRequest.findUnique.mockResolvedValue(null);

      await expect(
        service.getLeaveById('nonexistent', 'user-uuid-1', 'EMPLOYEE', 'dept-uuid-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw FORBIDDEN for other user leave (Scenario: employee)', async () => {
      prisma.leaveRequest.findUnique.mockResolvedValue(mockLeaveWithUser);

      await expect(
        service.getLeaveById('leave-uuid-1', 'other-user', 'EMPLOYEE', 'dept-uuid-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow ADMIN to view any leave', async () => {
      prisma.leaveRequest.findUnique.mockResolvedValue(mockLeaveWithUser);

      const result = await service.getLeaveById(
        'leave-uuid-1',
        'admin-user',
        'ADMIN',
        'dept-uuid-2',
      );

      expect(result.id).toBe('leave-uuid-1');
    });

    it('should allow MANAGER to view same department leave', async () => {
      prisma.leaveRequest.findUnique.mockResolvedValue(mockLeaveWithUser);

      const result = await service.getLeaveById(
        'leave-uuid-1',
        'manager-user',
        'MANAGER',
        'dept-uuid-1',
      );

      expect(result.id).toBe('leave-uuid-1');
    });

    it('should throw FORBIDDEN for MANAGER viewing other department leave', async () => {
      prisma.leaveRequest.findUnique.mockResolvedValue(mockLeaveWithUser);

      await expect(
        service.getLeaveById('leave-uuid-1', 'manager-user', 'MANAGER', 'dept-uuid-2'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ── cancelLeave ──

  describe('cancelLeave', () => {
    it('should cancel a pending leave (Scenario: 取消 pending 的請假)', async () => {
      const pendingLeave = { ...mockLeave, status: 'PENDING' };
      prisma.leaveRequest.findUnique.mockResolvedValue(pendingLeave);
      prisma.leaveRequest.update.mockResolvedValue({
        ...pendingLeave,
        status: 'CANCELLED',
        updatedAt: new Date('2026-04-07T11:00:00.000Z'),
      });

      const result = await service.cancelLeave('leave-uuid-1', 'user-uuid-1');

      expect(result.id).toBe('leave-uuid-1');
      expect(result.status).toBe('cancelled');
      expect(result.updated_at).toBeDefined();
    });

    it('should cancel approved leave with future start_date and refund quota (Scenario: 取消已核准但未開始的請假)', async () => {
      const approvedLeave = {
        ...mockLeave,
        status: 'APPROVED',
        startDate: new Date('2026-04-10T00:00:00.000Z'), // future
        hours: new Decimal(8),
      };
      prisma.leaveRequest.findUnique.mockResolvedValue(approvedLeave);

      const updatedLeave = {
        ...approvedLeave,
        status: 'CANCELLED',
        updatedAt: new Date('2026-04-07T11:00:00.000Z'),
      };
      prisma.$transaction.mockResolvedValue([updatedLeave, { count: 1 }]);

      const result = await service.cancelLeave('leave-uuid-1', 'user-uuid-1');

      expect(result.id).toBe('leave-uuid-1');
      expect(result.status).toBe('cancelled');
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('should throw LEAVE_STARTED for approved leave with past/today start_date (Scenario: 取消已開始的 approved 假)', async () => {
      const startedLeave = {
        ...mockLeave,
        status: 'APPROVED',
        startDate: new Date('2026-04-07T00:00:00.000Z'), // today
      };
      prisma.leaveRequest.findUnique.mockResolvedValue(startedLeave);

      try {
        await service.cancelLeave('leave-uuid-1', 'user-uuid-1');
        fail('Expected exception');
      } catch (e) {
        const ex = e as HttpException;
        expect(ex.getStatus()).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
        const resp = ex.getResponse() as Record<string, string>;
        expect(resp.code).toBe('LEAVE_STARTED');
      }
    });

    it('should throw CANNOT_CANCEL for rejected leave', async () => {
      const rejectedLeave = { ...mockLeave, status: 'REJECTED' };
      prisma.leaveRequest.findUnique.mockResolvedValue(rejectedLeave);

      try {
        await service.cancelLeave('leave-uuid-1', 'user-uuid-1');
        fail('Expected exception');
      } catch (e) {
        const ex = e as HttpException;
        expect(ex.getStatus()).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
        const resp = ex.getResponse() as Record<string, string>;
        expect(resp.code).toBe('CANNOT_CANCEL');
      }
    });

    it('should throw CANNOT_CANCEL for already cancelled leave', async () => {
      const cancelledLeave = { ...mockLeave, status: 'CANCELLED' };
      prisma.leaveRequest.findUnique.mockResolvedValue(cancelledLeave);

      try {
        await service.cancelLeave('leave-uuid-1', 'user-uuid-1');
        fail('Expected exception');
      } catch (e) {
        const ex = e as HttpException;
        expect(ex.getStatus()).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
        const resp = ex.getResponse() as Record<string, string>;
        expect(resp.code).toBe('CANNOT_CANCEL');
      }
    });

    it('should throw NOT_FOUND when leave does not exist', async () => {
      prisma.leaveRequest.findUnique.mockResolvedValue(null);

      await expect(
        service.cancelLeave('nonexistent', 'user-uuid-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw FORBIDDEN when cancelling another user leave (Scenario: 取消非自己的請假單)', async () => {
      prisma.leaveRequest.findUnique.mockResolvedValue(mockLeave);

      await expect(
        service.cancelLeave('leave-uuid-1', 'other-user'),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
