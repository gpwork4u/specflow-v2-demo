import {
  Injectable,
  HttpException,
  HttpStatus,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUserData } from '../auth/decorators/current-user.decorator';
import { QueryPendingDto } from './dto/query-pending.dto';

@Injectable()
export class LeaveApprovalService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 查詢待審核請假清單
   * - Manager: 只看直屬部屬（managerId === currentUser.userId）的 pending 請假
   * - Admin: 可指定 department_id，或查看全公司 pending 請假
   */
  async getPendingLeaves(user: CurrentUserData, query: QueryPendingDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where = this.buildPendingWhereClause(user, query.department_id);

    const [data, total] = await Promise.all([
      this.prisma.leaveRequest.findMany({
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
      this.prisma.leaveRequest.count({ where }),
    ]);

    return {
      data: data.map((leave) => this.formatLeaveWithUser(leave)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * 核准請假
   * 使用 transaction 確保 status 更新和額度扣除的原子性
   */
  async approveLeave(
    leaveId: string,
    reviewer: CurrentUserData,
    comment?: string,
  ) {
    const leave = await this.findAndValidateLeave(leaveId, reviewer);

    // 在 transaction 中更新狀態和扣除額度
    const now = new Date();
    const year = leave.startDate.getFullYear();

    const result = await this.prisma.$transaction(async (tx) => {
      // 再次確認狀態（避免併發問題）
      const freshLeave = await tx.leaveRequest.findUnique({
        where: { id: leaveId },
      });
      if (!freshLeave || freshLeave.status !== 'PENDING') {
        throw new HttpException(
          {
            code: 'NOT_PENDING',
            message: '此請假單已不是待審核狀態',
          },
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }

      // 更新請假狀態
      const updatedLeave = await tx.leaveRequest.update({
        where: { id: leaveId },
        data: {
          status: 'APPROVED',
          reviewerId: reviewer.userId,
          reviewedAt: now,
          reviewComment: comment || null,
        },
      });

      // 扣除額度
      const quota = await tx.leaveQuota.findUnique({
        where: {
          userId_leaveType_year: {
            userId: leave.userId,
            leaveType: leave.leaveType,
            year,
          },
        },
      });

      if (quota) {
        const newUsedHours =
          Number(quota.usedHours) + Number(leave.hours);
        const totalHours = Number(quota.totalHours);

        // 檢查是否超出額度（防止併發核准導致超額）
        if (newUsedHours > totalHours) {
          throw new HttpException(
            {
              code: 'QUOTA_EXCEEDED',
              message: '核准後將超出假別額度上限，請確認是否有其他已核准的請假',
            },
            HttpStatus.UNPROCESSABLE_ENTITY,
          );
        }

        await tx.leaveQuota.update({
          where: {
            userId_leaveType_year: {
              userId: leave.userId,
              leaveType: leave.leaveType,
              year,
            },
          },
          data: {
            usedHours: { increment: Number(leave.hours) },
          },
        });
      }

      return updatedLeave;
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
      updated_at: result.updatedAt.toISOString(),
    };
  }

  /**
   * 駁回請假
   * 額度不變
   */
  async rejectLeave(
    leaveId: string,
    reviewer: CurrentUserData,
    comment: string,
  ) {
    const leave = await this.findAndValidateLeave(leaveId, reviewer);

    const now = new Date();

    const result = await this.prisma.$transaction(async (tx) => {
      // 再次確認狀態
      const freshLeave = await tx.leaveRequest.findUnique({
        where: { id: leaveId },
      });
      if (!freshLeave || freshLeave.status !== 'PENDING') {
        throw new HttpException(
          {
            code: 'NOT_PENDING',
            message: '此請假單已不是待審核狀態',
          },
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }

      return tx.leaveRequest.update({
        where: { id: leaveId },
        data: {
          status: 'REJECTED',
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
      updated_at: result.updatedAt.toISOString(),
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
      // Admin 可查看全公司，或指定部門
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
   * 查找請假單並驗證審核權限
   */
  private async findAndValidateLeave(
    leaveId: string,
    reviewer: CurrentUserData,
  ) {
    const leave = await this.prisma.leaveRequest.findUnique({
      where: { id: leaveId },
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

    if (!leave) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: '請假單不存在',
      });
    }

    // 檢查是否為 pending
    if (leave.status !== 'PENDING') {
      throw new HttpException(
        {
          code: 'NOT_PENDING',
          message: '此請假單已不是待審核狀態，無法進行審核',
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    // 不可審核自己的請假
    if (leave.userId === reviewer.userId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: '不可審核自己的請假單',
      });
    }

    // Manager 只能審核直屬部屬
    if (reviewer.role === 'MANAGER') {
      if (leave.user.managerId !== reviewer.userId) {
        throw new ForbiddenException({
          code: 'FORBIDDEN',
          message: '只能審核直屬部屬的請假單',
        });
      }
    }

    // Admin 可審核全公司，不需額外檢查

    return leave;
  }

  /**
   * 格式化請假紀錄（含使用者資訊）
   */
  private formatLeaveWithUser(leave: {
    id: string;
    leaveType: string;
    startDate: Date;
    endDate: Date;
    startHalf: string;
    endHalf: string;
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
      id: leave.id,
      user: {
        id: leave.user.id,
        name: leave.user.name,
        employee_id: leave.user.employeeId,
        department: leave.user.department,
      },
      leave_type: leave.leaveType.toLowerCase(),
      start_date: leave.startDate.toISOString().split('T')[0],
      end_date: leave.endDate.toISOString().split('T')[0],
      start_half: leave.startHalf.toLowerCase(),
      end_half: leave.endHalf.toLowerCase(),
      hours: Number(leave.hours),
      reason: leave.reason,
      status: leave.status.toLowerCase(),
      created_at: leave.createdAt.toISOString(),
    };
  }
}
