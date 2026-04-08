import { Test, TestingModule } from '@nestjs/testing';
import {
  HttpException,
  HttpStatus,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { LeaveApprovalService } from '../../src/leave-approval/leave-approval.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { Prisma } from '@prisma/client';

const Decimal = Prisma.Decimal;

describe('LeaveApprovalService', () => {
  let service: LeaveApprovalService;
  let prisma: {
    leaveRequest: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      count: jest.Mock;
    };
    leaveQuota: {
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    user: {
      findUnique: jest.Mock;
    };
    $transaction: jest.Mock;
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

  const mockLeave = {
    id: 'leave-uuid-1',
    userId: 'employee-uuid-1',
    leaveType: 'ANNUAL',
    startDate: new Date('2026-04-10'),
    endDate: new Date('2026-04-10'),
    startHalf: 'FULL',
    endHalf: 'FULL',
    hours: new Decimal(8),
    reason: '家庭旅遊',
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

  const mockLeaveWithUserInfo = {
    ...mockLeave,
    user: {
      id: 'employee-uuid-1',
      name: '王小明',
      employeeId: 'EMP001',
      department: { id: 'dept-uuid-1', name: '工程部' },
    },
  };

  const mockQuota = {
    id: 'quota-uuid-1',
    userId: 'employee-uuid-1',
    leaveType: 'ANNUAL',
    year: 2026,
    totalHours: new Decimal(56),
    usedHours: new Decimal(16),
  };

  const mockReviewerUser = {
    id: 'manager-uuid-1',
    name: '李大華',
  };

  beforeEach(async () => {
    prisma = {
      leaveRequest: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      leaveQuota: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeaveApprovalService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<LeaveApprovalService>(LeaveApprovalService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ── getPendingLeaves ──

  describe('getPendingLeaves', () => {
    it('should return pending leaves for manager (direct subordinates only)', async () => {
      const mockLeaves = [mockLeaveWithUserInfo];
      prisma.leaveRequest.findMany.mockResolvedValue(mockLeaves);
      prisma.leaveRequest.count.mockResolvedValue(1);

      const result = await service.getPendingLeaves(managerUser, {});

      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('leave-uuid-1');
      expect(result.data[0].user.employee_id).toBe('EMP001');
      expect(result.data[0].leave_type).toBe('annual');
      expect(result.data[0].status).toBe('pending');
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(20);

      // 確認查詢條件包含 managerId
      expect(prisma.leaveRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            status: 'PENDING',
            user: { managerId: 'manager-uuid-1' },
          },
        }),
      );
    });

    it('should return pending leaves for admin (all company)', async () => {
      prisma.leaveRequest.findMany.mockResolvedValue([]);
      prisma.leaveRequest.count.mockResolvedValue(0);

      const result = await service.getPendingLeaves(adminUser, {});

      expect(result.data).toHaveLength(0);
      expect(prisma.leaveRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'PENDING' },
        }),
      );
    });

    it('should filter by department_id for admin', async () => {
      prisma.leaveRequest.findMany.mockResolvedValue([]);
      prisma.leaveRequest.count.mockResolvedValue(0);

      await service.getPendingLeaves(adminUser, {
        department_id: 'dept-uuid-2',
      });

      expect(prisma.leaveRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            status: 'PENDING',
            user: { departmentId: 'dept-uuid-2' },
          },
        }),
      );
    });

    it('should apply pagination correctly', async () => {
      prisma.leaveRequest.findMany.mockResolvedValue([]);
      prisma.leaveRequest.count.mockResolvedValue(45);

      const result = await service.getPendingLeaves(adminUser, {
        page: 2,
        limit: 10,
      });

      expect(result.meta.page).toBe(2);
      expect(result.meta.limit).toBe(10);
      expect(result.meta.totalPages).toBe(5);
      expect(prisma.leaveRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
        }),
      );
    });

    it('should default to page 1, limit 20', async () => {
      prisma.leaveRequest.findMany.mockResolvedValue([]);
      prisma.leaveRequest.count.mockResolvedValue(0);

      const result = await service.getPendingLeaves(managerUser, {});

      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(20);
      expect(prisma.leaveRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 20,
        }),
      );
    });
  });

  // ── approveLeave ──

  describe('approveLeave', () => {
    it('should approve a pending leave and deduct quota', async () => {
      prisma.leaveRequest.findUnique.mockResolvedValue(mockLeave);
      prisma.user.findUnique.mockResolvedValue(mockReviewerUser);

      // $transaction 以 callback 方式呼叫
      prisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          leaveRequest: {
            findUnique: jest.fn().mockResolvedValue(mockLeave),
            update: jest.fn().mockResolvedValue({
              ...mockLeave,
              status: 'APPROVED',
              reviewerId: 'manager-uuid-1',
              reviewedAt: new Date('2026-04-07T14:00:00Z'),
              reviewComment: '核准',
              updatedAt: new Date('2026-04-07T14:00:00Z'),
            }),
          },
          leaveQuota: {
            findUnique: jest.fn().mockResolvedValue(mockQuota),
            update: jest.fn().mockResolvedValue({}),
          },
        };
        return callback(tx);
      });

      const result = await service.approveLeave(
        'leave-uuid-1',
        managerUser,
        '核准',
      );

      expect(result.id).toBe('leave-uuid-1');
      expect(result.status).toBe('approved');
      expect(result.reviewer).toEqual({ id: 'manager-uuid-1', name: '李大華' });
      expect(result.review_comment).toBe('核准');
      expect(result.reviewed_at).toBeDefined();
    });

    it('should approve leave without comment', async () => {
      prisma.leaveRequest.findUnique.mockResolvedValue(mockLeave);
      prisma.user.findUnique.mockResolvedValue(mockReviewerUser);

      prisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          leaveRequest: {
            findUnique: jest.fn().mockResolvedValue(mockLeave),
            update: jest.fn().mockResolvedValue({
              ...mockLeave,
              status: 'APPROVED',
              reviewerId: 'manager-uuid-1',
              reviewedAt: new Date(),
              reviewComment: null,
              updatedAt: new Date(),
            }),
          },
          leaveQuota: {
            findUnique: jest.fn().mockResolvedValue(mockQuota),
            update: jest.fn().mockResolvedValue({}),
          },
        };
        return callback(tx);
      });

      const result = await service.approveLeave(
        'leave-uuid-1',
        managerUser,
      );

      expect(result.status).toBe('approved');
      expect(result.review_comment).toBeNull();
    });

    it('should throw NOT_FOUND when leave does not exist', async () => {
      prisma.leaveRequest.findUnique.mockResolvedValue(null);

      await expect(
        service.approveLeave('nonexistent', managerUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NOT_PENDING when leave is already approved', async () => {
      prisma.leaveRequest.findUnique.mockResolvedValue({
        ...mockLeave,
        status: 'APPROVED',
      });

      try {
        await service.approveLeave('leave-uuid-1', managerUser);
        fail('Expected exception');
      } catch (e) {
        const exception = e as HttpException;
        expect(exception.getStatus()).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
        const response = exception.getResponse() as Record<string, string>;
        expect(response.code).toBe('NOT_PENDING');
      }
    });

    it('should throw FORBIDDEN when manager tries to approve non-subordinate', async () => {
      prisma.leaveRequest.findUnique.mockResolvedValue({
        ...mockLeave,
        user: {
          id: 'employee-uuid-1',
          managerId: 'other-manager-uuid',
          departmentId: 'dept-uuid-2',
        },
      });

      await expect(
        service.approveLeave('leave-uuid-1', managerUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw FORBIDDEN when reviewer tries to approve own leave', async () => {
      prisma.leaveRequest.findUnique.mockResolvedValue({
        ...mockLeave,
        userId: 'manager-uuid-1',
        user: {
          id: 'manager-uuid-1',
          managerId: 'upper-manager-uuid',
          departmentId: 'dept-uuid-1',
        },
      });

      try {
        await service.approveLeave('leave-uuid-1', managerUser);
        fail('Expected exception');
      } catch (e) {
        const exception = e as ForbiddenException;
        const response = exception.getResponse() as Record<string, string>;
        expect(response.code).toBe('FORBIDDEN');
        expect(response.message).toContain('不可審核自己');
      }
    });

    it('should allow admin to approve any leave', async () => {
      const leaveWithDifferentDept = {
        ...mockLeave,
        user: {
          id: 'employee-uuid-1',
          managerId: 'other-manager-uuid',
          departmentId: 'dept-uuid-2',
        },
      };
      prisma.leaveRequest.findUnique.mockResolvedValue(leaveWithDifferentDept);
      prisma.user.findUnique.mockResolvedValue({
        id: 'admin-uuid-1',
        name: 'Admin',
      });

      prisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          leaveRequest: {
            findUnique: jest.fn().mockResolvedValue(leaveWithDifferentDept),
            update: jest.fn().mockResolvedValue({
              ...leaveWithDifferentDept,
              status: 'APPROVED',
              reviewerId: 'admin-uuid-1',
              reviewedAt: new Date(),
              reviewComment: null,
              updatedAt: new Date(),
            }),
          },
          leaveQuota: {
            findUnique: jest.fn().mockResolvedValue(mockQuota),
            update: jest.fn().mockResolvedValue({}),
          },
        };
        return callback(tx);
      });

      const result = await service.approveLeave('leave-uuid-1', adminUser);

      expect(result.status).toBe('approved');
    });

    it('should throw QUOTA_EXCEEDED when approval would exceed quota', async () => {
      const leaveWith48h = {
        ...mockLeave,
        hours: new Decimal(48),
      };
      prisma.leaveRequest.findUnique.mockResolvedValue(leaveWith48h);

      prisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          leaveRequest: {
            findUnique: jest.fn().mockResolvedValue(leaveWith48h),
            update: jest.fn().mockResolvedValue({}),
          },
          leaveQuota: {
            findUnique: jest.fn().mockResolvedValue({
              ...mockQuota,
              usedHours: new Decimal(16),
              totalHours: new Decimal(56),
            }),
            update: jest.fn(),
          },
        };
        return callback(tx);
      });

      try {
        await service.approveLeave('leave-uuid-1', managerUser);
        fail('Expected exception');
      } catch (e) {
        const exception = e as HttpException;
        expect(exception.getStatus()).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
        const response = exception.getResponse() as Record<string, string>;
        expect(response.code).toBe('QUOTA_EXCEEDED');
      }
    });

    it('should approve when quota usage reaches exactly total hours', async () => {
      const leaveWith40h = {
        ...mockLeave,
        hours: new Decimal(40),
      };
      prisma.leaveRequest.findUnique.mockResolvedValue(leaveWith40h);
      prisma.user.findUnique.mockResolvedValue(mockReviewerUser);

      prisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          leaveRequest: {
            findUnique: jest.fn().mockResolvedValue(leaveWith40h),
            update: jest.fn().mockResolvedValue({
              ...leaveWith40h,
              status: 'APPROVED',
              reviewerId: 'manager-uuid-1',
              reviewedAt: new Date(),
              reviewComment: null,
              updatedAt: new Date(),
            }),
          },
          leaveQuota: {
            findUnique: jest.fn().mockResolvedValue({
              ...mockQuota,
              usedHours: new Decimal(16),
              totalHours: new Decimal(56),
            }),
            update: jest.fn().mockResolvedValue({}),
          },
        };
        return callback(tx);
      });

      const result = await service.approveLeave(
        'leave-uuid-1',
        managerUser,
      );

      expect(result.status).toBe('approved');
    });
  });

  // ── rejectLeave ──

  describe('rejectLeave', () => {
    it('should reject a pending leave with comment', async () => {
      prisma.leaveRequest.findUnique.mockResolvedValue(mockLeave);
      prisma.user.findUnique.mockResolvedValue(mockReviewerUser);

      prisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          leaveRequest: {
            findUnique: jest.fn().mockResolvedValue(mockLeave),
            update: jest.fn().mockResolvedValue({
              ...mockLeave,
              status: 'REJECTED',
              reviewerId: 'manager-uuid-1',
              reviewedAt: new Date('2026-04-07T14:00:00Z'),
              reviewComment: '該週有重要專案 deadline',
              updatedAt: new Date('2026-04-07T14:00:00Z'),
            }),
          },
        };
        return callback(tx);
      });

      const result = await service.rejectLeave(
        'leave-uuid-1',
        managerUser,
        '該週有重要專案 deadline',
      );

      expect(result.id).toBe('leave-uuid-1');
      expect(result.status).toBe('rejected');
      expect(result.review_comment).toBe('該週有重要專案 deadline');
      expect(result.reviewer).toEqual({ id: 'manager-uuid-1', name: '李大華' });
    });

    it('should throw NOT_FOUND when leave does not exist', async () => {
      prisma.leaveRequest.findUnique.mockResolvedValue(null);

      await expect(
        service.rejectLeave('nonexistent', managerUser, '原因'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NOT_PENDING when leave is already rejected', async () => {
      prisma.leaveRequest.findUnique.mockResolvedValue({
        ...mockLeave,
        status: 'REJECTED',
      });

      try {
        await service.rejectLeave('leave-uuid-1', managerUser, '原因');
        fail('Expected exception');
      } catch (e) {
        const exception = e as HttpException;
        expect(exception.getStatus()).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
        const response = exception.getResponse() as Record<string, string>;
        expect(response.code).toBe('NOT_PENDING');
      }
    });

    it('should throw FORBIDDEN when manager tries to reject non-subordinate', async () => {
      prisma.leaveRequest.findUnique.mockResolvedValue({
        ...mockLeave,
        user: {
          id: 'employee-uuid-1',
          managerId: 'other-manager-uuid',
          departmentId: 'dept-uuid-2',
        },
      });

      await expect(
        service.rejectLeave('leave-uuid-1', managerUser, '原因'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw FORBIDDEN when reviewer tries to reject own leave', async () => {
      prisma.leaveRequest.findUnique.mockResolvedValue({
        ...mockLeave,
        userId: 'manager-uuid-1',
        user: {
          id: 'manager-uuid-1',
          managerId: 'upper-manager-uuid',
          departmentId: 'dept-uuid-1',
        },
      });

      try {
        await service.rejectLeave('leave-uuid-1', managerUser, '原因');
        fail('Expected exception');
      } catch (e) {
        const exception = e as ForbiddenException;
        const response = exception.getResponse() as Record<string, string>;
        expect(response.code).toBe('FORBIDDEN');
        expect(response.message).toContain('不可審核自己');
      }
    });

    it('should not deduct quota when rejecting', async () => {
      prisma.leaveRequest.findUnique.mockResolvedValue(mockLeave);
      prisma.user.findUnique.mockResolvedValue(mockReviewerUser);

      prisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          leaveRequest: {
            findUnique: jest.fn().mockResolvedValue(mockLeave),
            update: jest.fn().mockResolvedValue({
              ...mockLeave,
              status: 'REJECTED',
              reviewerId: 'manager-uuid-1',
              reviewedAt: new Date(),
              reviewComment: '不准',
              updatedAt: new Date(),
            }),
          },
        };
        return callback(tx);
      });

      await service.rejectLeave('leave-uuid-1', managerUser, '不准');

      // leaveQuota.update should never be called
      expect(prisma.leaveQuota.update).not.toHaveBeenCalled();
    });

    it('should allow admin to reject any leave', async () => {
      const leaveWithDifferentDept = {
        ...mockLeave,
        user: {
          id: 'employee-uuid-1',
          managerId: 'other-manager-uuid',
          departmentId: 'dept-uuid-2',
        },
      };
      prisma.leaveRequest.findUnique.mockResolvedValue(leaveWithDifferentDept);
      prisma.user.findUnique.mockResolvedValue({
        id: 'admin-uuid-1',
        name: 'Admin',
      });

      prisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          leaveRequest: {
            findUnique: jest.fn().mockResolvedValue(leaveWithDifferentDept),
            update: jest.fn().mockResolvedValue({
              ...leaveWithDifferentDept,
              status: 'REJECTED',
              reviewerId: 'admin-uuid-1',
              reviewedAt: new Date(),
              reviewComment: '公司政策',
              updatedAt: new Date(),
            }),
          },
        };
        return callback(tx);
      });

      const result = await service.rejectLeave(
        'leave-uuid-1',
        adminUser,
        '公司政策',
      );

      expect(result.status).toBe('rejected');
    });
  });
});
