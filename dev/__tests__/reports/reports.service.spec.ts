import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { ReportsService } from '../../src/reports/reports.service';
import { PrismaService } from '../../src/prisma/prisma.service';

describe('ReportsService', () => {
  let service: ReportsService;
  let prisma: {
    user: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
    };
    clockRecord: {
      findMany: jest.Mock;
    };
    leaveRequest: {
      findMany: jest.Mock;
    };
    department: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
    };
  };

  const mockUserId = 'user-uuid-1';
  const mockDeptId = 'dept-uuid-1';

  function makeDateOnly(year: number, month: number, day: number): Date {
    return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  }

  function makeUTC8Date(
    year: number,
    month: number,
    day: number,
    hour: number,
    minute: number,
  ): Date {
    const utcHour = hour - 8;
    return new Date(Date.UTC(year, month - 1, day, utcHour, minute, 0, 0));
  }

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      clockRecord: {
        findMany: jest.fn(),
      },
      leaveRequest: {
        findMany: jest.fn(),
      },
      department: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getMonthRange', () => {
    it('should return correct start and end dates for a month', () => {
      const { startDate, endDate } = service.getMonthRange(2026, 4);
      expect(startDate).toEqual(new Date(Date.UTC(2026, 3, 1)));
      expect(endDate).toEqual(new Date(Date.UTC(2026, 3, 30)));
    });

    it('should handle February correctly', () => {
      const { startDate, endDate } = service.getMonthRange(2026, 2);
      expect(startDate).toEqual(new Date(Date.UTC(2026, 1, 1)));
      expect(endDate).toEqual(new Date(Date.UTC(2026, 1, 28)));
    });
  });

  describe('calculateWorkdays', () => {
    it('should exclude weekends', () => {
      // April 2026: starts on Wednesday
      // Weekdays: 1,2,3 (Wed-Fri), 6-10, 13-17, 20-24, 27-30 = 22 days
      const start = makeDateOnly(2026, 4, 1);
      const end = makeDateOnly(2026, 4, 30);
      expect(service.calculateWorkdays(start, end)).toBe(22);
    });

    it('should count from hire_date when hire_date is mid-month', () => {
      // April 15, 2026 is Wednesday
      // 15,16,17 (Wed-Fri), 20-24, 27-30 = 12 days
      const start = makeDateOnly(2026, 4, 1);
      const end = makeDateOnly(2026, 4, 30);
      const hireDate = makeDateOnly(2026, 4, 15);
      expect(service.calculateWorkdays(start, end, hireDate)).toBe(12);
    });

    it('should ignore hire_date when it is before the month', () => {
      const start = makeDateOnly(2026, 4, 1);
      const end = makeDateOnly(2026, 4, 30);
      const hireDate = makeDateOnly(2026, 1, 10);
      expect(service.calculateWorkdays(start, end, hireDate)).toBe(22);
    });
  });

  describe('calculateLateDays', () => {
    it('should count records with clock_in after 09:00 UTC+8', () => {
      const records = [
        { clockIn: makeUTC8Date(2026, 4, 1, 8, 55) },  // on time
        { clockIn: makeUTC8Date(2026, 4, 2, 9, 5) },   // late
        { clockIn: makeUTC8Date(2026, 4, 3, 9, 0) },   // on time (exactly 09:00)
        { clockIn: makeUTC8Date(2026, 4, 6, 10, 0) },  // late
      ];
      expect(service.calculateLateDays(records)).toBe(2);
    });

    it('should return 0 when no records are late', () => {
      const records = [
        { clockIn: makeUTC8Date(2026, 4, 1, 8, 30) },
        { clockIn: makeUTC8Date(2026, 4, 2, 9, 0) },
      ];
      expect(service.calculateLateDays(records)).toBe(0);
    });
  });

  describe('calculateEarlyLeaveDays', () => {
    it('should count records with clock_out before 18:00 UTC+8', () => {
      const records = [
        { clockOut: makeUTC8Date(2026, 4, 1, 18, 30) }, // normal
        { clockOut: makeUTC8Date(2026, 4, 2, 17, 0) },  // early
        { clockOut: makeUTC8Date(2026, 4, 3, 18, 0) },  // exactly 18:00 = normal
        { clockOut: null },                               // no clock out
      ];
      expect(service.calculateEarlyLeaveDays(records)).toBe(1);
    });
  });

  describe('calculateLeaveDays', () => {
    it('should count full day leaves', () => {
      const leaves = [
        {
          startDate: makeDateOnly(2026, 4, 6), // Monday
          endDate: makeDateOnly(2026, 4, 8),   // Wednesday
          startHalf: 'FULL',
          endHalf: 'FULL',
        },
      ];
      const monthStart = makeDateOnly(2026, 4, 1);
      const monthEnd = makeDateOnly(2026, 4, 30);
      expect(service.calculateLeaveDays(leaves, monthStart, monthEnd)).toBe(3);
    });

    it('should count half day leaves as 0.5', () => {
      const leaves = [
        {
          startDate: makeDateOnly(2026, 4, 6), // Monday
          endDate: makeDateOnly(2026, 4, 6),
          startHalf: 'MORNING',
          endHalf: 'MORNING',
        },
      ];
      const monthStart = makeDateOnly(2026, 4, 1);
      const monthEnd = makeDateOnly(2026, 4, 30);
      expect(service.calculateLeaveDays(leaves, monthStart, monthEnd)).toBe(0.5);
    });

    it('should skip weekends in leave calculation', () => {
      // Friday to Monday = 2 workdays (Fri + Mon), skip Sat/Sun
      const leaves = [
        {
          startDate: makeDateOnly(2026, 4, 3),  // Friday
          endDate: makeDateOnly(2026, 4, 6),    // Monday
          startHalf: 'FULL',
          endHalf: 'FULL',
        },
      ];
      const monthStart = makeDateOnly(2026, 4, 1);
      const monthEnd = makeDateOnly(2026, 4, 30);
      expect(service.calculateLeaveDays(leaves, monthStart, monthEnd)).toBe(2);
    });

    it('should handle multi-day leave with half day on start/end', () => {
      const leaves = [
        {
          startDate: makeDateOnly(2026, 4, 6),  // Monday
          endDate: makeDateOnly(2026, 4, 8),    // Wednesday
          startHalf: 'AFTERNOON',               // half day start
          endHalf: 'MORNING',                   // half day end
        },
      ];
      const monthStart = makeDateOnly(2026, 4, 1);
      const monthEnd = makeDateOnly(2026, 4, 30);
      // Mon 0.5 + Tue 1 + Wed 0.5 = 2
      expect(service.calculateLeaveDays(leaves, monthStart, monthEnd)).toBe(2);
    });
  });

  describe('calculatePresentDays', () => {
    it('should count clock records that are not full day leave', () => {
      const clockRecords = [
        { date: makeDateOnly(2026, 4, 1), clockIn: makeUTC8Date(2026, 4, 1, 9, 0), clockOut: makeUTC8Date(2026, 4, 1, 18, 0) },
        { date: makeDateOnly(2026, 4, 2), clockIn: makeUTC8Date(2026, 4, 2, 9, 0), clockOut: makeUTC8Date(2026, 4, 2, 18, 0) },
        { date: makeDateOnly(2026, 4, 3), clockIn: makeUTC8Date(2026, 4, 3, 9, 0), clockOut: makeUTC8Date(2026, 4, 3, 18, 0) },
      ];
      const leaveRequests = [
        {
          startDate: makeDateOnly(2026, 4, 2),
          endDate: makeDateOnly(2026, 4, 2),
          startHalf: 'FULL',
          endHalf: 'FULL',
          hours: 8,
        },
      ];
      const monthStart = makeDateOnly(2026, 4, 1);
      const monthEnd = makeDateOnly(2026, 4, 30);
      // 3 clock records, but Apr 2 is full day leave => 2 present
      expect(service.calculatePresentDays(clockRecords, leaveRequests, monthStart, monthEnd)).toBe(2);
    });

    it('should count half day leave as present', () => {
      const clockRecords = [
        { date: makeDateOnly(2026, 4, 1), clockIn: makeUTC8Date(2026, 4, 1, 9, 0), clockOut: makeUTC8Date(2026, 4, 1, 12, 0) },
      ];
      const leaveRequests = [
        {
          startDate: makeDateOnly(2026, 4, 1),
          endDate: makeDateOnly(2026, 4, 1),
          startHalf: 'AFTERNOON',
          endHalf: 'AFTERNOON',
          hours: 4,
        },
      ];
      const monthStart = makeDateOnly(2026, 4, 1);
      const monthEnd = makeDateOnly(2026, 4, 30);
      // Half day leave, so still counted as present
      expect(service.calculatePresentDays(clockRecords, leaveRequests, monthStart, monthEnd)).toBe(1);
    });
  });

  describe('getPersonalReport', () => {
    it('should return correct personal report with attendance stats', async () => {
      const mockUser = {
        id: mockUserId,
        name: '王小明',
        employeeId: 'EMP001',
        hireDate: makeDateOnly(2026, 1, 1),
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);

      // 20 clock records in April 2026 (all on time, no early leave)
      const clockRecords = Array.from({ length: 20 }, (_, i) => {
        const day = [1, 2, 3, 6, 7, 8, 9, 10, 13, 14, 15, 16, 17, 20, 21, 22, 23, 24, 27, 28][i];
        return {
          date: makeDateOnly(2026, 4, day),
          clockIn: makeUTC8Date(2026, 4, day, 8, 55),
          clockOut: makeUTC8Date(2026, 4, day, 18, 30),
        };
      });

      prisma.clockRecord.findMany.mockResolvedValue(clockRecords);

      // 2 days annual leave
      const leaveRequests = [
        {
          id: 'leave-1',
          leaveType: 'ANNUAL',
          startDate: makeDateOnly(2026, 4, 29),
          endDate: makeDateOnly(2026, 4, 30),
          startHalf: 'FULL',
          endHalf: 'FULL',
          hours: { toNumber: () => 16 },
          status: 'APPROVED',
        },
      ];
      prisma.leaveRequest.findMany.mockResolvedValue(leaveRequests);

      const result = await service.getPersonalReport(mockUserId, 2026, 4);

      expect(result.user.id).toBe(mockUserId);
      expect(result.user.name).toBe('王小明');
      expect(result.user.employee_id).toBe('EMP001');
      expect(result.year).toBe(2026);
      expect(result.month).toBe(4);
      expect(result.summary.workdays).toBe(22);
      expect(result.summary.present_days).toBe(20);
      expect(result.summary.leave_days).toBe(2);
      expect(result.summary.absent_days).toBe(0);
      expect(result.summary.late_days).toBe(0);
      expect(result.summary.early_leave_days).toBe(0);
      expect(result.summary.overtime_hours).toBe(0);
      // attendance_rate = (20 / 22) * 100 = 90.9
      expect(result.summary.attendance_rate).toBe(90.9);
      // leave summary should include annual
      const annualLeave = result.leave_summary.find(
        (l: { leave_type: string }) => l.leave_type === 'annual',
      );
      expect(annualLeave).toBeDefined();
      expect(annualLeave!.hours).toBe(16);
    });

    it('should handle new employee with mid-month hire date', async () => {
      const mockUser = {
        id: mockUserId,
        name: '新員工',
        employeeId: 'EMP010',
        hireDate: makeDateOnly(2026, 4, 15), // mid-month
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);

      // 12 workdays after April 15
      const workdayDates = [15, 16, 17, 20, 21, 22, 23, 24, 27, 28, 29, 30];
      const clockRecords = workdayDates.map((day) => ({
        date: makeDateOnly(2026, 4, day),
        clockIn: makeUTC8Date(2026, 4, day, 8, 55),
        clockOut: makeUTC8Date(2026, 4, day, 18, 30),
      }));

      prisma.clockRecord.findMany.mockResolvedValue(clockRecords);
      prisma.leaveRequest.findMany.mockResolvedValue([]);

      const result = await service.getPersonalReport(mockUserId, 2026, 4);

      expect(result.summary.workdays).toBe(12);
      expect(result.summary.present_days).toBe(12);
      expect(result.summary.attendance_rate).toBe(100);
    });

    it('should return all zeros for future month', async () => {
      const mockUser = {
        id: mockUserId,
        name: '王小明',
        employeeId: 'EMP001',
        hireDate: makeDateOnly(2026, 1, 1),
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.clockRecord.findMany.mockResolvedValue([]);
      prisma.leaveRequest.findMany.mockResolvedValue([]);

      const result = await service.getPersonalReport(mockUserId, 2026, 12);

      expect(result.summary.present_days).toBe(0);
      expect(result.summary.late_days).toBe(0);
      expect(result.summary.early_leave_days).toBe(0);
      expect(result.summary.leave_days).toBe(0);
    });

    it('should return empty report when user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await service.getPersonalReport('nonexistent', 2026, 4);

      expect(result.user.id).toBe('');
      expect(result.summary.workdays).toBe(0);
    });
  });

  describe('getTeamReport', () => {
    const managerUser = {
      userId: 'manager-uuid',
      role: 'MANAGER',
      departmentId: mockDeptId,
    };

    it('should return team report with correct summary', async () => {
      prisma.department.findUnique.mockResolvedValue({
        id: mockDeptId,
        name: '工程部',
      });

      const members = [
        { id: 'user-1', name: '員工A', employeeId: 'EMP001', hireDate: makeDateOnly(2026, 1, 1) },
        { id: 'user-2', name: '員工B', employeeId: 'EMP002', hireDate: makeDateOnly(2026, 1, 1) },
      ];
      prisma.user.findMany.mockResolvedValue(members);

      // Mock getPersonalReport for each member
      prisma.user.findUnique
        .mockResolvedValueOnce({ id: 'user-1', name: '員工A', employeeId: 'EMP001', hireDate: makeDateOnly(2026, 1, 1) })
        .mockResolvedValueOnce({ id: 'user-2', name: '員工B', employeeId: 'EMP002', hireDate: makeDateOnly(2026, 1, 1) });

      // user-1: 20 present, 1 late, 2 leave
      prisma.clockRecord.findMany
        .mockResolvedValueOnce(
          Array.from({ length: 20 }, (_, i) => ({
            date: makeDateOnly(2026, 4, i + 1),
            clockIn: i === 0
              ? makeUTC8Date(2026, 4, 1, 9, 30)  // late
              : makeUTC8Date(2026, 4, i + 1, 8, 55),
            clockOut: makeUTC8Date(2026, 4, i + 1, 18, 30),
          })),
        )
        .mockResolvedValueOnce(
          Array.from({ length: 22 }, (_, i) => ({
            date: makeDateOnly(2026, 4, i + 1),
            clockIn: makeUTC8Date(2026, 4, i + 1, 8, 50),
            clockOut: makeUTC8Date(2026, 4, i + 1, 18, 30),
          })),
        );

      prisma.leaveRequest.findMany
        .mockResolvedValueOnce([
          {
            leaveType: 'ANNUAL',
            startDate: makeDateOnly(2026, 4, 29),
            endDate: makeDateOnly(2026, 4, 30),
            startHalf: 'FULL',
            endHalf: 'FULL',
            hours: { toNumber: () => 16 },
            status: 'APPROVED',
          },
        ])
        .mockResolvedValueOnce([]);

      const result = await service.getTeamReport(managerUser, 2026, 4);

      expect(result.department).toEqual({ id: mockDeptId, name: '工程部' });
      expect(result.team_summary.total_members).toBe(2);
      expect(result.members).toHaveLength(2);
    });

    it('should use manager department_id regardless of query param', async () => {
      prisma.department.findUnique.mockResolvedValue({
        id: mockDeptId,
        name: '工程部',
      });
      prisma.user.findMany.mockResolvedValue([]);

      await service.getTeamReport(managerUser, 2026, 4, 'other-dept-id');

      // Should query with manager's own department, not the passed one
      expect(prisma.department.findUnique).toHaveBeenCalledWith({
        where: { id: mockDeptId },
        select: { id: true, name: true },
      });
    });

    it('should allow admin to specify department_id', async () => {
      const adminUser = {
        userId: 'admin-uuid',
        role: 'ADMIN',
        departmentId: 'admin-dept',
      };
      const targetDept = 'target-dept-uuid';

      prisma.department.findUnique.mockResolvedValue({
        id: targetDept,
        name: '行銷部',
      });
      prisma.user.findMany.mockResolvedValue([]);

      await service.getTeamReport(adminUser, 2026, 4, targetDept);

      expect(prisma.department.findUnique).toHaveBeenCalledWith({
        where: { id: targetDept },
        select: { id: true, name: true },
      });
    });
  });

  describe('getCompanyReport', () => {
    it('should aggregate all departments', async () => {
      prisma.department.findMany.mockResolvedValue([
        { id: 'dept-1', name: '工程部' },
        { id: 'dept-2', name: '行銷部' },
      ]);

      // Dept 1: 2 members
      prisma.user.findMany
        .mockResolvedValueOnce([
          { id: 'u1', name: 'A', employeeId: 'E1', hireDate: makeDateOnly(2026, 1, 1) },
          { id: 'u2', name: 'B', employeeId: 'E2', hireDate: makeDateOnly(2026, 1, 1) },
        ])
        .mockResolvedValueOnce([
          { id: 'u3', name: 'C', employeeId: 'E3', hireDate: makeDateOnly(2026, 1, 1) },
        ]);

      // Mock personal reports for all 3 users
      prisma.user.findUnique
        .mockResolvedValueOnce({ id: 'u1', name: 'A', employeeId: 'E1', hireDate: makeDateOnly(2026, 1, 1) })
        .mockResolvedValueOnce({ id: 'u2', name: 'B', employeeId: 'E2', hireDate: makeDateOnly(2026, 1, 1) })
        .mockResolvedValueOnce({ id: 'u3', name: 'C', employeeId: 'E3', hireDate: makeDateOnly(2026, 1, 1) });

      prisma.clockRecord.findMany.mockResolvedValue([]);
      prisma.leaveRequest.findMany.mockResolvedValue([]);

      const result = await service.getCompanyReport(2026, 4);

      expect(result.company_summary.total_employees).toBe(3);
      expect(result.departments).toHaveLength(2);
      expect(result.company_summary.total_overtime_hours).toBe(0);
    });

    it('should skip departments with no active members', async () => {
      prisma.department.findMany.mockResolvedValue([
        { id: 'dept-1', name: '工程部' },
        { id: 'dept-2', name: '已裁撤部門' },
      ]);

      prisma.user.findMany
        .mockResolvedValueOnce([
          { id: 'u1', name: 'A', employeeId: 'E1', hireDate: makeDateOnly(2026, 1, 1) },
        ])
        .mockResolvedValueOnce([]); // empty department

      prisma.user.findUnique.mockResolvedValueOnce({
        id: 'u1', name: 'A', employeeId: 'E1', hireDate: makeDateOnly(2026, 1, 1),
      });
      prisma.clockRecord.findMany.mockResolvedValue([]);
      prisma.leaveRequest.findMany.mockResolvedValue([]);

      const result = await service.getCompanyReport(2026, 4);

      expect(result.departments).toHaveLength(1);
      expect(result.company_summary.total_employees).toBe(1);
    });
  });

  describe('exportReport', () => {
    const managerUser = {
      userId: 'manager-uuid',
      role: 'MANAGER',
      departmentId: mockDeptId,
    };

    const adminUser = {
      userId: 'admin-uuid',
      role: 'ADMIN',
      departmentId: mockDeptId,
    };

    it('should throw FORBIDDEN when manager tries to export company scope', async () => {
      await expect(
        service.exportReport(managerUser, 2026, 4, 'company'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should generate CSV for team scope', async () => {
      prisma.department.findUnique.mockResolvedValue({ id: mockDeptId, name: '工程部' });
      prisma.user.findMany.mockResolvedValue([
        { id: 'u1', name: '員工A', employeeId: 'EMP001', hireDate: makeDateOnly(2026, 1, 1) },
      ]);
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1', name: '員工A', employeeId: 'EMP001', hireDate: makeDateOnly(2026, 1, 1),
      });
      prisma.clockRecord.findMany.mockResolvedValue([]);
      prisma.leaveRequest.findMany.mockResolvedValue([]);

      const csv = await service.exportReport(managerUser, 2026, 4, 'team');

      expect(csv).toContain('員工編號');
      expect(csv).toContain('姓名');
      expect(csv).toContain('EMP001');
      expect(csv).toContain('員工A');
    });

    it('should generate CSV for company scope (admin)', async () => {
      prisma.department.findMany.mockResolvedValue([
        { id: 'dept-1', name: '工程部' },
      ]);
      prisma.user.findMany.mockResolvedValue([
        { id: 'u1', name: 'A', employeeId: 'E1', hireDate: makeDateOnly(2026, 1, 1) },
      ]);
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1', name: 'A', employeeId: 'E1', hireDate: makeDateOnly(2026, 1, 1),
      });
      prisma.clockRecord.findMany.mockResolvedValue([]);
      prisma.leaveRequest.findMany.mockResolvedValue([]);

      const csv = await service.exportReport(adminUser, 2026, 4, 'company');

      expect(csv).toContain('部門');
      expect(csv).toContain('工程部');
    });
  });
});
