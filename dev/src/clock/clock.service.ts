import {
  Injectable,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ClockInDto } from './dto/clock-in.dto';
import { ClockOutDto } from './dto/clock-out.dto';
import { QueryClockRecordsDto } from './dto/query-clock-records.dto';
import { PaginatedResult } from '../common/dto/pagination.dto';

/** UTC+8 offset in milliseconds */
const UTC8_OFFSET_MS = 8 * 60 * 60 * 1000;

/** 上班時間 09:00 UTC+8 */
const WORK_START_HOUR = 9;

/** 下班時間 18:00 UTC+8 */
const WORK_END_HOUR = 18;

/** 查詢日期範圍上限（天） */
const MAX_DATE_RANGE_DAYS = 90;

@Injectable()
export class ClockService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 上班打卡
   */
  async clockIn(userId: string, dto: ClockInDto) {
    const now = new Date();
    const todayDate = this.getTodayDateUTC8(now);

    // 檢查今日是否已有打卡紀錄
    const existing = await this.prisma.clockRecord.findUnique({
      where: {
        userId_date: {
          userId,
          date: todayDate,
        },
      },
    });

    if (existing) {
      throw new HttpException(
        {
          code: 'ALREADY_CLOCKED_IN',
          message: '今日已打過上班卡',
        },
        HttpStatus.CONFLICT,
      );
    }

    // 計算 status
    const status = this.calculateClockInStatus(now);

    const record = await this.prisma.clockRecord.create({
      data: {
        userId,
        date: todayDate,
        clockIn: now,
        status,
        note: dto.note || null,
      },
    });

    return this.formatClockRecord(record);
  }

  /**
   * 下班打卡
   */
  async clockOut(userId: string, dto: ClockOutDto) {
    const now = new Date();

    // 找到今日（或跨日）的打卡紀錄：取最近一筆尚未打下班卡的紀錄
    const record = await this.findOpenClockRecord(userId, now);

    if (!record) {
      // 檢查是否已經打過下班卡
      const todayDate = this.getTodayDateUTC8(now);
      const todayRecord = await this.prisma.clockRecord.findUnique({
        where: {
          userId_date: {
            userId,
            date: todayDate,
          },
        },
      });

      if (todayRecord && todayRecord.clockOut) {
        throw new HttpException(
          {
            code: 'ALREADY_CLOCKED_OUT',
            message: '今日已打過下班卡',
          },
          HttpStatus.CONFLICT,
        );
      }

      throw new HttpException(
        {
          code: 'NOT_CLOCKED_IN',
          message: '今日尚未打上班卡',
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    // 更新備註：若有提供新備註就附加，否則保留原本的
    const note = dto.note || record.note;

    // 計算最終 status（考慮遲到和早退）
    const status = this.calculateFinalStatus(record.clockIn, now);

    const updated = await this.prisma.clockRecord.update({
      where: { id: record.id },
      data: {
        clockOut: now,
        status,
        note,
      },
    });

    return this.formatClockRecord(updated);
  }

  /**
   * 查詢今日打卡狀態
   */
  async getToday(userId: string) {
    const now = new Date();
    const todayDate = this.getTodayDateUTC8(now);

    const record = await this.prisma.clockRecord.findUnique({
      where: {
        userId_date: {
          userId,
          date: todayDate,
        },
      },
    });

    if (!record) {
      const dateStr = todayDate.toISOString().split('T')[0];
      return {
        id: null,
        date: dateStr,
        clock_in: null,
        clock_out: null,
        status: null,
        note: null,
      };
    }

    return {
      id: record.id,
      date: record.date.toISOString().split('T')[0],
      clock_in: record.clockIn.toISOString(),
      clock_out: record.clockOut ? record.clockOut.toISOString() : null,
      status: record.status.toLowerCase(),
      note: record.note,
    };
  }

  /**
   * 查詢打卡紀錄（分頁）
   */
  async getRecords(
    userId: string,
    query: QueryClockRecordsDto,
  ): Promise<PaginatedResult<unknown>> {
    const { start_date, end_date, page = 1, limit = 20 } = query;

    // 驗證日期格式
    const startDate = new Date(start_date);
    const endDate = new Date(end_date);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new HttpException(
        {
          code: 'INVALID_INPUT',
          message: '日期格式錯誤，請使用 YYYY-MM-DD 格式',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    if (endDate < startDate) {
      throw new HttpException(
        {
          code: 'INVALID_INPUT',
          message: 'end_date 不可早於 start_date',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    // 檢查日期範圍不超過 90 天
    const diffMs = endDate.getTime() - startDate.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    if (diffDays > MAX_DATE_RANGE_DAYS) {
      throw new HttpException(
        {
          code: 'INVALID_INPUT',
          message: `查詢日期範圍不可超過 ${MAX_DATE_RANGE_DAYS} 天`,
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    // 查詢結束日期需要加一天才能包含 end_date 當天
    const endDateInclusive = new Date(endDate);
    endDateInclusive.setDate(endDateInclusive.getDate() + 1);

    const where = {
      userId,
      date: {
        gte: startDate,
        lt: endDateInclusive,
      },
    };

    const [records, total] = await Promise.all([
      this.prisma.clockRecord.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { date: 'desc' },
      }),
      this.prisma.clockRecord.count({ where }),
    ]);

    return {
      data: records.map((record) => ({
        id: record.id,
        date: record.date.toISOString().split('T')[0],
        clock_in: record.clockIn.toISOString(),
        clock_out: record.clockOut ? record.clockOut.toISOString() : null,
        status: record.status.toLowerCase(),
        note: record.note,
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ── Private Methods ──

  /**
   * 取得今日日期（UTC+8 時區），回傳 UTC 的 Date 物件（時間部分為 00:00:00）
   */
  private getTodayDateUTC8(now: Date): Date {
    const utc8Time = new Date(now.getTime() + UTC8_OFFSET_MS);
    const dateStr = utc8Time.toISOString().split('T')[0];
    return new Date(dateStr + 'T00:00:00.000Z');
  }

  /**
   * 根據上班打卡時間計算 status
   */
  private calculateClockInStatus(clockIn: Date): 'NORMAL' | 'LATE' {
    const utc8Time = new Date(clockIn.getTime() + UTC8_OFFSET_MS);
    const hour = utc8Time.getUTCHours();
    const minute = utc8Time.getUTCMinutes();

    if (hour > WORK_START_HOUR || (hour === WORK_START_HOUR && minute > 0)) {
      return 'LATE';
    }
    return 'NORMAL';
  }

  /**
   * 計算最終 status（打下班卡時，綜合考慮遲到和早退）
   * 規則：遲到優先（以較嚴重的為準）
   */
  private calculateFinalStatus(
    clockIn: Date,
    clockOut: Date,
  ): 'NORMAL' | 'LATE' | 'EARLY_LEAVE' {
    const clockInUTC8 = new Date(clockIn.getTime() + UTC8_OFFSET_MS);
    const clockInHour = clockInUTC8.getUTCHours();
    const clockInMinute = clockInUTC8.getUTCMinutes();

    const isLate =
      clockInHour > WORK_START_HOUR ||
      (clockInHour === WORK_START_HOUR && clockInMinute > 0);

    // 遲到優先
    if (isLate) {
      return 'LATE';
    }

    const clockOutUTC8 = new Date(clockOut.getTime() + UTC8_OFFSET_MS);
    const clockOutHour = clockOutUTC8.getUTCHours();

    if (clockOutHour < WORK_END_HOUR) {
      return 'EARLY_LEAVE';
    }

    return 'NORMAL';
  }

  /**
   * 尋找使用者尚未打下班卡的紀錄（支援跨日打卡）
   * 先查今日，若無則查昨日（跨日情境）
   */
  private async findOpenClockRecord(userId: string, now: Date) {
    const todayDate = this.getTodayDateUTC8(now);

    // 先查今日
    const todayRecord = await this.prisma.clockRecord.findUnique({
      where: {
        userId_date: {
          userId,
          date: todayDate,
        },
      },
    });

    if (todayRecord && !todayRecord.clockOut) {
      return todayRecord;
    }

    // 跨日：查昨日是否有未打下班卡的紀錄
    const yesterdayDate = new Date(todayDate);
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);

    const yesterdayRecord = await this.prisma.clockRecord.findUnique({
      where: {
        userId_date: {
          userId,
          date: yesterdayDate,
        },
      },
    });

    if (yesterdayRecord && !yesterdayRecord.clockOut) {
      return yesterdayRecord;
    }

    return null;
  }

  /**
   * 格式化打卡紀錄為 API 回應格式
   */
  private formatClockRecord(record: {
    id: string;
    userId: string;
    date: Date;
    clockIn: Date;
    clockOut: Date | null;
    status: string;
    note: string | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: record.id,
      user_id: record.userId,
      date: record.date.toISOString().split('T')[0],
      clock_in: record.clockIn.toISOString(),
      clock_out: record.clockOut ? record.clockOut.toISOString() : null,
      status: record.status.toLowerCase(),
      note: record.note,
      created_at: record.createdAt.toISOString(),
      updated_at: record.updatedAt.toISOString(),
    };
  }
}
