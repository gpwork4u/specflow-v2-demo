import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, HttpException, HttpStatus } from '@nestjs/common';
import { CalendarService } from '../../src/calendar/calendar.service';
import { PrismaService } from '../../src/prisma/prisma.service';

describe('CalendarService', () => {
  let service: CalendarService;
  let prisma: {
    clockRecord: {
      findMany: jest.Mock;
    };
    leaveRequest: {
      findMany: jest.Mock;
    };
    department: {
      findUnique: jest.Mock;
    };
    user: {
      findMany: jest.Mock;
    };
  };

  const mockUserId = 'user-uuid-1';
  const mockDepartmentId = 'dept-uuid-1';

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
      clockRecord: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      leaveRequest: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      department: {
        findUnique: jest.fn(),
      },
      user: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CalendarService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<CalendarService>(CalendarService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getPersonalCalendar', () => {
    it('should return all days of the month with correct structure', async () => {
      const result = await service.getPersonalCalendar(mockUserId, {
        year: 2026,
        month: 4,
      });

      expect(result.year).toBe(2026);
      expect(result.month).toBe(4);
      expect(result.days).toHaveLength(30); // April has 30 days
    });

    it('should return 31 days for January', async () => {
      const result = await service.getPersonalCalendar(mockUserId, {
        year: 2026,
        month: 1,
      });

      expect(result.days).toHaveLength(31);
    });

    it('should return 28 days for February 2026 (non-leap year)', async () => {
      const result = await service.getPersonalCalendar(mockUserId, {
        year: 2026,
        month: 2,
      });

      expect(result.days).toHaveLength(28);
    });

    it('should mark weekends as is_workday=false', async () => {
      const result = await service.getPersonalCalendar(mockUserId, {
        year: 2026,
        month: 4,
      });

      // 2026-04-04 is Saturday, 2026-04-05 is Sunday
      const saturday = result.days.find((d) => d.date === '2026-04-04');
      const sunday = result.days.find((d) => d.date === '2026-04-05');
      const monday = result.days.find((d) => d.date === '2026-04-06');

      expect(saturday!.is_workday).toBe(false);
      expect(sunday!.is_workday).toBe(false);
      expect(monday!.is_workday).toBe(true);
    });

    it('should include clock data for days with clock records', async () => {
      const clockIn = makeUTC8Date(2026, 4, 1, 9, 0);
      const clockOut = makeUTC8Date(2026, 4, 1, 18, 0);

      prisma.clockRecord.findMany.mockResolvedValue([
        {
          id: 'clock-1',
          userId: mockUserId,
          date: makeDateOnly(2026, 4, 1),
          clockIn,
          clockOut,
          status: 'NORMAL',
          note: null,
          createdAt: clockIn,
          updatedAt: clockOut,
        },
      ]);

      const result = await service.getPersonalCalendar(mockUserId, {
        year: 2026,
        month: 4,
      });

      const april1 = result.days.find((d) => d.date === '2026-04-01');
      expect(april1!.clock).toEqual({
        clock_in: clockIn.toISOString(),
        clock_out: clockOut.toISOString(),
        status: 'normal',
      });
    });

    it('should include leave data for days with leave requests', async () => {
      prisma.leaveRequest.findMany.mockResolvedValue([
        {
          id: 'leave-1',
          userId: mockUserId,
          leaveType: 'ANNUAL',
          startDate: makeDateOnly(2026, 4, 2),
          endDate: makeDateOnly(2026, 4, 2),
          startHalf: 'FULL',
          endHalf: 'FULL',
          status: 'APPROVED',
          hours: 8,
          reason: '休假',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const result = await service.getPersonalCalendar(mockUserId, {
        year: 2026,
        month: 4,
      });

      const april2 = result.days.find((d) => d.date === '2026-04-02');
      expect(april2!.leaves).toHaveLength(1);
      expect(april2!.leaves[0]).toEqual({
        id: 'leave-1',
        leave_type: 'annual',
        start_half: 'full',
        end_half: 'full',
        status: 'approved',
      });
    });

    it('should handle half-day leave with clock record on the same day', async () => {
      const clockIn = makeUTC8Date(2026, 4, 10, 13, 0);
      const clockOut = makeUTC8Date(2026, 4, 10, 18, 0);

      prisma.clockRecord.findMany.mockResolvedValue([
        {
          id: 'clock-1',
          userId: mockUserId,
          date: makeDateOnly(2026, 4, 10),
          clockIn,
          clockOut,
          status: 'NORMAL',
          note: null,
          createdAt: clockIn,
          updatedAt: clockOut,
        },
      ]);

      prisma.leaveRequest.findMany.mockResolvedValue([
        {
          id: 'leave-1',
          userId: mockUserId,
          leaveType: 'ANNUAL',
          startDate: makeDateOnly(2026, 4, 10),
          endDate: makeDateOnly(2026, 4, 10),
          startHalf: 'MORNING',
          endHalf: 'MORNING',
          status: 'APPROVED',
          hours: 4,
          reason: '上午半天假',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const result = await service.getPersonalCalendar(mockUserId, {
        year: 2026,
        month: 4,
      });

      const april10 = result.days.find((d) => d.date === '2026-04-10');
      expect(april10!.clock).not.toBeNull();
      expect(april10!.clock!.clock_in).toBe(clockIn.toISOString());
      expect(april10!.leaves).toHaveLength(1);
      expect(april10!.leaves[0].start_half).toBe('morning');
    });

    it('should return null for clock/leaves/overtime for future months with no data', async () => {
      const result = await service.getPersonalCalendar(mockUserId, {
        year: 2026,
        month: 12,
      });

      expect(result.days).toHaveLength(31);
      for (const day of result.days) {
        expect(day.clock).toBeNull();
        expect(day.leaves).toEqual([]);
        expect(day.overtime).toBeNull();
      }
    });

    it('should always set overtime to null (Sprint 3 limitation)', async () => {
      prisma.clockRecord.findMany.mockResolvedValue([
        {
          id: 'clock-1',
          userId: mockUserId,
          date: makeDateOnly(2026, 4, 1),
          clockIn: makeUTC8Date(2026, 4, 1, 9, 0),
          clockOut: makeUTC8Date(2026, 4, 1, 18, 0),
          status: 'NORMAL',
          note: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const result = await service.getPersonalCalendar(mockUserId, {
        year: 2026,
        month: 4,
      });

      for (const day of result.days) {
        expect(day.overtime).toBeNull();
      }
    });

    it('should handle multi-day leave spanning across month boundary', async () => {
      // 請假 3/30 ~ 4/2，查詢 4 月
      prisma.leaveRequest.findMany.mockResolvedValue([
        {
          id: 'leave-cross',
          userId: mockUserId,
          leaveType: 'ANNUAL',
          startDate: makeDateOnly(2026, 3, 30),
          endDate: makeDateOnly(2026, 4, 2),
          startHalf: 'FULL',
          endHalf: 'FULL',
          status: 'APPROVED',
          hours: 32,
          reason: '長假',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const result = await service.getPersonalCalendar(mockUserId, {
        year: 2026,
        month: 4,
      });

      // 4/1 和 4/2 應該有請假資料
      const april1 = result.days.find((d) => d.date === '2026-04-01');
      const april2 = result.days.find((d) => d.date === '2026-04-02');
      const april3 = result.days.find((d) => d.date === '2026-04-03');

      expect(april1!.leaves).toHaveLength(1);
      expect(april2!.leaves).toHaveLength(1);
      expect(april3!.leaves).toHaveLength(0);
    });

    it('should include clock record with null clock_out', async () => {
      const clockIn = makeUTC8Date(2026, 4, 7, 9, 0);

      prisma.clockRecord.findMany.mockResolvedValue([
        {
          id: 'clock-1',
          userId: mockUserId,
          date: makeDateOnly(2026, 4, 7),
          clockIn,
          clockOut: null,
          status: 'NORMAL',
          note: null,
          createdAt: clockIn,
          updatedAt: clockIn,
        },
      ]);

      const result = await service.getPersonalCalendar(mockUserId, {
        year: 2026,
        month: 4,
      });

      const april7 = result.days.find((d) => d.date === '2026-04-07');
      expect(april7!.clock).toEqual({
        clock_in: clockIn.toISOString(),
        clock_out: null,
        status: 'normal',
      });
    });
  });

  describe('getTeamCalendar', () => {
    interface TeamDay {
      date: string;
      status: string;
      leave_type: string | null;
    }

    const mockDepartment = { id: mockDepartmentId, name: '工程部' };
    const mockMembers = [
      { id: 'user-1', name: '王小明', employeeId: 'EMP001' },
      { id: 'user-2', name: '李大華', employeeId: 'EMP002' },
    ];

    beforeEach(() => {
      prisma.department.findUnique.mockResolvedValue(mockDepartment);
      prisma.user.findMany.mockResolvedValue(mockMembers);
    });

    it('should return team calendar with correct structure for manager', async () => {
      const result = await service.getTeamCalendar(
        mockUserId,
        'MANAGER',
        mockDepartmentId,
        { year: 2026, month: 4 },
      );

      expect(result.year).toBe(2026);
      expect(result.month).toBe(4);
      expect(result.department).toEqual(mockDepartment);
      expect(result.members).toHaveLength(2);
      expect(result.members[0].user).toEqual({
        id: 'user-1',
        name: '王小明',
        employee_id: 'EMP001',
      });
      expect(result.members[0].days).toHaveLength(30);
    });

    it('should mark weekends as holiday status', async () => {
      const result = await service.getTeamCalendar(
        mockUserId,
        'MANAGER',
        mockDepartmentId,
        { year: 2026, month: 4 },
      );

      // 2026-04-04 is Saturday
      const saturday = result.members[0].days.find(
        (d: TeamDay) => d.date === '2026-04-04',
      );
      expect(saturday!.status).toBe('holiday');
      expect(saturday!.leave_type).toBeNull();
    });

    it('should show present status for normal clock record', async () => {
      prisma.clockRecord.findMany.mockResolvedValue([
        {
          id: 'clock-1',
          userId: 'user-1',
          date: makeDateOnly(2026, 4, 1),
          clockIn: makeUTC8Date(2026, 4, 1, 9, 0),
          clockOut: makeUTC8Date(2026, 4, 1, 18, 0),
          status: 'NORMAL',
        },
      ]);

      const result = await service.getTeamCalendar(
        mockUserId,
        'MANAGER',
        mockDepartmentId,
        { year: 2026, month: 4 },
      );

      const user1April1 = result.members[0].days.find(
        (d: TeamDay) => d.date === '2026-04-01',
      );
      expect(user1April1!.status).toBe('present');
      expect(user1April1!.leave_type).toBeNull();
    });

    it('should show late status for late clock record', async () => {
      prisma.clockRecord.findMany.mockResolvedValue([
        {
          id: 'clock-1',
          userId: 'user-1',
          date: makeDateOnly(2026, 4, 1),
          clockIn: makeUTC8Date(2026, 4, 1, 10, 0),
          clockOut: makeUTC8Date(2026, 4, 1, 18, 0),
          status: 'LATE',
        },
      ]);

      const result = await service.getTeamCalendar(
        mockUserId,
        'MANAGER',
        mockDepartmentId,
        { year: 2026, month: 4 },
      );

      const user1April1 = result.members[0].days.find(
        (d: TeamDay) => d.date === '2026-04-01',
      );
      expect(user1April1!.status).toBe('late');
    });

    it('should show early_leave status for early leave clock record', async () => {
      prisma.clockRecord.findMany.mockResolvedValue([
        {
          id: 'clock-1',
          userId: 'user-1',
          date: makeDateOnly(2026, 4, 1),
          clockIn: makeUTC8Date(2026, 4, 1, 9, 0),
          clockOut: makeUTC8Date(2026, 4, 1, 16, 0),
          status: 'EARLY_LEAVE',
        },
      ]);

      const result = await service.getTeamCalendar(
        mockUserId,
        'MANAGER',
        mockDepartmentId,
        { year: 2026, month: 4 },
      );

      const user1April1 = result.members[0].days.find(
        (d: TeamDay) => d.date === '2026-04-01',
      );
      expect(user1April1!.status).toBe('early_leave');
    });

    it('should show leave status with leave_type for approved leave', async () => {
      prisma.leaveRequest.findMany.mockResolvedValue([
        {
          id: 'leave-1',
          userId: 'user-1',
          leaveType: 'ANNUAL',
          startDate: makeDateOnly(2026, 4, 2),
          endDate: makeDateOnly(2026, 4, 2),
          status: 'APPROVED',
        },
      ]);

      const result = await service.getTeamCalendar(
        mockUserId,
        'MANAGER',
        mockDepartmentId,
        { year: 2026, month: 4 },
      );

      const user1April2 = result.members[0].days.find(
        (d: TeamDay) => d.date === '2026-04-02',
      );
      expect(user1April2!.status).toBe('leave');
      expect(user1April2!.leave_type).toBe('annual');
    });

    it('should show absent status when no clock and no leave on workday', async () => {
      const result = await service.getTeamCalendar(
        mockUserId,
        'MANAGER',
        mockDepartmentId,
        { year: 2026, month: 4 },
      );

      // 2026-04-01 is Wednesday, no clock, no leave
      const user1April1 = result.members[0].days.find(
        (d: TeamDay) => d.date === '2026-04-01',
      );
      expect(user1April1!.status).toBe('absent');
    });

    it('should allow Admin to view any department', async () => {
      const otherDeptId = 'dept-uuid-other';
      prisma.department.findUnique.mockResolvedValue({
        id: otherDeptId,
        name: '行銷部',
      });

      const result = await service.getTeamCalendar(
        mockUserId,
        'ADMIN',
        mockDepartmentId,
        { year: 2026, month: 4, department_id: otherDeptId },
      );

      expect(result.department.id).toBe(otherDeptId);
      expect(result.department.name).toBe('行銷部');
    });

    it('should use manager own department when no department_id specified', async () => {
      const result = await service.getTeamCalendar(
        mockUserId,
        'MANAGER',
        mockDepartmentId,
        { year: 2026, month: 4 },
      );

      expect(prisma.department.findUnique).toHaveBeenCalledWith({
        where: { id: mockDepartmentId },
        select: { id: true, name: true },
      });
    });

    it('should throw FORBIDDEN when Manager tries to view other department', async () => {
      await expect(
        service.getTeamCalendar(mockUserId, 'MANAGER', mockDepartmentId, {
          year: 2026,
          month: 4,
          department_id: 'other-dept-id',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw FORBIDDEN for employee role', async () => {
      await expect(
        service.getTeamCalendar(mockUserId, 'EMPLOYEE', mockDepartmentId, {
          year: 2026,
          month: 4,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw INVALID_INPUT when department does not exist', async () => {
      prisma.department.findUnique.mockResolvedValue(null);

      try {
        await service.getTeamCalendar(mockUserId, 'ADMIN', mockDepartmentId, {
          year: 2026,
          month: 4,
          department_id: 'nonexistent-dept',
        });
        fail('should have thrown');
      } catch (e) {
        const exception = e as HttpException;
        expect(exception.getStatus()).toBe(HttpStatus.BAD_REQUEST);
        const response = exception.getResponse() as Record<string, string>;
        expect(response.code).toBe('INVALID_INPUT');
      }
    });

    it('should prioritize leave over absent when both leave and no clock', async () => {
      prisma.leaveRequest.findMany.mockResolvedValue([
        {
          id: 'leave-1',
          userId: 'user-1',
          leaveType: 'SICK',
          startDate: makeDateOnly(2026, 4, 1),
          endDate: makeDateOnly(2026, 4, 1),
          status: 'APPROVED',
        },
      ]);

      const result = await service.getTeamCalendar(
        mockUserId,
        'MANAGER',
        mockDepartmentId,
        { year: 2026, month: 4 },
      );

      const user1April1 = result.members[0].days.find(
        (d: TeamDay) => d.date === '2026-04-01',
      );
      expect(user1April1!.status).toBe('leave');
      expect(user1April1!.leave_type).toBe('sick');
    });
  });
});
