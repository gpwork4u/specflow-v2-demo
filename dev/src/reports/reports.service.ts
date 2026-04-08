import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUserData } from '../auth/decorators/current-user.decorator';

interface UserSummary {
  id: string;
  name: string;
  employee_id: string;
}

interface AttendanceSummary {
  workdays: number;
  present_days: number;
  absent_days: number;
  late_days: number;
  early_leave_days: number;
  leave_days: number;
  overtime_hours: number;
  attendance_rate: number;
}

interface MemberReport extends Omit<AttendanceSummary, 'workdays' | 'absent_days'> {
  user: UserSummary;
  absent_days: number;
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 個人月報
   */
  async getPersonalReport(userId: string, year: number, month: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, employeeId: true, hireDate: true },
    });

    if (!user) {
      return this.buildEmptyPersonalReport(year, month);
    }

    const { startDate, endDate } = this.getMonthRange(year, month);
    const hireDate = new Date(user.hireDate);
    const workdays = this.calculateWorkdays(startDate, endDate, hireDate);

    const clockRecords = await this.prisma.clockRecord.findMany({
      where: {
        userId,
        date: { gte: startDate, lte: endDate },
      },
    });

    const leaveRequests = await this.prisma.leaveRequest.findMany({
      where: {
        userId,
        status: 'APPROVED',
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
    });

    const leaveDays = this.calculateLeaveDays(leaveRequests, startDate, endDate);
    const presentDays = this.calculatePresentDays(clockRecords, leaveRequests, startDate, endDate);
    const lateDays = this.calculateLateDays(clockRecords);
    const earlyLeaveDays = this.calculateEarlyLeaveDays(clockRecords);
    const absentDays = Math.max(0, workdays - presentDays - leaveDays);
    const attendanceRate = workdays > 0
      ? Math.round((presentDays / workdays) * 1000) / 10
      : 0;

    const leaveSummary = this.buildLeaveSummary(leaveRequests, startDate, endDate);

    return {
      user: {
        id: user.id,
        name: user.name,
        employee_id: user.employeeId,
      },
      year,
      month,
      summary: {
        workdays,
        present_days: presentDays,
        absent_days: absentDays,
        late_days: lateDays,
        early_leave_days: earlyLeaveDays,
        leave_days: leaveDays,
        overtime_hours: 0,
        attendance_rate: attendanceRate,
      },
      leave_summary: leaveSummary,
    };
  }

  /**
   * 團隊報表
   */
  async getTeamReport(user: CurrentUserData, year: number, month: number, departmentId?: string) {
    const deptId = this.resolveTeamDepartmentId(user, departmentId);

    const department = await this.prisma.department.findUnique({
      where: { id: deptId },
      select: { id: true, name: true },
    });

    const members = await this.prisma.user.findMany({
      where: { departmentId: deptId, status: 'ACTIVE' },
      select: { id: true, name: true, employeeId: true, hireDate: true },
    });

    const memberReports: MemberReport[] = [];
    for (const member of members) {
      const report = await this.getPersonalReport(member.id, year, month);
      memberReports.push({
        user: report.user,
        present_days: report.summary.present_days,
        absent_days: report.summary.absent_days,
        late_days: report.summary.late_days,
        early_leave_days: report.summary.early_leave_days,
        leave_days: report.summary.leave_days,
        overtime_hours: report.summary.overtime_hours,
        attendance_rate: report.summary.attendance_rate,
      });
    }

    const totalMembers = memberReports.length;
    const avgAttendanceRate = totalMembers > 0
      ? Math.round(
          (memberReports.reduce((sum, m) => sum + m.attendance_rate, 0) / totalMembers) * 10,
        ) / 10
      : 0;
    const totalLateCount = memberReports.reduce((sum, m) => sum + m.late_days, 0);
    const totalLeaveDays = memberReports.reduce((sum, m) => sum + m.leave_days, 0);

    return {
      department: department ? { id: department.id, name: department.name } : null,
      year,
      month,
      team_summary: {
        total_members: totalMembers,
        avg_attendance_rate: avgAttendanceRate,
        total_late_count: totalLateCount,
        total_leave_days: totalLeaveDays,
      },
      members: memberReports,
    };
  }

  /**
   * 全公司報表
   */
  async getCompanyReport(year: number, month: number) {
    const departments = await this.prisma.department.findMany({
      select: { id: true, name: true },
    });

    const departmentReports = [];
    let totalEmployees = 0;
    let totalAttendanceRateSum = 0;
    let totalLateCount = 0;
    let totalLeaveDays = 0;

    for (const dept of departments) {
      const members = await this.prisma.user.findMany({
        where: { departmentId: dept.id, status: 'ACTIVE' },
        select: { id: true, name: true, employeeId: true, hireDate: true },
      });

      if (members.length === 0) continue;

      let deptAttendanceSum = 0;
      let deptLateCount = 0;
      let deptLeaveDays = 0;

      for (const member of members) {
        const report = await this.getPersonalReport(member.id, year, month);
        deptAttendanceSum += report.summary.attendance_rate;
        deptLateCount += report.summary.late_days;
        deptLeaveDays += report.summary.leave_days;
      }

      const deptAvgRate = Math.round((deptAttendanceSum / members.length) * 10) / 10;

      departmentReports.push({
        department: { id: dept.id, name: dept.name },
        total_members: members.length,
        avg_attendance_rate: deptAvgRate,
        total_late_count: deptLateCount,
        total_leave_days: deptLeaveDays,
      });

      totalEmployees += members.length;
      totalAttendanceRateSum += deptAttendanceSum;
      totalLateCount += deptLateCount;
      totalLeaveDays += deptLeaveDays;
    }

    const avgAttendanceRate = totalEmployees > 0
      ? Math.round((totalAttendanceRateSum / totalEmployees) * 10) / 10
      : 0;

    return {
      year,
      month,
      company_summary: {
        total_employees: totalEmployees,
        avg_attendance_rate: avgAttendanceRate,
        total_late_count: totalLateCount,
        total_leave_days: totalLeaveDays,
        total_overtime_hours: 0,
      },
      departments: departmentReports,
    };
  }

  /**
   * 匯出 CSV
   */
  async exportReport(
    user: CurrentUserData,
    year: number,
    month: number,
    scope: 'team' | 'company',
    departmentId?: string,
  ): Promise<string> {
    if (scope === 'company') {
      if (user.role !== 'ADMIN') {
        throw new ForbiddenException({ code: 'FORBIDDEN', message: '權限不足' });
      }
      return this.generateCompanyCsv(year, month);
    }

    // scope === 'team'
    const deptId = this.resolveTeamDepartmentId(user, departmentId);
    return this.generateTeamCsv(user, year, month, deptId);
  }

  // === Private helpers ===

  /**
   * 決定團隊報表要查看的部門 ID
   * Manager 只能看自己部門；Admin 可指定部門，預設看全公司第一個部門
   */
  private resolveTeamDepartmentId(user: CurrentUserData, departmentId?: string): string {
    if (user.role === 'MANAGER') {
      // Manager 忽略 department_id 參數，只能看自己部門
      return user.departmentId;
    }
    // Admin
    return departmentId || user.departmentId;
  }

  /**
   * 取得月份的起訖日期（UTC Date）
   */
  getMonthRange(year: number, month: number): { startDate: Date; endDate: Date } {
    const startDate = new Date(Date.UTC(year, month - 1, 1));
    const endDate = new Date(Date.UTC(year, month, 0)); // 最後一天
    return { startDate, endDate };
  }

  /**
   * 計算工作日數（排除週六日）
   * 新進員工只算到職日之後
   */
  calculateWorkdays(startDate: Date, endDate: Date, hireDate?: Date): number {
    let count = 0;
    const current = new Date(startDate);

    // 如果到職日在月份範圍內，從到職日開始算
    if (hireDate && hireDate > startDate) {
      current.setTime(hireDate.getTime());
      // 對齊到 UTC 日期
      current.setUTCHours(0, 0, 0, 0);
    }

    while (current <= endDate) {
      const dayOfWeek = current.getUTCDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        count++;
      }
      current.setUTCDate(current.getUTCDate() + 1);
    }

    return count;
  }

  /**
   * 計算出席天數
   * 有打卡且非全天請假
   */
  calculatePresentDays(
    clockRecords: Array<{ date: Date; clockIn: Date; clockOut: Date | null }>,
    leaveRequests: Array<{
      startDate: Date;
      endDate: Date;
      startHalf: string;
      endHalf: string;
      hours: { toNumber?: () => number } | number;
    }>,
    monthStart: Date,
    monthEnd: Date,
  ): number {
    let count = 0;

    for (const record of clockRecords) {
      const recordDate = new Date(record.date);
      recordDate.setUTCHours(0, 0, 0, 0);

      // 檢查該天是否為全天請假
      const isFullDayLeave = this.isFullDayLeave(recordDate, leaveRequests);
      if (!isFullDayLeave) {
        count++;
      }
    }

    return count;
  }

  /**
   * 判斷某天是否為全天請假
   */
  private isFullDayLeave(
    date: Date,
    leaveRequests: Array<{
      startDate: Date;
      endDate: Date;
      startHalf: string;
      endHalf: string;
    }>,
  ): boolean {
    for (const leave of leaveRequests) {
      const leaveStart = new Date(leave.startDate);
      leaveStart.setUTCHours(0, 0, 0, 0);
      const leaveEnd = new Date(leave.endDate);
      leaveEnd.setUTCHours(0, 0, 0, 0);

      if (date >= leaveStart && date <= leaveEnd) {
        // 如果是單天請假
        if (leaveStart.getTime() === leaveEnd.getTime()) {
          return leave.startHalf === 'FULL';
        }
        // 如果是多天請假的第一天
        if (date.getTime() === leaveStart.getTime()) {
          return leave.startHalf === 'FULL';
        }
        // 最後一天
        if (date.getTime() === leaveEnd.getTime()) {
          return leave.endHalf === 'FULL';
        }
        // 中間天數都是全天
        return true;
      }
    }
    return false;
  }

  /**
   * 計算遲到天數（clock_in > 09:00 UTC+8）
   */
  calculateLateDays(clockRecords: Array<{ clockIn: Date }>): number {
    let count = 0;
    for (const record of clockRecords) {
      const clockIn = new Date(record.clockIn);
      // UTC+8 09:00 = UTC 01:00
      const utcHour = clockIn.getUTCHours();
      const utcMinute = clockIn.getUTCMinutes();
      // 09:00 UTC+8 = 01:00 UTC
      if (utcHour > 1 || (utcHour === 1 && utcMinute > 0)) {
        count++;
      }
    }
    return count;
  }

  /**
   * 計算早退天數（clock_out < 18:00 UTC+8）
   */
  calculateEarlyLeaveDays(
    clockRecords: Array<{ clockOut: Date | null }>,
  ): number {
    let count = 0;
    for (const record of clockRecords) {
      if (!record.clockOut) continue;
      const clockOut = new Date(record.clockOut);
      // UTC+8 18:00 = UTC 10:00
      const utcHour = clockOut.getUTCHours();
      if (utcHour < 10) {
        count++;
      }
    }
    return count;
  }

  /**
   * 計算請假天數
   * 半天假算 0.5 天
   */
  calculateLeaveDays(
    leaveRequests: Array<{
      startDate: Date;
      endDate: Date;
      startHalf: string;
      endHalf: string;
    }>,
    monthStart: Date,
    monthEnd: Date,
  ): number {
    let totalDays = 0;

    for (const leave of leaveRequests) {
      const leaveStart = new Date(leave.startDate);
      leaveStart.setUTCHours(0, 0, 0, 0);
      const leaveEnd = new Date(leave.endDate);
      leaveEnd.setUTCHours(0, 0, 0, 0);

      // 限制在月份範圍內
      const effectiveStart = leaveStart < monthStart ? monthStart : leaveStart;
      const effectiveEnd = leaveEnd > monthEnd ? monthEnd : leaveEnd;

      const current = new Date(effectiveStart);

      while (current <= effectiveEnd) {
        const dayOfWeek = current.getUTCDay();
        // 只計算工作日
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
          if (current.getTime() === leaveStart.getTime() && leave.startHalf !== 'FULL') {
            totalDays += 0.5;
          } else if (current.getTime() === leaveEnd.getTime() && leave.endHalf !== 'FULL') {
            totalDays += 0.5;
          } else {
            totalDays += 1;
          }
        }
        current.setUTCDate(current.getUTCDate() + 1);
      }
    }

    return totalDays;
  }

  /**
   * 建立假別摘要
   */
  private buildLeaveSummary(
    leaveRequests: Array<{
      leaveType: string;
      hours: { toNumber?: () => number } | number;
      startDate: Date;
      endDate: Date;
    }>,
    monthStart: Date,
    monthEnd: Date,
  ): Array<{ leave_type: string; hours: number }> {
    const leaveTypes = [
      'PERSONAL', 'SICK', 'ANNUAL', 'MARRIAGE',
      'BEREAVEMENT', 'MATERNITY', 'PATERNITY', 'OFFICIAL',
    ];

    const summary: Record<string, number> = {};
    for (const type of leaveTypes) {
      summary[type] = 0;
    }

    for (const leave of leaveRequests) {
      const hours = typeof leave.hours === 'number'
        ? leave.hours
        : (leave.hours.toNumber ? leave.hours.toNumber() : Number(leave.hours));
      summary[leave.leaveType] = (summary[leave.leaveType] || 0) + hours;
    }

    return leaveTypes.map((type) => ({
      leave_type: type.toLowerCase(),
      hours: summary[type],
    }));
  }

  /**
   * 空的個人報表
   */
  private buildEmptyPersonalReport(year: number, month: number) {
    return {
      user: { id: '', name: '', employee_id: '' },
      year,
      month,
      summary: {
        workdays: 0,
        present_days: 0,
        absent_days: 0,
        late_days: 0,
        early_leave_days: 0,
        leave_days: 0,
        overtime_hours: 0,
        attendance_rate: 0,
      },
      leave_summary: [],
    };
  }

  /**
   * 產生團隊 CSV
   */
  private async generateTeamCsv(
    user: CurrentUserData,
    year: number,
    month: number,
    departmentId: string,
  ): Promise<string> {
    const teamReport = await this.getTeamReport(user, year, month, departmentId);
    const headers = [
      '員工編號', '姓名', '出席天數', '缺勤天數', '遲到天數',
      '早退天數', '請假天數', '加班時數', '出勤率(%)',
    ];

    const rows = teamReport.members.map((m) => [
      m.user.employee_id,
      m.user.name,
      m.present_days,
      m.absent_days,
      m.late_days,
      m.early_leave_days,
      m.leave_days,
      m.overtime_hours,
      m.attendance_rate,
    ]);

    return [
      headers.join(','),
      ...rows.map((r) => r.join(',')),
    ].join('\n');
  }

  /**
   * 產生全公司 CSV
   */
  private async generateCompanyCsv(year: number, month: number): Promise<string> {
    const companyReport = await this.getCompanyReport(year, month);
    const headers = [
      '部門', '人數', '平均出勤率(%)', '遲到總次數', '請假總天數',
    ];

    const rows = companyReport.departments.map((d) => [
      d.department.name,
      d.total_members,
      d.avg_attendance_rate,
      d.total_late_count,
      d.total_leave_days,
    ]);

    return [
      headers.join(','),
      ...rows.map((r) => r.join(',')),
    ].join('\n');
  }
}
