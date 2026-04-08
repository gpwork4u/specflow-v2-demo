import {
  Injectable,
  HttpException,
  HttpStatus,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUserData } from '../auth/decorators/current-user.decorator';
import { CreateOvertimeDto } from './dto/create-overtime.dto';
import { QueryOvertimeDto } from './dto/query-overtime.dto';
import { QueryPendingOvertimeDto } from './dto/query-pending-overtime.dto';

type Decimal = Prisma.Decimal;
const Decimal = Prisma.Decimal;

/** 單次加班上限（小時） */
const MAX_SINGLE_OVERTIME_HOURS = 12;

/** 每月加班上限（小時，勞基法） */
const MAX_MONTHLY_OVERTIME_HOURS = 46;

/** 事後補申請上限（天） */
const MAX_RETROACTIVE_DAYS = 7;

/** OvertimeStatus DTO 值 -> Prisma enum 值對照 */
const OVERTIME_STATUS_MAP: Record<string, string> = {
  pending: 'PENDING',
  approved: 'APPROVED',
  rejected: 'REJECTED',
  cancelled: 'CANCELLED',
};

@Injectable()
export class OvertimeService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 計算加班時數
   * 以 0.5 小時為最小單位（無條件進位到 0.5）
   */
  calculateOvertimeHours(startTime: string, endTime: string): number {
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);

    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;
    const diffMinutes = endMinutes - startMinutes;

    if (diffMinutes <= 0) {
      return -1; // 表示無效
    }

    const rawHours = diffMinutes / 60;
    // 無條件進位到 0.5
    return Math.ceil(rawHours * 2) / 2;
  }

  /**
   * 申請加班
   */
  async createOvertime(userId: string, dto: CreateOvertimeDto) {
    // 驗證 end_time > start_time
    const hours = this.calculateOvertimeHours(dto.start_time, dto.end_time);
    if (hours <= 0) {
      throw new HttpException(
        {
          code: 'INVALID_TIME_RANGE',
          message: 'end_time 必須大於 start_time',
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    // 驗證單次加班不超過 12 小時
    if (hours > MAX_SINGLE_OVERTIME_HOURS) {
      throw new HttpException(
        {
          code: 'INVALID_TIME_RANGE',
          message: `單次加班不得超過 ${MAX_SINGLE_OVERTIME_HOURS} 小時`,
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    // 驗證日期：可以是未來或過去 7 天內
    const date = new Date(dto.date + 'T00:00:00.000Z');
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const minDate = new Date(today);
    minDate.setDate(minDate.getDate() - MAX_RETROACTIVE_DAYS);

    if (date < minDate) {
      throw new HttpException(
        {
          code: 'PAST_DATE',
          message: `事後補申請加班限 ${MAX_RETROACTIVE_DAYS} 天內`,
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    // 檢查同日衝突（pending 或 approved）
    await this.checkDateConflict(userId, date);

    // 檢查月加班上限（pending + approved）
    await this.checkMonthlyLimit(userId, date, hours);

    // 建立加班紀錄
    const overtime = await this.prisma.overtimeRequest.create({
      data: {
        userId,
        date,
        startTime: dto.start_time,
        endTime: dto.end_time,
        hours: new Decimal(hours),
        reason: dto.reason,
        status: 'PENDING' as never,
      },
    });

    return this.formatOvertimeResponse(overtime);
  }

  /**
   * 查詢個人加班紀錄
   */
  async getOvertimeList(userId: string, query: QueryOvertimeDto) {
    const { page = 1, limit = 20 } = query;

    const where: Record<string, unknown> = { userId };

    if (query.status) {
      where.status = OVERTIME_STATUS_MAP[query.status];
    }
    if (query.start_date || query.end_date) {
      const dateFilter: Record<string, Date> = {};
      if (query.start_date) {
        dateFilter.gte = new Date(query.start_date + 'T00:00:00.000Z');
      }
      if (query.end_date) {
        dateFilter.lte = new Date(query.end_date + 'T00:00:00.000Z');
      }
      where.date = dateFilter;
    }

    const [data, total] = await Promise.all([
      this.prisma.overtimeRequest.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.overtimeRequest.count({ where }),
    ]);

    return {
      data: data.map((ot) => this.formatOvertimeListItem(ot)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * 加班詳情
   */
  async getOvertimeById(
    overtimeId: string,
    userId: string,
    userRole: string,
    userDepartmentId: string,
  ) {
    const overtime = await this.prisma.overtimeRequest.findUnique({
      where: { id: overtimeId },
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

    if (!overtime) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: '加班紀錄不存在',
      });
    }

    // 權限檢查：自己的、主管看部屬的、Admin 看全部
    if (overtime.userId !== userId) {
      if (userRole === 'ADMIN') {
        // Admin 可看全部
      } else if (userRole === 'MANAGER') {
        if (overtime.user.departmentId !== userDepartmentId) {
          throw new ForbiddenException({
            code: 'FORBIDDEN',
            message: '無權查看此加班紀錄',
          });
        }
      } else {
        throw new ForbiddenException({
          code: 'FORBIDDEN',
          message: '無權查看此加班紀錄',
        });
      }
    }

    return this.formatOvertimeDetail(overtime);
  }

  /**
   * 取消加班申請（只能取消自己的 pending）
   */
  async cancelOvertime(overtimeId: string, userId: string) {
    const overtime = await this.prisma.overtimeRequest.findUnique({
      where: { id: overtimeId },
    });

    if (!overtime) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: '加班紀錄不存在',
      });
    }

    if (overtime.userId !== userId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: '只能取消自己的加班申請',
      });
    }

    if (overtime.status !== 'PENDING') {
      throw new HttpException(
        {
          code: 'CANNOT_CANCEL',
          message: `狀態為 ${overtime.status.toLowerCase()} 的加班申請無法取消`,
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    const updated = await this.prisma.overtimeRequest.update({
      where: { id: overtimeId },
      data: { status: 'CANCELLED' as never },
    });

    return {
      id: updated.id,
      status: 'cancelled',
    };
  }

  /**
   * 查詢待審核加班申請（manager/admin）
   */
  async getPendingOvertimes(
    user: CurrentUserData,
    query: QueryPendingOvertimeDto,
  ) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where = this.buildPendingWhereClause(user, query.department_id);

    const [data, total] = await Promise.all([
      this.prisma.overtimeRequest.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              employeeId: true,
              department: {
                select: { id: true, name: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.overtimeRequest.count({ where }),
    ]);

    return {
      data: data.map((ot) => this.formatOvertimeWithUser(ot)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * 核准加班
   */
  async approveOvertime(
    overtimeId: string,
    reviewer: CurrentUserData,
    comment?: string,
  ) {
    const overtime = await this.findAndValidateOvertime(overtimeId, reviewer);

    const now = new Date();

    const result = await this.prisma.$transaction(async (tx) => {
      // 再次確認狀態（避免併發問題）
      const freshOvertime = await tx.overtimeRequest.findUnique({
        where: { id: overtimeId },
      });
      if (!freshOvertime || freshOvertime.status !== 'PENDING') {
        throw new HttpException(
          {
            code: 'NOT_PENDING',
            message: '此加班申請已不是待審核狀態',
          },
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }

      return tx.overtimeRequest.update({
        where: { id: overtimeId },
        data: {
          status: 'APPROVED',
          reviewerId: reviewer.userId,
          reviewedAt: now,
          reviewComment: comment || null,
        },
      });
    });

    const reviewerUser = await this.prisma.user.findUnique({
      where: { id: reviewer.userId },
      select: { id: true, name: true },
    });

    return {
      id: result.id,
      status: 'approved',
      reviewer: reviewerUser
        ? { id: reviewerUser.id, name: reviewerUser.name }
        : null,
      reviewed_at: result.reviewedAt?.toISOString(),
      review_comment: result.reviewComment,
      updated_at: result.updatedAt.toISOString(),
    };
  }

  /**
   * 駁回加班
   */
  async rejectOvertime(
    overtimeId: string,
    reviewer: CurrentUserData,
    comment: string,
  ) {
    const overtime = await this.findAndValidateOvertime(overtimeId, reviewer);

    const now = new Date();

    const result = await this.prisma.$transaction(async (tx) => {
      const freshOvertime = await tx.overtimeRequest.findUnique({
        where: { id: overtimeId },
      });
      if (!freshOvertime || freshOvertime.status !== 'PENDING') {
        throw new HttpException(
          {
            code: 'NOT_PENDING',
            message: '此加班申請已不是待審核狀態',
          },
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }

      return tx.overtimeRequest.update({
        where: { id: overtimeId },
        data: {
          status: 'REJECTED',
          reviewerId: reviewer.userId,
          reviewedAt: now,
          reviewComment: comment,
        },
      });
    });

    const reviewerUser = await this.prisma.user.findUnique({
      where: { id: reviewer.userId },
      select: { id: true, name: true },
    });

    return {
      id: result.id,
      status: 'rejected',
      reviewer: reviewerUser
        ? { id: reviewerUser.id, name: reviewerUser.name }
        : null,
      reviewed_at: result.reviewedAt?.toISOString(),
      review_comment: result.reviewComment,
      updated_at: result.updatedAt.toISOString(),
    };
  }

  // ── Private Methods ──

  /**
   * 檢查同日衝突（pending 或 approved）
   */
  private async checkDateConflict(userId: string, date: Date) {
    const conflicting = await this.prisma.overtimeRequest.findFirst({
      where: {
        userId,
        date,
        status: { in: ['PENDING', 'APPROVED'] as never[] },
      },
    });

    if (conflicting) {
      throw new HttpException(
        {
          code: 'DATE_CONFLICT',
          message: '該日期已有加班申請',
        },
        HttpStatus.CONFLICT,
      );
    }
  }

  /**
   * 檢查月加班上限（pending + approved 的時數加總）
   */
  private async checkMonthlyLimit(
    userId: string,
    date: Date,
    newHours: number,
  ) {
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth();

    const monthStart = new Date(Date.UTC(year, month, 1));
    const monthEnd = new Date(Date.UTC(year, month + 1, 0));

    const result = await this.prisma.overtimeRequest.aggregate({
      where: {
        userId,
        date: { gte: monthStart, lte: monthEnd },
        status: { in: ['PENDING', 'APPROVED'] as never[] },
      },
      _sum: { hours: true },
    });

    const currentMonthHours = Number(result._sum.hours || 0);
    const remaining = MAX_MONTHLY_OVERTIME_HOURS - currentMonthHours;

    if (currentMonthHours + newHours > MAX_MONTHLY_OVERTIME_HOURS) {
      throw new HttpException(
        {
          code: 'MONTHLY_LIMIT_EXCEEDED',
          message: `本月加班時數已達上限，剩餘可申請 ${remaining} 小時`,
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
  }

  /**
   * 根據角色建立 pending 查詢條件
   */
  private buildPendingWhereClause(
    user: CurrentUserData,
    departmentId?: string,
  ) {
    const baseWhere: Record<string, unknown> = {
      status: 'PENDING',
    };

    if (user.role === 'ADMIN') {
      if (departmentId) {
        baseWhere.user = { departmentId };
      }
    } else {
      // Manager 只看直屬部屬
      baseWhere.user = { managerId: user.userId };
    }

    return baseWhere;
  }

  /**
   * 查找加班申請並驗證審核權限
   */
  private async findAndValidateOvertime(
    overtimeId: string,
    reviewer: CurrentUserData,
  ) {
    const overtime = await this.prisma.overtimeRequest.findUnique({
      where: { id: overtimeId },
      include: {
        user: {
          select: {
            id: true,
            managerId: true,
            departmentId: true,
          },
        },
      },
    });

    if (!overtime) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: '加班申請不存在',
      });
    }

    if (overtime.status !== 'PENDING') {
      throw new HttpException(
        {
          code: 'NOT_PENDING',
          message: '此加班申請已不是待審核狀態，無法進行審核',
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    // 不可審核自己的
    if (overtime.userId === reviewer.userId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: '不可審核自己的加班申請',
      });
    }

    // Manager 只能審核直屬部屬
    if (reviewer.role === 'MANAGER') {
      if (overtime.user.managerId !== reviewer.userId) {
        throw new ForbiddenException({
          code: 'FORBIDDEN',
          message: '只能審核直屬部屬的加班申請',
        });
      }
    }

    return overtime;
  }

  /**
   * 格式化單筆加班回應（POST 回傳）
   */
  private formatOvertimeResponse(overtime: {
    id: string;
    userId: string;
    date: Date;
    startTime: string;
    endTime: string;
    hours: Decimal | number;
    reason: string;
    status: string;
    reviewerId: string | null;
    reviewedAt: Date | null;
    reviewComment: string | null;
    createdAt: Date;
  }) {
    return {
      id: overtime.id,
      user_id: overtime.userId,
      date: overtime.date.toISOString().split('T')[0],
      start_time: overtime.startTime,
      end_time: overtime.endTime,
      hours: Number(overtime.hours),
      reason: overtime.reason,
      status: overtime.status.toLowerCase(),
      reviewer_id: overtime.reviewerId,
      reviewed_at: overtime.reviewedAt
        ? overtime.reviewedAt.toISOString()
        : null,
      review_comment: overtime.reviewComment,
      created_at: overtime.createdAt.toISOString(),
    };
  }

  /**
   * 格式化列表項目
   */
  private formatOvertimeListItem(overtime: {
    id: string;
    date: Date;
    startTime: string;
    endTime: string;
    hours: Decimal | number;
    reason: string;
    status: string;
    createdAt: Date;
  }) {
    return {
      id: overtime.id,
      date: overtime.date.toISOString().split('T')[0],
      start_time: overtime.startTime,
      end_time: overtime.endTime,
      hours: Number(overtime.hours),
      reason: overtime.reason,
      status: overtime.status.toLowerCase(),
      created_at: overtime.createdAt.toISOString(),
    };
  }

  /**
   * 格式化詳情
   */
  private formatOvertimeDetail(overtime: {
    id: string;
    userId: string;
    date: Date;
    startTime: string;
    endTime: string;
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
      id: overtime.id,
      user_id: overtime.userId,
      date: overtime.date.toISOString().split('T')[0],
      start_time: overtime.startTime,
      end_time: overtime.endTime,
      hours: Number(overtime.hours),
      reason: overtime.reason,
      status: overtime.status.toLowerCase(),
      reviewer_id: overtime.reviewerId,
      reviewed_at: overtime.reviewedAt
        ? overtime.reviewedAt.toISOString()
        : null,
      review_comment: overtime.reviewComment,
      created_at: overtime.createdAt.toISOString(),
      updated_at: overtime.updatedAt.toISOString(),
      user: {
        id: overtime.user.id,
        name: overtime.user.name,
        employee_id: overtime.user.employeeId,
        department: {
          id: overtime.user.department.id,
          name: overtime.user.department.name,
        },
      },
      reviewer: overtime.reviewer
        ? { id: overtime.reviewer.id, name: overtime.reviewer.name }
        : null,
    };
  }

  /**
   * 格式化加班紀錄（含使用者資訊，用於 pending 列表）
   */
  private formatOvertimeWithUser(overtime: {
    id: string;
    date: Date;
    startTime: string;
    endTime: string;
    hours: unknown;
    reason: string;
    status: string;
    createdAt: Date;
    user: {
      id: string;
      name: string;
      employeeId: string;
      department: { id: string; name: string };
    };
  }) {
    return {
      id: overtime.id,
      user: {
        id: overtime.user.id,
        name: overtime.user.name,
        employee_id: overtime.user.employeeId,
        department: overtime.user.department,
      },
      date: overtime.date.toISOString().split('T')[0],
      start_time: overtime.startTime,
      end_time: overtime.endTime,
      hours: Number(overtime.hours),
      reason: overtime.reason,
      status: overtime.status.toLowerCase(),
      created_at: overtime.createdAt.toISOString(),
    };
  }
}
