import {
  Injectable,
  HttpException,
  HttpStatus,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { QueryPersonalCalendarDto, QueryTeamCalendarDto } from './dto/query-calendar.dto';

/** 團隊行事曆的日狀態 */
type TeamDayStatus = 'present' | 'late' | 'early_leave' | 'leave' | 'absent' | 'holiday';

@Injectable()
export class CalendarService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 個人月行事曆
   */
  async getPersonalCalendar(userId: string, query: QueryPersonalCalendarDto) {
    const { year, month } = query;

    // 取得該月所有日期
    const daysInMonth = new Date(year, month, 0).getDate();
    const startDate = new Date(Date.UTC(year, month - 1, 1));
    const endDate = new Date(Date.UTC(year, month - 1, daysInMonth));

    // 並行查詢打卡和請假資料
    const [clockRecords, leaveRequests] = await Promise.all([
      this.prisma.clockRecord.findMany({
        where: {
          userId,
          date: { gte: startDate, lte: endDate },
        },
        orderBy: { date: 'asc' },
      }),
      this.prisma.leaveRequest.findMany({
        where: {
          userId,
          status: { in: ['PENDING', 'APPROVED'] as never[] },
          startDate: { lte: endDate },
          endDate: { gte: startDate },
        },
        orderBy: { startDate: 'asc' },
      }),
    ]);

    // 建立打卡 map (date string -> record)
    const clockMap = new Map<string, typeof clockRecords[0]>();
    for (const record of clockRecords) {
      const dateStr = record.date.toISOString().split('T')[0];
      clockMap.set(dateStr, record);
    }

    // 建立請假 map (date string -> leave requests[])
    const leaveMap = new Map<string, typeof leaveRequests>();
    for (const leave of leaveRequests) {
      const leaveStart = leave.startDate;
      const leaveEnd = leave.endDate;
      // 遍歷請假的每一天，只加入屬於本月的天數
      const iterDate = new Date(Math.max(leaveStart.getTime(), startDate.getTime()));
      const iterEnd = new Date(Math.min(leaveEnd.getTime(), endDate.getTime()));
      while (iterDate <= iterEnd) {
        const dateStr = iterDate.toISOString().split('T')[0];
        if (!leaveMap.has(dateStr)) {
          leaveMap.set(dateStr, []);
        }
        leaveMap.get(dateStr)!.push(leave);
        iterDate.setUTCDate(iterDate.getUTCDate() + 1);
      }
    }

    // 組裝每日資料
    const days = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(Date.UTC(year, month - 1, day));
      const dateStr = date.toISOString().split('T')[0];
      const dayOfWeek = date.getUTCDay(); // 0=Sun, 6=Sat
      const isWorkday = dayOfWeek !== 0 && dayOfWeek !== 6;

      const clockRecord = clockMap.get(dateStr);
      const dayLeaves = leaveMap.get(dateStr) || [];

      days.push({
        date: dateStr,
        is_workday: isWorkday,
        clock: clockRecord
          ? {
              clock_in: clockRecord.clockIn.toISOString(),
              clock_out: clockRecord.clockOut
                ? clockRecord.clockOut.toISOString()
                : null,
              status: clockRecord.status.toLowerCase(),
            }
          : null,
        leaves: dayLeaves.map((leave) => ({
          id: leave.id,
          leave_type: leave.leaveType.toLowerCase(),
          start_half: leave.startHalf.toLowerCase(),
          end_half: leave.endHalf.toLowerCase(),
          status: leave.status.toLowerCase(),
        })),
        overtime: null, // Sprint 3 尚無加班功能
      });
    }

    return { year, month, days };
  }

  /**
   * 團隊月行事曆
   */
  async getTeamCalendar(
    userId: string,
    userRole: string,
    userDepartmentId: string,
    query: QueryTeamCalendarDto,
  ) {
    const { year, month, department_id } = query;

    // 決定要查看的部門
    let targetDepartmentId: string;

    if (userRole === 'ADMIN') {
      targetDepartmentId = department_id || userDepartmentId;
    } else if (userRole === 'MANAGER') {
      if (department_id && department_id !== userDepartmentId) {
        throw new ForbiddenException({
          code: 'FORBIDDEN',
          message: '主管只能查看自己部門的行事曆',
        });
      }
      targetDepartmentId = userDepartmentId;
    } else {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: '權限不足',
      });
    }

    // 查詢部門資料
    const department = await this.prisma.department.findUnique({
      where: { id: targetDepartmentId },
      select: { id: true, name: true },
    });

    if (!department) {
      throw new HttpException(
        {
          code: 'INVALID_INPUT',
          message: '部門不存在',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    // 查詢該部門的所有 active 員工
    const members = await this.prisma.user.findMany({
      where: {
        departmentId: targetDepartmentId,
        status: 'ACTIVE',
      },
      select: {
        id: true,
        name: true,
        employeeId: true,
      },
      orderBy: { employeeId: 'asc' },
    });

    const memberIds = members.map((m) => m.id);

    // 取得該月日期範圍
    const daysInMonth = new Date(year, month, 0).getDate();
    const startDate = new Date(Date.UTC(year, month - 1, 1));
    const endDate = new Date(Date.UTC(year, month - 1, daysInMonth));

    // 並行查詢所有成員的打卡和請假資料
    const [clockRecords, leaveRequests] = await Promise.all([
      this.prisma.clockRecord.findMany({
        where: {
          userId: { in: memberIds },
          date: { gte: startDate, lte: endDate },
        },
      }),
      this.prisma.leaveRequest.findMany({
        where: {
          userId: { in: memberIds },
          status: 'APPROVED',
          startDate: { lte: endDate },
          endDate: { gte: startDate },
        },
      }),
    ]);

    // 建立 map: userId -> dateStr -> clockRecord
    const clockMap = new Map<string, Map<string, typeof clockRecords[0]>>();
    for (const record of clockRecords) {
      const dateStr = record.date.toISOString().split('T')[0];
      if (!clockMap.has(record.userId)) {
        clockMap.set(record.userId, new Map());
      }
      clockMap.get(record.userId)!.set(dateStr, record);
    }

    // 建立 map: userId -> dateStr -> leaveRequest
    const leaveMap = new Map<string, Map<string, typeof leaveRequests[0]>>();
    for (const leave of leaveRequests) {
      const leaveStart = leave.startDate;
      const leaveEnd = leave.endDate;
      const iterDate = new Date(Math.max(leaveStart.getTime(), startDate.getTime()));
      const iterEnd = new Date(Math.min(leaveEnd.getTime(), endDate.getTime()));
      while (iterDate <= iterEnd) {
        const dateStr = iterDate.toISOString().split('T')[0];
        if (!leaveMap.has(leave.userId)) {
          leaveMap.set(leave.userId, new Map());
        }
        // 一天只取第一筆請假（團隊視圖簡化）
        if (!leaveMap.get(leave.userId)!.has(dateStr)) {
          leaveMap.get(leave.userId)!.set(dateStr, leave);
        }
        iterDate.setUTCDate(iterDate.getUTCDate() + 1);
      }
    }

    // 組裝每個成員的資料
    const membersData = members.map((member) => {
      const userClockMap = clockMap.get(member.id);
      const userLeaveMap = leaveMap.get(member.id);

      const days = [];
      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(Date.UTC(year, month - 1, day));
        const dateStr = date.toISOString().split('T')[0];
        const dayOfWeek = date.getUTCDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

        if (isWeekend) {
          days.push({ date: dateStr, status: 'holiday' as TeamDayStatus, leave_type: null });
          continue;
        }

        const clockRecord = userClockMap?.get(dateStr);
        const leaveRecord = userLeaveMap?.get(dateStr);

        const { status, leaveType } = this.determineTeamDayStatus(clockRecord, leaveRecord);
        days.push({ date: dateStr, status, leave_type: leaveType });
      }

      return {
        user: {
          id: member.id,
          name: member.name,
          employee_id: member.employeeId,
        },
        days,
      };
    });

    return {
      year,
      month,
      department: { id: department.id, name: department.name },
      members: membersData,
    };
  }

  /**
   * 根據打卡和請假紀錄判斷團隊日狀態
   */
  private determineTeamDayStatus(
    clockRecord: { status: string } | undefined | null,
    leaveRecord: { leaveType: string } | undefined | null,
  ): { status: TeamDayStatus; leaveType: string | null } {
    // 有請假紀錄優先
    if (leaveRecord) {
      return {
        status: 'leave',
        leaveType: leaveRecord.leaveType.toLowerCase(),
      };
    }

    // 有打卡紀錄
    if (clockRecord) {
      const clockStatus = clockRecord.status.toUpperCase();
      switch (clockStatus) {
        case 'LATE':
          return { status: 'late', leaveType: null };
        case 'EARLY_LEAVE':
          return { status: 'early_leave', leaveType: null };
        default:
          return { status: 'present', leaveType: null };
      }
    }

    // 無打卡也無請假
    return { status: 'absent', leaveType: null };
  }
}
