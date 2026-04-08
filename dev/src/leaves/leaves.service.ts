import {
  Injectable,
  HttpException,
  HttpStatus,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LeaveQuotasService } from '../leave-quotas/leave-quotas.service';
import { CreateLeaveDto, HalfDayEnum } from './dto/create-leave.dto';
import { QueryLeavesDto } from './dto/query-leaves.dto';

type Decimal = Prisma.Decimal;
const Decimal = Prisma.Decimal;

/** LeaveType DTO 值 -> Prisma enum 值對照 */
const LEAVE_TYPE_MAP: Record<string, string> = {
  personal: 'PERSONAL',
  sick: 'SICK',
  annual: 'ANNUAL',
  marriage: 'MARRIAGE',
  bereavement: 'BEREAVEMENT',
  maternity: 'MATERNITY',
  paternity: 'PATERNITY',
  official: 'OFFICIAL',
};

/** LeaveStatus DTO 值 -> Prisma enum 值對照 */
const LEAVE_STATUS_MAP: Record<string, string> = {
  pending: 'PENDING',
  approved: 'APPROVED',
  rejected: 'REJECTED',
  cancelled: 'CANCELLED',
};

/** HalfDay DTO 值 -> Prisma enum 值對照 */
const HALF_DAY_MAP: Record<string, string> = {
  full: 'FULL',
  morning: 'MORNING',
  afternoon: 'AFTERNOON',
};

@Injectable()
export class LeavesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly leaveQuotasService: LeaveQuotasService,
  ) {}

  /**
   * 計算請假時數
   * - 同一天：依 startHalf 決定（full=8, morning=4, afternoon=4）
   * - 跨天：首日 half + (中間天數 * 8) + 末日 half
   */
  calculateLeaveHours(
    startDate: Date,
    endDate: Date,
    startHalf: HalfDayEnum,
    endHalf: HalfDayEnum,
  ): number {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(0, 0, 0, 0);

    const diffDays = Math.round(
      (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (diffDays === 0) {
      // 同一天：startHalf 和 endHalf 相同，取 startHalf
      return startHalf === HalfDayEnum.FULL ? 8 : 4;
    }

    // 跨天
    const startDayHours = startHalf === HalfDayEnum.FULL ? 8 : 4;
    const endDayHours = endHalf === HalfDayEnum.FULL ? 8 : 4;
    const middleDays = diffDays - 1;

    return startDayHours + middleDays * 8 + endDayHours;
  }

  /**
   * 申請請假
   */
  async createLeave(userId: string, dto: CreateLeaveDto) {
    const leaveType = LEAVE_TYPE_MAP[dto.leave_type];
    const startHalf = HALF_DAY_MAP[dto.start_half || 'full'];
    const endHalf = HALF_DAY_MAP[dto.end_half || 'full'];

    const startDate = new Date(dto.start_date + 'T00:00:00.000Z');
    const endDate = new Date(dto.end_date + 'T00:00:00.000Z');

    // 驗證 end_date >= start_date
    if (endDate < startDate) {
      throw new HttpException(
        {
          code: 'INVALID_INPUT',
          message: 'end_date 不可早於 start_date',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    // 驗證日期不在過去（病假可追溯 3 天）
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    if (leaveType === 'SICK') {
      const minDate = new Date(today);
      minDate.setDate(minDate.getDate() - 3);
      if (startDate < minDate) {
        throw new HttpException(
          {
            code: 'PAST_DATE',
            message: '病假最多可追溯 3 天',
          },
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }
    } else {
      if (startDate < today) {
        throw new HttpException(
          {
            code: 'PAST_DATE',
            message: '不可申請過去的日期',
          },
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }
    }

    // 計算時數
    const hours = this.calculateLeaveHours(
      startDate,
      endDate,
      (dto.start_half || 'full') as HalfDayEnum,
      (dto.end_half || 'full') as HalfDayEnum,
    );

    // 檢查日期衝突（pending 或 approved 的假單日期重疊）
    await this.checkDateConflict(userId, startDate, endDate);

    // 檢查額度
    await this.checkQuota(userId, leaveType, hours, startDate);

    // 建立請假紀錄
    const leave = await this.prisma.leaveRequest.create({
      data: {
        userId,
        leaveType: leaveType as never,
        startDate,
        endDate,
        startHalf: startHalf as never,
        endHalf: endHalf as never,
        hours: new Decimal(hours),
        reason: dto.reason,
        status: 'PENDING' as never,
      },
    });

    return this.formatLeaveResponse(leave);
  }

  /**
   * 查詢個人請假紀錄
   */
  async getLeaves(userId: string, query: QueryLeavesDto) {
    const { page = 1, limit = 20 } = query;

    const where: Record<string, unknown> = { userId };

    if (query.status) {
      where.status = LEAVE_STATUS_MAP[query.status];
    }
    if (query.leave_type) {
      where.leaveType = LEAVE_TYPE_MAP[query.leave_type];
    }
    if (query.start_date || query.end_date) {
      const dateFilter: Record<string, Date> = {};
      if (query.start_date) {
        dateFilter.gte = new Date(query.start_date + 'T00:00:00.000Z');
      }
      if (query.end_date) {
        dateFilter.lte = new Date(query.end_date + 'T00:00:00.000Z');
      }
      where.startDate = dateFilter;
    }

    const [leaves, total] = await Promise.all([
      this.prisma.leaveRequest.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          reviewer: {
            select: { id: true, name: true },
          },
        },
      }),
      this.prisma.leaveRequest.count({ where }),
    ]);

    return {
      data: leaves.map((leave) => this.formatLeaveListItem(leave)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * 請假詳情
   */
  async getLeaveById(
    leaveId: string,
    userId: string,
    userRole: string,
    userDepartmentId: string,
  ) {
    const leave = await this.prisma.leaveRequest.findUnique({
      where: { id: leaveId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            employeeId: true,
            departmentId: true,
            department: { select: { id: true, name: true } },
          },
        },
        reviewer: {
          select: { id: true, name: true },
        },
      },
    });

    if (!leave) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: '請假紀錄不存在',
      });
    }

    // 權限檢查：自己的、主管看部屬的、Admin 看全部
    if (leave.userId !== userId) {
      if (userRole === 'ADMIN') {
        // Admin 可看全部
      } else if (userRole === 'MANAGER') {
        // 主管只能看同部門
        if (leave.user.departmentId !== userDepartmentId) {
          throw new ForbiddenException({
            code: 'FORBIDDEN',
            message: '無權查看此請假紀錄',
          });
        }
      } else {
        throw new ForbiddenException({
          code: 'FORBIDDEN',
          message: '無權查看此請假紀錄',
        });
      }
    }

    return this.formatLeaveDetail(leave);
  }

  /**
   * 取消請假
   */
  async cancelLeave(leaveId: string, userId: string) {
    const leave = await this.prisma.leaveRequest.findUnique({
      where: { id: leaveId },
    });

    if (!leave) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: '請假紀錄不存在',
      });
    }

    // 只能取消自己的
    if (leave.userId !== userId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: '只能取消自己的請假',
      });
    }

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    if (leave.status === 'PENDING') {
      // pending -> cancelled
      const updated = await this.prisma.leaveRequest.update({
        where: { id: leaveId },
        data: { status: 'CANCELLED' as never },
      });

      return {
        id: updated.id,
        status: 'cancelled',
        updated_at: updated.updatedAt.toISOString(),
      };
    }

    if (leave.status === 'APPROVED') {
      // approved + start_date > today -> cancelled + refund
      if (leave.startDate > today) {
        // 使用 transaction 同時取消假單並退還額度
        const year = leave.startDate.getFullYear();
        const leaveHours = Number(leave.hours);

        const [updated] = await this.prisma.$transaction([
          this.prisma.leaveRequest.update({
            where: { id: leaveId },
            data: { status: 'CANCELLED' as never },
          }),
          this.prisma.leaveQuota.updateMany({
            where: {
              userId: leave.userId,
              leaveType: leave.leaveType,
              year,
            },
            data: {
              usedHours: { decrement: leaveHours },
            },
          }),
        ]);

        return {
          id: updated.id,
          status: 'cancelled',
          updated_at: updated.updatedAt.toISOString(),
        };
      }

      // approved + start_date <= today -> 不可取消
      throw new HttpException(
        {
          code: 'LEAVE_STARTED',
          message: '已開始的假期無法取消',
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    // rejected / cancelled -> 不可取消
    throw new HttpException(
      {
        code: 'CANNOT_CANCEL',
        message: `狀態為 ${leave.status.toLowerCase()} 的假單無法取消`,
      },
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }

  // ── Private Methods ──

  /**
   * 檢查日期衝突：是否有 pending/approved 假單在同一日期範圍
   */
  private async checkDateConflict(
    userId: string,
    startDate: Date,
    endDate: Date,
  ) {
    const conflicting = await this.prisma.leaveRequest.findFirst({
      where: {
        userId,
        status: { in: ['PENDING', 'APPROVED'] as never[] },
        // 日期範圍重疊條件
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
    });

    if (conflicting) {
      throw new HttpException(
        {
          code: 'DATE_CONFLICT',
          message: '該日期範圍已有請假申請',
        },
        HttpStatus.CONFLICT,
      );
    }
  }

  /**
   * 檢查額度是否足夠
   */
  private async checkQuota(
    userId: string,
    leaveType: string,
    hours: number,
    startDate: Date,
  ) {
    const year = startDate.getFullYear();

    const quota = await this.prisma.leaveQuota.findUnique({
      where: {
        userId_leaveType_year: {
          userId,
          leaveType: leaveType as never,
          year,
        },
      },
    });

    if (!quota) {
      throw new HttpException(
        {
          code: 'INSUFFICIENT_QUOTA',
          message: '尚未設定該假別額度',
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    const remaining = Number(quota.totalHours) - Number(quota.usedHours);
    if (remaining < hours) {
      throw new HttpException(
        {
          code: 'INSUFFICIENT_QUOTA',
          message: `額度不足，剩餘 ${remaining} 小時，需要 ${hours} 小時`,
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
  }

  /**
   * 格式化單筆請假回應（POST 回傳）
   */
  private formatLeaveResponse(leave: {
    id: string;
    userId: string;
    leaveType: string;
    startDate: Date;
    endDate: Date;
    startHalf: string;
    endHalf: string;
    hours: Decimal | number;
    reason: string;
    status: string;
    reviewerId: string | null;
    reviewedAt: Date | null;
    reviewComment: string | null;
    createdAt: Date;
  }) {
    return {
      id: leave.id,
      user_id: leave.userId,
      leave_type: leave.leaveType.toLowerCase(),
      start_date: leave.startDate.toISOString().split('T')[0],
      end_date: leave.endDate.toISOString().split('T')[0],
      start_half: leave.startHalf.toLowerCase(),
      end_half: leave.endHalf.toLowerCase(),
      hours: Number(leave.hours),
      reason: leave.reason,
      status: leave.status.toLowerCase(),
      reviewer_id: leave.reviewerId,
      reviewed_at: leave.reviewedAt
        ? leave.reviewedAt.toISOString()
        : null,
      review_comment: leave.reviewComment,
      created_at: leave.createdAt.toISOString(),
    };
  }

  /**
   * 格式化列表項目（GET 列表回傳）
   */
  private formatLeaveListItem(leave: {
    id: string;
    leaveType: string;
    startDate: Date;
    endDate: Date;
    startHalf: string;
    endHalf: string;
    hours: Decimal | number;
    reason: string;
    status: string;
    reviewer: { id: string; name: string } | null;
    createdAt: Date;
  }) {
    return {
      id: leave.id,
      leave_type: leave.leaveType.toLowerCase(),
      start_date: leave.startDate.toISOString().split('T')[0],
      end_date: leave.endDate.toISOString().split('T')[0],
      start_half: leave.startHalf.toLowerCase(),
      end_half: leave.endHalf.toLowerCase(),
      hours: Number(leave.hours),
      reason: leave.reason,
      status: leave.status.toLowerCase(),
      reviewer: leave.reviewer
        ? { id: leave.reviewer.id, name: leave.reviewer.name }
        : null,
      created_at: leave.createdAt.toISOString(),
    };
  }

  /**
   * 格式化詳情（GET :id 回傳）
   */
  private formatLeaveDetail(leave: {
    id: string;
    userId: string;
    leaveType: string;
    startDate: Date;
    endDate: Date;
    startHalf: string;
    endHalf: string;
    hours: Decimal | number;
    reason: string;
    status: string;
    reviewerId: string | null;
    reviewedAt: Date | null;
    reviewComment: string | null;
    createdAt: Date;
    updatedAt: Date;
    user: {
      id: string;
      name: string;
      employeeId: string;
      departmentId: string;
      department: { id: string; name: string };
    };
    reviewer: { id: string; name: string } | null;
  }) {
    return {
      id: leave.id,
      user_id: leave.userId,
      leave_type: leave.leaveType.toLowerCase(),
      start_date: leave.startDate.toISOString().split('T')[0],
      end_date: leave.endDate.toISOString().split('T')[0],
      start_half: leave.startHalf.toLowerCase(),
      end_half: leave.endHalf.toLowerCase(),
      hours: Number(leave.hours),
      reason: leave.reason,
      status: leave.status.toLowerCase(),
      reviewer_id: leave.reviewerId,
      reviewed_at: leave.reviewedAt
        ? leave.reviewedAt.toISOString()
        : null,
      review_comment: leave.reviewComment,
      created_at: leave.createdAt.toISOString(),
      updated_at: leave.updatedAt.toISOString(),
      user: {
        id: leave.user.id,
        name: leave.user.name,
        employee_id: leave.user.employeeId,
        department: {
          id: leave.user.department.id,
          name: leave.user.department.name,
        },
      },
      reviewer: leave.reviewer
        ? { id: leave.reviewer.id, name: leave.reviewer.name }
        : null,
    };
  }
}
