import {
  Injectable,
  HttpException,
  HttpStatus,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUserData } from '../auth/decorators/current-user.decorator';
import { CreateMissedClockDto } from './dto/create-missed-clock.dto';
import { QueryMissedClocksDto } from './dto/query-missed-clocks.dto';
import { QueryPendingMissedClocksDto } from './dto/query-pending.dto';

/** clock_type DTO 值 -> Prisma enum 值對照 */
const CLOCK_TYPE_MAP: Record<string, string> = {
  clock_in: 'CLOCK_IN',
  clock_out: 'CLOCK_OUT',
};

/** MissedClockStatus DTO 值 -> Prisma enum 值對照 */
const STATUS_MAP: Record<string, string> = {
  pending: 'PENDING',
  approved: 'APPROVED',
  rejected: 'REJECTED',
};

/** 補打卡可追溯天數 */
const MAX_RETROACTIVE_DAYS = 7;

@Injectable()
export class MissedClocksService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 申請補打卡
   */
  async create(userId: string, dto: CreateMissedClockDto) {
    const clockType = CLOCK_TYPE_MAP[dto.clock_type];
    const dateStr = dto.date;
    const date = new Date(dateStr + 'T00:00:00.000Z');
    const requestedTime = new Date(dto.requested_time);

    // 驗證 requested_time 格式
    if (isNaN(requestedTime.getTime())) {
      throw new HttpException(
        {
          code: 'INVALID_INPUT',
          message: 'requested_time 格式不正確',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    // 驗證日期不在未來
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    if (date > today) {
      throw new HttpException(
        {
          code: 'INVALID_INPUT',
          message: '不能對未來日期補打卡',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    // 驗證日期在 7 天內
    const minDate = new Date(today);
    minDate.setDate(minDate.getDate() - MAX_RETROACTIVE_DAYS);
    if (date < minDate) {
      throw new HttpException(
        {
          code: 'PAST_DATE',
          message: '只能補登 7 天內的打卡紀錄',
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    // 檢查該日期是否已有對應的打卡紀錄
    const existingClock = await this.prisma.clockRecord.findUnique({
      where: {
        userId_date: {
          userId,
          date,
        },
      },
    });

    if (existingClock) {
      if (dto.clock_type === 'clock_in' && existingClock.clockIn) {
        throw new HttpException(
          {
            code: 'ALREADY_CLOCKED',
            message: '該日期已有上班打卡紀錄，不需要補打卡',
          },
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }
      if (dto.clock_type === 'clock_out' && existingClock.clockOut) {
        throw new HttpException(
          {
            code: 'ALREADY_CLOCKED',
            message: '該日期已有下班打卡紀錄，不需要補打卡',
          },
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }
    }

    // 檢查是否已有同日期同類型的 pending/approved 補打卡申請
    const existingRequest = await this.prisma.missedClockRequest.findFirst({
      where: {
        userId,
        date,
        clockType: clockType as never,
        status: { in: ['PENDING', 'APPROVED'] as never[] },
      },
    });

    if (existingRequest) {
      throw new HttpException(
        {
          code: 'ALREADY_EXISTS',
          message: '該日期該類型已有待審核或已核准的補打卡申請',
        },
        HttpStatus.CONFLICT,
      );
    }

    // 建立補打卡申請
    const request = await this.prisma.missedClockRequest.create({
      data: {
        userId,
        date,
        clockType: clockType as never,
        requestedTime,
        reason: dto.reason,
        status: 'PENDING' as never,
      },
    });

    return this.formatMissedClockResponse(request);
  }

  /**
   * 查詢個人補打卡紀錄
   */
  async findAll(userId: string, query: QueryMissedClocksDto) {
    const { page = 1, limit = 20 } = query;

    const where: Record<string, unknown> = { userId };

    if (query.status) {
      where.status = STATUS_MAP[query.status];
    }

    const [data, total] = await Promise.all([
      this.prisma.missedClockRequest.findMany({
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
      this.prisma.missedClockRequest.count({ where }),
    ]);

    return {
      data: data.map((item) => this.formatMissedClockListItem(item)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * 查詢補打卡詳情
   */
  async findOne(id: string, userId: string, userRole: string) {
    const request = await this.prisma.missedClockRequest.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            employeeId: true,
            department: { select: { id: true, name: true } },
          },
        },
        reviewer: {
          select: { id: true, name: true },
        },
      },
    });

    if (!request) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: '補打卡申請不存在',
      });
    }

    // 權限檢查：自己的、Manager/Admin 可看
    if (request.userId !== userId && userRole === 'EMPLOYEE') {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: '無權查看此補打卡申請',
      });
    }

    return this.formatMissedClockDetail(request);
  }

  /**
   * 查詢待審核補打卡清單（Manager/Admin）
   */
  async findPending(user: CurrentUserData, query: QueryPendingMissedClocksDto) {
    const { page = 1, limit = 20 } = query;

    const where = this.buildPendingWhereClause(user, query.department_id);

    const [data, total] = await Promise.all([
      this.prisma.missedClockRequest.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              employeeId: true,
              department: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.missedClockRequest.count({ where }),
    ]);

    return {
      data: data.map((item) => this.formatMissedClockWithUser(item)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * 核准補打卡
   * 核准後更新/建立 ClockRecord
   */
  async approve(id: string, reviewer: CurrentUserData, comment?: string) {
    const request = await this.findAndValidateRequest(id, reviewer);

    const now = new Date();

    const result = await this.prisma.$transaction(async (tx) => {
      // 再次確認狀態（避免併發）
      const fresh = await tx.missedClockRequest.findUnique({
        where: { id },
      });
      if (!fresh || fresh.status !== 'PENDING') {
        throw new HttpException(
          {
            code: 'NOT_PENDING',
            message: '此補打卡申請已不是待審核狀態',
          },
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }

      // 更新補打卡申請狀態
      const updated = await tx.missedClockRequest.update({
        where: { id },
        data: {
          status: 'APPROVED' as never,
          reviewerId: reviewer.userId,
          reviewedAt: now,
          reviewComment: comment || null,
        },
      });

      // 更新或建立 ClockRecord
      const existingClock = await tx.clockRecord.findUnique({
        where: {
          userId_date: {
            userId: request.userId,
            date: request.date,
          },
        },
      });

      if (request.clockType === 'CLOCK_IN') {
        if (existingClock) {
          // 更新現有紀錄的 clock_in
          await tx.clockRecord.update({
            where: { id: existingClock.id },
            data: {
              clockIn: request.requestedTime,
              status: 'AMENDED' as never,
            },
          });
        } else {
          // 建立新的 ClockRecord
          await tx.clockRecord.create({
            data: {
              userId: request.userId,
              date: request.date,
              clockIn: request.requestedTime,
              status: 'AMENDED' as never,
            },
          });
        }
      } else {
        // CLOCK_OUT: 更新現有紀錄的 clock_out
        if (existingClock) {
          await tx.clockRecord.update({
            where: { id: existingClock.id },
            data: {
              clockOut: request.requestedTime,
              status: 'AMENDED' as never,
            },
          });
        } else {
          // 沒有上班紀錄但要補下班卡 — 仍然建立紀錄
          await tx.clockRecord.create({
            data: {
              userId: request.userId,
              date: request.date,
              clockIn: request.requestedTime, // 使用 requested_time 作為 clock_in（因為 clock_in 為 required）
              clockOut: request.requestedTime,
              status: 'AMENDED' as never,
            },
          });
        }
      }

      return updated;
    });

    // 取得審核者資訊
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
    };
  }

  /**
   * 駁回補打卡
   */
  async reject(id: string, reviewer: CurrentUserData, comment: string) {
    await this.findAndValidateRequest(id, reviewer);

    const now = new Date();

    const result = await this.prisma.$transaction(async (tx) => {
      // 再次確認狀態
      const fresh = await tx.missedClockRequest.findUnique({
        where: { id },
      });
      if (!fresh || fresh.status !== 'PENDING') {
        throw new HttpException(
          {
            code: 'NOT_PENDING',
            message: '此補打卡申請已不是待審核狀態',
          },
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }

      return tx.missedClockRequest.update({
        where: { id },
        data: {
          status: 'REJECTED' as never,
          reviewerId: reviewer.userId,
          reviewedAt: now,
          reviewComment: comment,
        },
      });
    });

    // 取得審核者資訊
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
    };
  }

  // ── Private Methods ──

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
   * 查找補打卡申請並驗證審核權限
   */
  private async findAndValidateRequest(
    requestId: string,
    reviewer: CurrentUserData,
  ) {
    const request = await this.prisma.missedClockRequest.findUnique({
      where: { id: requestId },
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

    if (!request) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: '補打卡申請不存在',
      });
    }

    if (request.status !== 'PENDING') {
      throw new HttpException(
        {
          code: 'NOT_PENDING',
          message: '此補打卡申請已不是待審核狀態，無法進行審核',
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    // 不可審核自己的申請
    if (request.userId === reviewer.userId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: '不可審核自己的補打卡申請',
      });
    }

    // Manager 只能審核直屬部屬
    if (reviewer.role === 'MANAGER') {
      if (request.user.managerId !== reviewer.userId) {
        throw new ForbiddenException({
          code: 'FORBIDDEN',
          message: '只能審核直屬部屬的補打卡申請',
        });
      }
    }

    return request;
  }

  /**
   * 格式化單筆補打卡回應（POST 回傳）
   */
  private formatMissedClockResponse(request: {
    id: string;
    userId: string;
    date: Date;
    clockType: string;
    requestedTime: Date;
    reason: string;
    status: string;
    reviewerId: string | null;
    reviewedAt: Date | null;
    reviewComment: string | null;
    createdAt: Date;
  }) {
    return {
      id: request.id,
      user_id: request.userId,
      date: request.date.toISOString().split('T')[0],
      clock_type: request.clockType === 'CLOCK_IN' ? 'clock_in' : 'clock_out',
      requested_time: request.requestedTime.toISOString(),
      reason: request.reason,
      status: request.status.toLowerCase(),
      reviewer_id: request.reviewerId,
      reviewed_at: request.reviewedAt
        ? request.reviewedAt.toISOString()
        : null,
      review_comment: request.reviewComment,
      created_at: request.createdAt.toISOString(),
    };
  }

  /**
   * 格式化列表項目
   */
  private formatMissedClockListItem(item: {
    id: string;
    date: Date;
    clockType: string;
    requestedTime: Date;
    reason: string;
    status: string;
    reviewer: { id: string; name: string } | null;
    createdAt: Date;
  }) {
    return {
      id: item.id,
      date: item.date.toISOString().split('T')[0],
      clock_type: item.clockType === 'CLOCK_IN' ? 'clock_in' : 'clock_out',
      requested_time: item.requestedTime.toISOString(),
      reason: item.reason,
      status: item.status.toLowerCase(),
      reviewer: item.reviewer
        ? { id: item.reviewer.id, name: item.reviewer.name }
        : null,
      created_at: item.createdAt.toISOString(),
    };
  }

  /**
   * 格式化詳情
   */
  private formatMissedClockDetail(request: {
    id: string;
    userId: string;
    date: Date;
    clockType: string;
    requestedTime: Date;
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
      department: { id: string; name: string };
    };
    reviewer: { id: string; name: string } | null;
  }) {
    return {
      id: request.id,
      user_id: request.userId,
      date: request.date.toISOString().split('T')[0],
      clock_type: request.clockType === 'CLOCK_IN' ? 'clock_in' : 'clock_out',
      requested_time: request.requestedTime.toISOString(),
      reason: request.reason,
      status: request.status.toLowerCase(),
      reviewer_id: request.reviewerId,
      reviewed_at: request.reviewedAt
        ? request.reviewedAt.toISOString()
        : null,
      review_comment: request.reviewComment,
      created_at: request.createdAt.toISOString(),
      updated_at: request.updatedAt.toISOString(),
      user: {
        id: request.user.id,
        name: request.user.name,
        employee_id: request.user.employeeId,
        department: {
          id: request.user.department.id,
          name: request.user.department.name,
        },
      },
      reviewer: request.reviewer
        ? { id: request.reviewer.id, name: request.reviewer.name }
        : null,
    };
  }

  /**
   * 格式化待審核列表項目（含使用者資訊）
   */
  private formatMissedClockWithUser(item: {
    id: string;
    date: Date;
    clockType: string;
    requestedTime: Date;
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
      id: item.id,
      user: {
        id: item.user.id,
        name: item.user.name,
        employee_id: item.user.employeeId,
        department: item.user.department,
      },
      date: item.date.toISOString().split('T')[0],
      clock_type: item.clockType === 'CLOCK_IN' ? 'clock_in' : 'clock_out',
      requested_time: item.requestedTime.toISOString(),
      reason: item.reason,
      status: item.status.toLowerCase(),
      created_at: item.createdAt.toISOString(),
    };
  }
}
