import {
  Injectable,
  HttpException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type Decimal = Prisma.Decimal;
const Decimal = Prisma.Decimal;
import { UpdateQuotaDto } from './dto/update-quota.dto';
import { BatchQuotaDto } from './dto/batch-quota.dto';

/** 假別中文名稱對照表 */
const LEAVE_TYPE_LABELS: Record<string, string> = {
  PERSONAL: '事假',
  SICK: '病假',
  ANNUAL: '特休',
  MARRIAGE: '婚假',
  BEREAVEMENT: '喪假',
  MATERNITY: '產假',
  PATERNITY: '陪產假',
  OFFICIAL: '公假',
};

/** 各假別預設年度時數 */
const DEFAULT_QUOTA_HOURS: Record<string, number> = {
  PERSONAL: 56,
  SICK: 240,
  ANNUAL: 0, // 依年資計算
  MARRIAGE: 64,
  BEREAVEMENT: 24,
  MATERNITY: 448,
  PATERNITY: 56,
  OFFICIAL: 9999,
};

/** 所有假別列表 */
const ALL_LEAVE_TYPES = [
  'PERSONAL',
  'SICK',
  'ANNUAL',
  'MARRIAGE',
  'BEREAVEMENT',
  'MATERNITY',
  'PATERNITY',
  'OFFICIAL',
];

@Injectable()
export class LeaveQuotasService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 查看某位使用者的年度額度
   */
  async getQuotas(userId: string, year?: number) {
    const currentYear = year || new Date().getFullYear();

    // 確認使用者存在
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: '員工不存在',
      });
    }

    const quotas = await this.prisma.leaveQuota.findMany({
      where: {
        userId,
        year: currentYear,
      },
      orderBy: { leaveType: 'asc' },
    });

    return {
      user_id: userId,
      year: currentYear,
      quotas: quotas.map((q) => this.formatQuota(q)),
    };
  }

  /**
   * Admin 設定單一員工額度
   */
  async updateQuotas(userId: string, dto: UpdateQuotaDto) {
    // 確認使用者存在
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: '員工不存在',
      });
    }

    // 檢查每筆額度是否低於已使用時數
    for (const item of dto.quotas) {
      const existing = await this.prisma.leaveQuota.findUnique({
        where: {
          userId_leaveType_year: {
            userId,
            leaveType: item.leave_type as never,
            year: dto.year,
          },
        },
      });

      if (existing) {
        const usedHours = Number(existing.usedHours);
        if (item.total_hours < usedHours) {
          throw new HttpException(
            {
              code: 'QUOTA_BELOW_USED',
              message: `${LEAVE_TYPE_LABELS[item.leave_type] || item.leave_type} 的額度 (${item.total_hours}h) 不可低於已使用時數 (${usedHours}h)`,
            },
            HttpStatus.UNPROCESSABLE_ENTITY,
          );
        }
      }
    }

    // 使用 transaction 批次 upsert
    const results = await this.prisma.$transaction(
      dto.quotas.map((item) =>
        this.prisma.leaveQuota.upsert({
          where: {
            userId_leaveType_year: {
              userId,
              leaveType: item.leave_type as never,
              year: dto.year,
            },
          },
          update: {
            totalHours: new Decimal(item.total_hours),
          },
          create: {
            userId,
            leaveType: item.leave_type as never,
            year: dto.year,
            totalHours: new Decimal(item.total_hours),
            usedHours: new Decimal(0),
          },
        }),
      ),
    );

    // 取得完整的額度列表
    const allQuotas = await this.prisma.leaveQuota.findMany({
      where: { userId, year: dto.year },
      orderBy: { leaveType: 'asc' },
    });

    return {
      user_id: userId,
      year: dto.year,
      quotas: allQuotas.map((q) => this.formatQuota(q)),
      updated_at: results.length > 0 ? results[results.length - 1].updatedAt.toISOString() : new Date().toISOString(),
    };
  }

  /**
   * Admin 批次設定額度
   */
  async batchUpdateQuotas(dto: BatchQuotaDto) {
    // 至少需要指定 department_id 或 user_ids
    if (!dto.department_id && (!dto.user_ids || dto.user_ids.length === 0)) {
      throw new HttpException(
        {
          code: 'INVALID_INPUT',
          message: '必須指定 department_id 或 user_ids 之一',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    // 取得目標使用者列表
    let userIds: string[];

    if (dto.user_ids && dto.user_ids.length > 0) {
      userIds = dto.user_ids;
    } else {
      const users = await this.prisma.user.findMany({
        where: {
          departmentId: dto.department_id,
          status: 'ACTIVE',
        },
        select: { id: true },
      });
      userIds = users.map((u) => u.id);
    }

    if (userIds.length === 0) {
      return { updated_count: 0, year: dto.year };
    }

    // 批次 upsert（使用 transaction）
    const operations = userIds.flatMap((userId) =>
      dto.quotas.map((item) =>
        this.prisma.leaveQuota.upsert({
          where: {
            userId_leaveType_year: {
              userId,
              leaveType: item.leave_type as never,
              year: dto.year,
            },
          },
          update: {
            totalHours: new Decimal(item.total_hours),
          },
          create: {
            userId,
            leaveType: item.leave_type as never,
            year: dto.year,
            totalHours: new Decimal(item.total_hours),
            usedHours: new Decimal(0),
          },
        }),
      ),
    );

    await this.prisma.$transaction(operations);

    return {
      updated_count: userIds.length,
      year: dto.year,
    };
  }

  /**
   * 為員工建立當年度所有假別的預設額度
   * 供 EmployeesService 在建立員工時呼叫
   */
  async createDefaultQuotas(userId: string, hireDate: Date, year?: number) {
    const targetYear = year || new Date().getFullYear();

    const operations = ALL_LEAVE_TYPES.map((leaveType) => {
      let totalHours = DEFAULT_QUOTA_HOURS[leaveType];

      // 特休依年資計算
      if (leaveType === 'ANNUAL') {
        totalHours = this.calculateAnnualHours(hireDate, targetYear);
      }

      return this.prisma.leaveQuota.upsert({
        where: {
          userId_leaveType_year: {
            userId,
            leaveType: leaveType as never,
            year: targetYear,
          },
        },
        update: {},
        create: {
          userId,
          leaveType: leaveType as never,
          year: targetYear,
          totalHours: new Decimal(totalHours),
          usedHours: new Decimal(0),
        },
      });
    });

    await this.prisma.$transaction(operations);
  }

  /**
   * 依年資計算特休時數
   * 0.5-1年: 24h, 1-2年: 56h, 2-3年: 80h, 3-5年: 112h, 5-10年: 120h, 10+年: 128h+
   */
  calculateAnnualHours(hireDate: Date, year: number): number {
    const yearStart = new Date(year, 0, 1);
    const diffMs = yearStart.getTime() - hireDate.getTime();
    const diffYears = diffMs / (1000 * 60 * 60 * 24 * 365.25);

    if (diffYears < 0.5) return 0;
    if (diffYears < 1) return 24;
    if (diffYears < 2) return 56;
    if (diffYears < 3) return 80;
    if (diffYears < 5) return 112;
    if (diffYears < 10) return 120;

    // 10 年以上：128h 基礎，每多一年加 8h（上限 240h）
    const extraYears = Math.floor(diffYears) - 10;
    return Math.min(128 + extraYears * 8, 240);
  }

  // ── Private Methods ──

  private formatQuota(quota: {
    id: string;
    leaveType: string;
    totalHours: Decimal | number;
    usedHours: Decimal | number;
  }) {
    const totalHours = Number(quota.totalHours);
    const usedHours = Number(quota.usedHours);

    return {
      id: quota.id,
      leave_type: quota.leaveType.toLowerCase(),
      leave_type_label: LEAVE_TYPE_LABELS[quota.leaveType] || quota.leaveType,
      total_hours: totalHours,
      used_hours: usedHours,
      remaining_hours: Math.round((totalHours - usedHours) * 10) / 10,
    };
  }
}
