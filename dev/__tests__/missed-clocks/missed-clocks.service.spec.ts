import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { MissedClocksService } from '../../src/missed-clocks/missed-clocks.service';
import { PrismaService } from '../../src/prisma/prisma.service';

describe('MissedClocksService', () => {
  let service: MissedClocksService;
  let prisma: {
    missedClockRequest: {
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      count: jest.Mock;
    };
    clockRecord: {
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    user: {
      findUnique: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  const mockUserId = 'user-uuid-1';
  const mockReviewerId = 'reviewer-uuid-1';

  function makeDateOnly(year: number, month: number, day: number): Date {
    return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  }

  const mockReviewer = {
    userId: mockReviewerId,
    role: 'MANAGER',
    departmentId: 'dept-uuid-1',
  };

  const mockAdminReviewer = {
    userId: 'admin-uuid-1',
    role: 'ADMIN',
    departmentId: 'dept-uuid-1',
  };

  beforeEach(async () => {
    prisma = {
      missedClockRequest: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      clockRecord: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MissedClocksService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<MissedClocksService>(MissedClocksService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('create', () => {
    it('should create a missed clock request successfully', async () => {
      // 固定 "today" 為 2026-04-07
      jest.spyOn(Date, 'now').mockReturnValue(
        new Date('2026-04-07T08:00:00Z').getTime(),
      );

      prisma.clockRecord.findUnique.mockResolvedValue(null);
      prisma.missedClockRequest.findFirst.mockResolvedValue(null);

      const now = new Date('2026-04-07T10:00:00Z');
      const mockRequest = {
        id: 'request-uuid-1',
        userId: mockUserId,
        date: makeDateOnly(2026, 4, 6),
        clockType: 'CLOCK_IN',
        requestedTime: new Date('2026-04-06T01:00:00Z'),
        reason: '忘記打卡',
        status: 'PENDING',
        reviewerId: null,
        reviewedAt: null,
        reviewComment: null,
        createdAt: now,
        updatedAt: now,
      };
      prisma.missedClockRequest.create.mockResolvedValue(mockRequest);

      const result = await service.create(mockUserId, {
        date: '2026-04-06',
        clock_type: 'clock_in',
        requested_time: '2026-04-06T01:00:00Z',
        reason: '忘記打卡',
      });

      expect(result.id).toBe('request-uuid-1');
      expect(result.status).toBe('pending');
      expect(result.clock_type).toBe('clock_in');
      expect(result.date).toBe('2026-04-06');
      expect(result.reviewer_id).toBeNull();
      expect(prisma.missedClockRequest.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: mockUserId,
          clockType: 'CLOCK_IN',
          reason: '忘記打卡',
          status: 'PENDING',
        }),
      });
    });

    it('should throw PAST_DATE when date is more than 7 days ago', async () => {
      jest.spyOn(Date, 'now').mockReturnValue(
        new Date('2026-04-07T08:00:00Z').getTime(),
      );

      await expect(
        service.create(mockUserId, {
          date: '2026-03-30',
          clock_type: 'clock_in',
          requested_time: '2026-03-30T01:00:00Z',
          reason: '忘記打卡',
        }),
      ).rejects.toThrow(HttpException);

      try {
        await service.create(mockUserId, {
          date: '2026-03-30',
          clock_type: 'clock_in',
          requested_time: '2026-03-30T01:00:00Z',
          reason: '忘記打卡',
        });
      } catch (e) {
        const ex = e as HttpException;
        expect(ex.getStatus()).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
        const resp = ex.getResponse() as Record<string, string>;
        expect(resp.code).toBe('PAST_DATE');
      }
    });

    it('should throw INVALID_INPUT when date is in the future', async () => {
      jest.spyOn(Date, 'now').mockReturnValue(
        new Date('2026-04-07T08:00:00Z').getTime(),
      );

      await expect(
        service.create(mockUserId, {
          date: '2026-04-08',
          clock_type: 'clock_in',
          requested_time: '2026-04-08T01:00:00Z',
          reason: '忘記打卡',
        }),
      ).rejects.toThrow(HttpException);

      try {
        await service.create(mockUserId, {
          date: '2026-04-08',
          clock_type: 'clock_in',
          requested_time: '2026-04-08T01:00:00Z',
          reason: '忘記打卡',
        });
      } catch (e) {
        const ex = e as HttpException;
        expect(ex.getStatus()).toBe(HttpStatus.BAD_REQUEST);
        const resp = ex.getResponse() as Record<string, string>;
        expect(resp.code).toBe('INVALID_INPUT');
      }
    });

    it('should throw ALREADY_CLOCKED when clock_in record exists', async () => {
      jest.spyOn(Date, 'now').mockReturnValue(
        new Date('2026-04-07T08:00:00Z').getTime(),
      );

      prisma.clockRecord.findUnique.mockResolvedValue({
        id: 'clock-uuid-1',
        userId: mockUserId,
        date: makeDateOnly(2026, 4, 6),
        clockIn: new Date('2026-04-06T01:00:00Z'),
        clockOut: null,
        status: 'NORMAL',
      });

      await expect(
        service.create(mockUserId, {
          date: '2026-04-06',
          clock_type: 'clock_in',
          requested_time: '2026-04-06T01:00:00Z',
          reason: '忘記打卡',
        }),
      ).rejects.toThrow(HttpException);

      try {
        await service.create(mockUserId, {
          date: '2026-04-06',
          clock_type: 'clock_in',
          requested_time: '2026-04-06T01:00:00Z',
          reason: '忘記打卡',
        });
      } catch (e) {
        const ex = e as HttpException;
        expect(ex.getStatus()).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
        const resp = ex.getResponse() as Record<string, string>;
        expect(resp.code).toBe('ALREADY_CLOCKED');
      }
    });

    it('should throw ALREADY_EXISTS when pending request exists for same date and type', async () => {
      jest.spyOn(Date, 'now').mockReturnValue(
        new Date('2026-04-07T08:00:00Z').getTime(),
      );

      prisma.clockRecord.findUnique.mockResolvedValue(null);
      prisma.missedClockRequest.findFirst.mockResolvedValue({
        id: 'existing-request',
        status: 'PENDING',
      });

      await expect(
        service.create(mockUserId, {
          date: '2026-04-06',
          clock_type: 'clock_in',
          requested_time: '2026-04-06T01:00:00Z',
          reason: '忘記打卡',
        }),
      ).rejects.toThrow(HttpException);

      try {
        await service.create(mockUserId, {
          date: '2026-04-06',
          clock_type: 'clock_in',
          requested_time: '2026-04-06T01:00:00Z',
          reason: '忘記打卡',
        });
      } catch (e) {
        const ex = e as HttpException;
        expect(ex.getStatus()).toBe(HttpStatus.CONFLICT);
        const resp = ex.getResponse() as Record<string, string>;
        expect(resp.code).toBe('ALREADY_EXISTS');
      }
    });

    it('should allow clock_in and clock_out for same date (different types)', async () => {
      jest.spyOn(Date, 'now').mockReturnValue(
        new Date('2026-04-07T08:00:00Z').getTime(),
      );

      // 沒有打卡紀錄
      prisma.clockRecord.findUnique.mockResolvedValue(null);
      // 沒有同類型的 pending 申請
      prisma.missedClockRequest.findFirst.mockResolvedValue(null);

      const now = new Date('2026-04-07T10:00:00Z');
      const mockRequest = {
        id: 'request-uuid-2',
        userId: mockUserId,
        date: makeDateOnly(2026, 4, 6),
        clockType: 'CLOCK_OUT',
        requestedTime: new Date('2026-04-06T10:00:00Z'),
        reason: '忘記打下班卡',
        status: 'PENDING',
        reviewerId: null,
        reviewedAt: null,
        reviewComment: null,
        createdAt: now,
        updatedAt: now,
      };
      prisma.missedClockRequest.create.mockResolvedValue(mockRequest);

      const result = await service.create(mockUserId, {
        date: '2026-04-06',
        clock_type: 'clock_out',
        requested_time: '2026-04-06T10:00:00Z',
        reason: '忘記打下班卡',
      });

      expect(result.id).toBe('request-uuid-2');
      expect(result.clock_type).toBe('clock_out');
    });
  });

  describe('findAll', () => {
    it('should return paginated results', async () => {
      const items = [
        {
          id: 'req-1',
          date: makeDateOnly(2026, 4, 6),
          clockType: 'CLOCK_IN',
          requestedTime: new Date('2026-04-06T01:00:00Z'),
          reason: '忘記打卡',
          status: 'PENDING',
          reviewer: null,
          createdAt: new Date('2026-04-07T10:00:00Z'),
        },
      ];

      prisma.missedClockRequest.findMany.mockResolvedValue(items);
      prisma.missedClockRequest.count.mockResolvedValue(1);

      const result = await service.findAll(mockUserId, {});

      expect(result.data).toHaveLength(1);
      expect(result.data[0].clock_type).toBe('clock_in');
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(20);
    });

    it('should filter by status', async () => {
      prisma.missedClockRequest.findMany.mockResolvedValue([]);
      prisma.missedClockRequest.count.mockResolvedValue(0);

      await service.findAll(mockUserId, { status: 'pending' });

      expect(prisma.missedClockRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: mockUserId, status: 'PENDING' },
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return request details for owner', async () => {
      const mockRequest = {
        id: 'req-1',
        userId: mockUserId,
        date: makeDateOnly(2026, 4, 6),
        clockType: 'CLOCK_IN',
        requestedTime: new Date('2026-04-06T01:00:00Z'),
        reason: '忘記打卡',
        status: 'PENDING',
        reviewerId: null,
        reviewedAt: null,
        reviewComment: null,
        createdAt: new Date('2026-04-07T10:00:00Z'),
        updatedAt: new Date('2026-04-07T10:00:00Z'),
        user: {
          id: mockUserId,
          name: '測試員工',
          employeeId: 'EMP001',
          department: { id: 'dept-1', name: '工程部' },
        },
        reviewer: null,
      };

      prisma.missedClockRequest.findUnique.mockResolvedValue(mockRequest);

      const result = await service.findOne('req-1', mockUserId, 'EMPLOYEE');

      expect(result.id).toBe('req-1');
      expect(result.user.name).toBe('測試員工');
    });

    it('should throw NOT_FOUND when request does not exist', async () => {
      prisma.missedClockRequest.findUnique.mockResolvedValue(null);

      await expect(
        service.findOne('non-exist', mockUserId, 'EMPLOYEE'),
      ).rejects.toThrow(HttpException);
    });

    it('should throw FORBIDDEN when employee tries to view others request', async () => {
      prisma.missedClockRequest.findUnique.mockResolvedValue({
        id: 'req-1',
        userId: 'other-user-id',
        date: makeDateOnly(2026, 4, 6),
        clockType: 'CLOCK_IN',
        requestedTime: new Date('2026-04-06T01:00:00Z'),
        reason: '忘記打卡',
        status: 'PENDING',
        reviewerId: null,
        reviewedAt: null,
        reviewComment: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        user: {
          id: 'other-user-id',
          name: '其他員工',
          employeeId: 'EMP002',
          department: { id: 'dept-1', name: '工程部' },
        },
        reviewer: null,
      });

      await expect(
        service.findOne('req-1', mockUserId, 'EMPLOYEE'),
      ).rejects.toThrow(HttpException);
    });
  });

  describe('approve', () => {
    it('should approve and create ClockRecord for clock_in', async () => {
      const mockRequest = {
        id: 'req-1',
        userId: mockUserId,
        date: makeDateOnly(2026, 4, 6),
        clockType: 'CLOCK_IN',
        requestedTime: new Date('2026-04-06T01:00:00Z'),
        reason: '忘記打卡',
        status: 'PENDING',
        user: {
          id: mockUserId,
          managerId: mockReviewerId,
          departmentId: 'dept-uuid-1',
        },
      };

      prisma.missedClockRequest.findUnique.mockResolvedValue(mockRequest);

      // transaction callback 模擬
      prisma.$transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          missedClockRequest: {
            findUnique: jest.fn().mockResolvedValue({ ...mockRequest, status: 'PENDING' }),
            update: jest.fn().mockResolvedValue({
              ...mockRequest,
              status: 'APPROVED',
              reviewerId: mockReviewerId,
              reviewedAt: new Date('2026-04-07T15:00:00Z'),
              reviewComment: '核准',
            }),
          },
          clockRecord: {
            findUnique: jest.fn().mockResolvedValue(null), // 沒有現有 ClockRecord
            create: jest.fn().mockResolvedValue({
              id: 'clock-new-1',
              userId: mockUserId,
              date: makeDateOnly(2026, 4, 6),
              clockIn: new Date('2026-04-06T01:00:00Z'),
              status: 'AMENDED',
            }),
          },
        };
        return callback(tx);
      });

      prisma.user.findUnique.mockResolvedValue({
        id: mockReviewerId,
        name: '李大華',
      });

      const result = await service.approve('req-1', mockReviewer, '核准');

      expect(result.status).toBe('approved');
      expect(result.reviewer).toEqual({ id: mockReviewerId, name: '李大華' });
      expect(result.review_comment).toBe('核准');
    });

    it('should approve and update ClockRecord.clock_out for clock_out', async () => {
      const mockRequest = {
        id: 'req-2',
        userId: mockUserId,
        date: makeDateOnly(2026, 4, 6),
        clockType: 'CLOCK_OUT',
        requestedTime: new Date('2026-04-06T10:00:00Z'),
        reason: '忘記打下班卡',
        status: 'PENDING',
        user: {
          id: mockUserId,
          managerId: mockReviewerId,
          departmentId: 'dept-uuid-1',
        },
      };

      prisma.missedClockRequest.findUnique.mockResolvedValue(mockRequest);

      const existingClock = {
        id: 'clock-1',
        userId: mockUserId,
        date: makeDateOnly(2026, 4, 6),
        clockIn: new Date('2026-04-06T01:00:00Z'),
        clockOut: null,
        status: 'NORMAL',
      };

      prisma.$transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          missedClockRequest: {
            findUnique: jest.fn().mockResolvedValue({ ...mockRequest, status: 'PENDING' }),
            update: jest.fn().mockResolvedValue({
              ...mockRequest,
              status: 'APPROVED',
              reviewerId: mockReviewerId,
              reviewedAt: new Date('2026-04-07T15:00:00Z'),
              reviewComment: null,
            }),
          },
          clockRecord: {
            findUnique: jest.fn().mockResolvedValue(existingClock),
            update: jest.fn().mockResolvedValue({
              ...existingClock,
              clockOut: new Date('2026-04-06T10:00:00Z'),
              status: 'AMENDED',
            }),
          },
        };
        return callback(tx);
      });

      prisma.user.findUnique.mockResolvedValue({
        id: mockReviewerId,
        name: '李大華',
      });

      const result = await service.approve('req-2', mockReviewer);

      expect(result.status).toBe('approved');
    });

    it('should throw FORBIDDEN when trying to self-approve', async () => {
      const selfRequest = {
        id: 'req-self',
        userId: mockReviewerId, // 申請人就是審核人
        date: makeDateOnly(2026, 4, 6),
        clockType: 'CLOCK_IN',
        requestedTime: new Date('2026-04-06T01:00:00Z'),
        reason: '忘記打卡',
        status: 'PENDING',
        user: {
          id: mockReviewerId,
          managerId: 'another-manager',
          departmentId: 'dept-uuid-1',
        },
      };

      prisma.missedClockRequest.findUnique.mockResolvedValue(selfRequest);

      await expect(
        service.approve('req-self', mockReviewer),
      ).rejects.toThrow(HttpException);

      try {
        await service.approve('req-self', mockReviewer);
      } catch (e) {
        const ex = e as HttpException;
        expect(ex.getStatus()).toBe(HttpStatus.FORBIDDEN);
      }
    });

    it('should throw FORBIDDEN when manager reviews non-subordinate', async () => {
      const otherRequest = {
        id: 'req-other',
        userId: 'other-user',
        date: makeDateOnly(2026, 4, 6),
        clockType: 'CLOCK_IN',
        requestedTime: new Date('2026-04-06T01:00:00Z'),
        reason: '忘記打卡',
        status: 'PENDING',
        user: {
          id: 'other-user',
          managerId: 'another-manager', // 不是 reviewer 的部屬
          departmentId: 'dept-uuid-2',
        },
      };

      prisma.missedClockRequest.findUnique.mockResolvedValue(otherRequest);

      await expect(
        service.approve('req-other', mockReviewer),
      ).rejects.toThrow(HttpException);

      try {
        await service.approve('req-other', mockReviewer);
      } catch (e) {
        const ex = e as HttpException;
        expect(ex.getStatus()).toBe(HttpStatus.FORBIDDEN);
      }
    });

    it('should throw NOT_PENDING when request is already approved', async () => {
      const approvedRequest = {
        id: 'req-approved',
        userId: mockUserId,
        date: makeDateOnly(2026, 4, 6),
        clockType: 'CLOCK_IN',
        requestedTime: new Date('2026-04-06T01:00:00Z'),
        reason: '忘記打卡',
        status: 'APPROVED',
        user: {
          id: mockUserId,
          managerId: mockReviewerId,
          departmentId: 'dept-uuid-1',
        },
      };

      prisma.missedClockRequest.findUnique.mockResolvedValue(approvedRequest);

      await expect(
        service.approve('req-approved', mockReviewer),
      ).rejects.toThrow(HttpException);

      try {
        await service.approve('req-approved', mockReviewer);
      } catch (e) {
        const ex = e as HttpException;
        expect(ex.getStatus()).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
        const resp = ex.getResponse() as Record<string, string>;
        expect(resp.code).toBe('NOT_PENDING');
      }
    });

    it('should allow admin to approve any request', async () => {
      const mockRequest = {
        id: 'req-admin',
        userId: mockUserId,
        date: makeDateOnly(2026, 4, 6),
        clockType: 'CLOCK_IN',
        requestedTime: new Date('2026-04-06T01:00:00Z'),
        reason: '忘記打卡',
        status: 'PENDING',
        user: {
          id: mockUserId,
          managerId: 'some-other-manager',
          departmentId: 'dept-uuid-2',
        },
      };

      prisma.missedClockRequest.findUnique.mockResolvedValue(mockRequest);

      prisma.$transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          missedClockRequest: {
            findUnique: jest.fn().mockResolvedValue({ ...mockRequest, status: 'PENDING' }),
            update: jest.fn().mockResolvedValue({
              ...mockRequest,
              status: 'APPROVED',
              reviewerId: mockAdminReviewer.userId,
              reviewedAt: new Date(),
              reviewComment: null,
            }),
          },
          clockRecord: {
            findUnique: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue({}),
          },
        };
        return callback(tx);
      });

      prisma.user.findUnique.mockResolvedValue({
        id: mockAdminReviewer.userId,
        name: 'Admin',
      });

      const result = await service.approve('req-admin', mockAdminReviewer);
      expect(result.status).toBe('approved');
    });
  });

  describe('reject', () => {
    it('should reject a pending request', async () => {
      const mockRequest = {
        id: 'req-1',
        userId: mockUserId,
        date: makeDateOnly(2026, 4, 6),
        clockType: 'CLOCK_IN',
        requestedTime: new Date('2026-04-06T01:00:00Z'),
        reason: '忘記打卡',
        status: 'PENDING',
        user: {
          id: mockUserId,
          managerId: mockReviewerId,
          departmentId: 'dept-uuid-1',
        },
      };

      prisma.missedClockRequest.findUnique.mockResolvedValue(mockRequest);

      prisma.$transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          missedClockRequest: {
            findUnique: jest.fn().mockResolvedValue({ ...mockRequest, status: 'PENDING' }),
            update: jest.fn().mockResolvedValue({
              ...mockRequest,
              status: 'REJECTED',
              reviewerId: mockReviewerId,
              reviewedAt: new Date('2026-04-07T15:00:00Z'),
              reviewComment: '時間不合理',
            }),
          },
        };
        return callback(tx);
      });

      prisma.user.findUnique.mockResolvedValue({
        id: mockReviewerId,
        name: '李大華',
      });

      const result = await service.reject('req-1', mockReviewer, '時間不合理');

      expect(result.status).toBe('rejected');
      expect(result.review_comment).toBe('時間不合理');
    });

    it('should throw NOT_FOUND when request does not exist', async () => {
      prisma.missedClockRequest.findUnique.mockResolvedValue(null);

      await expect(
        service.reject('non-exist', mockReviewer, '原因'),
      ).rejects.toThrow(HttpException);
    });
  });

  describe('findPending', () => {
    it('should return pending requests for manager (subordinates only)', async () => {
      const items = [
        {
          id: 'req-1',
          date: makeDateOnly(2026, 4, 6),
          clockType: 'CLOCK_IN',
          requestedTime: new Date('2026-04-06T01:00:00Z'),
          reason: '忘記打卡',
          status: 'PENDING',
          createdAt: new Date('2026-04-07T10:00:00Z'),
          user: {
            id: mockUserId,
            name: '測試員工',
            employeeId: 'EMP001',
            department: { id: 'dept-1', name: '工程部' },
          },
        },
      ];

      prisma.missedClockRequest.findMany.mockResolvedValue(items);
      prisma.missedClockRequest.count.mockResolvedValue(1);

      const result = await service.findPending(mockReviewer, {});

      expect(result.data).toHaveLength(1);
      expect(result.data[0].user.name).toBe('測試員工');

      // 確認查詢條件包含 managerId 過濾
      expect(prisma.missedClockRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            status: 'PENDING',
            user: { managerId: mockReviewerId },
          },
        }),
      );
    });

    it('should return all pending requests for admin', async () => {
      prisma.missedClockRequest.findMany.mockResolvedValue([]);
      prisma.missedClockRequest.count.mockResolvedValue(0);

      await service.findPending(mockAdminReviewer, {});

      expect(prisma.missedClockRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'PENDING' },
        }),
      );
    });
  });
});
