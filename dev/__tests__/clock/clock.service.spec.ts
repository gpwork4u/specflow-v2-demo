import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { ClockService } from '../../src/clock/clock.service';
import { PrismaService } from '../../src/prisma/prisma.service';

describe('ClockService', () => {
  let service: ClockService;
  let prisma: {
    clockRecord: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      count: jest.Mock;
    };
  };

  const mockUserId = 'user-uuid-1';

  /**
   * 建立指定 UTC+8 時間的 Date 物件
   * 例如 makeUTC8Date(2026, 4, 7, 8, 55) => UTC+8 08:55 => UTC 00:55
   */
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

  /**
   * 建立日期物件（UTC 00:00:00），用於 date 欄位
   */
  function makeDateOnly(year: number, month: number, day: number): Date {
    return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  }

  beforeEach(async () => {
    prisma = {
      clockRecord: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClockService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<ClockService>(ClockService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('clockIn', () => {
    it('should create a clock-in record successfully when no record exists today', async () => {
      // UTC+8 08:55 => UTC 00:55
      const now = makeUTC8Date(2026, 4, 7, 8, 55);
      jest.spyOn(global, 'Date').mockImplementation(
        (((...args: unknown[]) => {
          if (args.length === 0) return now;
          // @ts-expect-error - date constructor overloads
          return new (Function.prototype.bind.apply(OriginalDate, [null, ...args]))();
        }) as unknown) as DateConstructor,
      );
      const OriginalDate = global.Date;
      // Restore Date for internal usage
      jest.restoreAllMocks();

      // Use a simpler approach: mock Date.now()
      jest.spyOn(Date, 'now').mockReturnValue(now.getTime());

      prisma.clockRecord.findUnique.mockResolvedValue(null);

      const mockRecord = {
        id: 'record-uuid-1',
        userId: mockUserId,
        date: makeDateOnly(2026, 4, 7),
        clockIn: now,
        clockOut: null,
        status: 'NORMAL',
        note: null,
        createdAt: now,
        updatedAt: now,
      };
      prisma.clockRecord.create.mockResolvedValue(mockRecord);

      const result = await service.clockIn(mockUserId, {});

      expect(prisma.clockRecord.findUnique).toHaveBeenCalled();
      expect(prisma.clockRecord.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: mockUserId,
          status: 'NORMAL',
          note: null,
        }),
      });
      expect(result.id).toBe('record-uuid-1');
      expect(result.user_id).toBe(mockUserId);
      expect(result.clock_out).toBeNull();
      expect(result.status).toBe('normal');
    });

    it('should throw ALREADY_CLOCKED_IN when a record exists for today', async () => {
      const now = makeUTC8Date(2026, 4, 7, 9, 30);
      jest.spyOn(Date, 'now').mockReturnValue(now.getTime());

      prisma.clockRecord.findUnique.mockResolvedValue({
        id: 'existing-record',
        userId: mockUserId,
        date: makeDateOnly(2026, 4, 7),
        clockIn: makeUTC8Date(2026, 4, 7, 9, 0),
        clockOut: null,
        status: 'NORMAL',
      });

      await expect(service.clockIn(mockUserId, {})).rejects.toThrow(HttpException);

      try {
        await service.clockIn(mockUserId, {});
      } catch (e) {
        const exception = e as HttpException;
        expect(exception.getStatus()).toBe(HttpStatus.CONFLICT);
        const response = exception.getResponse() as Record<string, string>;
        expect(response.code).toBe('ALREADY_CLOCKED_IN');
      }
    });

    it('should set status to LATE when clocking in after 09:00 UTC+8', async () => {
      // UTC+8 09:05 => UTC 01:05
      const now = makeUTC8Date(2026, 4, 7, 9, 5);
      jest.spyOn(Date, 'now').mockReturnValue(now.getTime());

      prisma.clockRecord.findUnique.mockResolvedValue(null);

      const mockRecord = {
        id: 'record-uuid-2',
        userId: mockUserId,
        date: makeDateOnly(2026, 4, 7),
        clockIn: now,
        clockOut: null,
        status: 'LATE',
        note: null,
        createdAt: now,
        updatedAt: now,
      };
      prisma.clockRecord.create.mockResolvedValue(mockRecord);

      const result = await service.clockIn(mockUserId, {});

      expect(prisma.clockRecord.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          status: 'LATE',
        }),
      });
      expect(result.status).toBe('late');
    });

    it('should set status to NORMAL when clocking in at exactly 09:00 UTC+8', async () => {
      const now = makeUTC8Date(2026, 4, 7, 9, 0);
      jest.spyOn(Date, 'now').mockReturnValue(now.getTime());

      prisma.clockRecord.findUnique.mockResolvedValue(null);

      const mockRecord = {
        id: 'record-uuid-3',
        userId: mockUserId,
        date: makeDateOnly(2026, 4, 7),
        clockIn: now,
        clockOut: null,
        status: 'NORMAL',
        note: null,
        createdAt: now,
        updatedAt: now,
      };
      prisma.clockRecord.create.mockResolvedValue(mockRecord);

      const result = await service.clockIn(mockUserId, {});

      expect(prisma.clockRecord.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          status: 'NORMAL',
        }),
      });
      expect(result.status).toBe('normal');
    });

    it('should save note when provided', async () => {
      const now = makeUTC8Date(2026, 4, 7, 9, 10);
      jest.spyOn(Date, 'now').mockReturnValue(now.getTime());

      prisma.clockRecord.findUnique.mockResolvedValue(null);

      const mockRecord = {
        id: 'record-uuid-4',
        userId: mockUserId,
        date: makeDateOnly(2026, 4, 7),
        clockIn: now,
        clockOut: null,
        status: 'LATE',
        note: '外出開會晚到',
        createdAt: now,
        updatedAt: now,
      };
      prisma.clockRecord.create.mockResolvedValue(mockRecord);

      const result = await service.clockIn(mockUserId, {
        note: '外出開會晚到',
      });

      expect(prisma.clockRecord.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          note: '外出開會晚到',
        }),
      });
      expect(result.note).toBe('外出開會晚到');
    });
  });

  describe('clockOut', () => {
    it('should update clock-out record successfully', async () => {
      const clockInTime = makeUTC8Date(2026, 4, 7, 8, 55);
      const clockOutTime = makeUTC8Date(2026, 4, 7, 18, 30);
      jest.spyOn(Date, 'now').mockReturnValue(clockOutTime.getTime());

      const existingRecord = {
        id: 'record-uuid-1',
        userId: mockUserId,
        date: makeDateOnly(2026, 4, 7),
        clockIn: clockInTime,
        clockOut: null,
        status: 'NORMAL',
        note: null,
        createdAt: clockInTime,
        updatedAt: clockInTime,
      };

      // findUnique for today returns open record
      prisma.clockRecord.findUnique.mockResolvedValue(existingRecord);

      const updatedRecord = {
        ...existingRecord,
        clockOut: clockOutTime,
        status: 'NORMAL',
        updatedAt: clockOutTime,
      };
      prisma.clockRecord.update.mockResolvedValue(updatedRecord);

      const result = await service.clockOut(mockUserId, {});

      expect(prisma.clockRecord.update).toHaveBeenCalledWith({
        where: { id: 'record-uuid-1' },
        data: expect.objectContaining({
          status: 'NORMAL',
        }),
      });
      expect(result.clock_out).toBeTruthy();
      expect(result.status).toBe('normal');
    });

    it('should set status to EARLY_LEAVE when clocking out before 18:00 UTC+8', async () => {
      const clockInTime = makeUTC8Date(2026, 4, 7, 8, 50);
      const clockOutTime = makeUTC8Date(2026, 4, 7, 17, 0);
      jest.spyOn(Date, 'now').mockReturnValue(clockOutTime.getTime());

      const existingRecord = {
        id: 'record-uuid-1',
        userId: mockUserId,
        date: makeDateOnly(2026, 4, 7),
        clockIn: clockInTime,
        clockOut: null,
        status: 'NORMAL',
        note: null,
        createdAt: clockInTime,
        updatedAt: clockInTime,
      };

      prisma.clockRecord.findUnique.mockResolvedValue(existingRecord);

      const updatedRecord = {
        ...existingRecord,
        clockOut: clockOutTime,
        status: 'EARLY_LEAVE',
        updatedAt: clockOutTime,
      };
      prisma.clockRecord.update.mockResolvedValue(updatedRecord);

      const result = await service.clockOut(mockUserId, {});

      expect(prisma.clockRecord.update).toHaveBeenCalledWith({
        where: { id: 'record-uuid-1' },
        data: expect.objectContaining({
          status: 'EARLY_LEAVE',
        }),
      });
      expect(result.status).toBe('early_leave');
    });

    it('should keep LATE status when both late and early leave', async () => {
      const clockInTime = makeUTC8Date(2026, 4, 7, 9, 30);
      const clockOutTime = makeUTC8Date(2026, 4, 7, 17, 0);
      jest.spyOn(Date, 'now').mockReturnValue(clockOutTime.getTime());

      const existingRecord = {
        id: 'record-uuid-1',
        userId: mockUserId,
        date: makeDateOnly(2026, 4, 7),
        clockIn: clockInTime,
        clockOut: null,
        status: 'LATE',
        note: null,
        createdAt: clockInTime,
        updatedAt: clockInTime,
      };

      prisma.clockRecord.findUnique.mockResolvedValue(existingRecord);

      const updatedRecord = {
        ...existingRecord,
        clockOut: clockOutTime,
        status: 'LATE',
        updatedAt: clockOutTime,
      };
      prisma.clockRecord.update.mockResolvedValue(updatedRecord);

      const result = await service.clockOut(mockUserId, {});

      expect(prisma.clockRecord.update).toHaveBeenCalledWith({
        where: { id: 'record-uuid-1' },
        data: expect.objectContaining({
          status: 'LATE',
        }),
      });
      expect(result.status).toBe('late');
    });

    it('should throw NOT_CLOCKED_IN when no clock-in record exists', async () => {
      const now = makeUTC8Date(2026, 4, 7, 18, 0);
      jest.spyOn(Date, 'now').mockReturnValue(now.getTime());

      // No record for today or yesterday
      prisma.clockRecord.findUnique.mockResolvedValue(null);

      await expect(service.clockOut(mockUserId, {})).rejects.toThrow(HttpException);

      try {
        await service.clockOut(mockUserId, {});
      } catch (e) {
        const exception = e as HttpException;
        expect(exception.getStatus()).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
        const response = exception.getResponse() as Record<string, string>;
        expect(response.code).toBe('NOT_CLOCKED_IN');
      }
    });

    it('should throw ALREADY_CLOCKED_OUT when clock-out already exists', async () => {
      const clockInTime = makeUTC8Date(2026, 4, 7, 8, 55);
      const clockOutTime = makeUTC8Date(2026, 4, 7, 18, 5);
      const now = makeUTC8Date(2026, 4, 7, 19, 0);
      jest.spyOn(Date, 'now').mockReturnValue(now.getTime());

      const existingRecord = {
        id: 'record-uuid-1',
        userId: mockUserId,
        date: makeDateOnly(2026, 4, 7),
        clockIn: clockInTime,
        clockOut: clockOutTime,
        status: 'NORMAL',
        note: null,
        createdAt: clockInTime,
        updatedAt: clockOutTime,
      };

      // Today's record exists but has clock_out (findUnique returns it)
      prisma.clockRecord.findUnique.mockResolvedValue(existingRecord);

      await expect(service.clockOut(mockUserId, {})).rejects.toThrow(HttpException);

      try {
        await service.clockOut(mockUserId, {});
      } catch (e) {
        const exception = e as HttpException;
        expect(exception.getStatus()).toBe(HttpStatus.CONFLICT);
        const response = exception.getResponse() as Record<string, string>;
        expect(response.code).toBe('ALREADY_CLOCKED_OUT');
      }
    });

    it('should handle cross-day clock-out (past midnight)', async () => {
      const clockInTime = makeUTC8Date(2026, 4, 7, 22, 0);
      // Next day 01:30 UTC+8
      const clockOutTime = makeUTC8Date(2026, 4, 8, 1, 30);
      jest.spyOn(Date, 'now').mockReturnValue(clockOutTime.getTime());

      const existingRecord = {
        id: 'record-uuid-1',
        userId: mockUserId,
        date: makeDateOnly(2026, 4, 7),
        clockIn: clockInTime,
        clockOut: null,
        status: 'NORMAL',
        note: null,
        createdAt: clockInTime,
        updatedAt: clockInTime,
      };

      // First call (today 4/8) returns null, second call (yesterday 4/7) returns open record
      prisma.clockRecord.findUnique
        .mockResolvedValueOnce(null) // today (4/8) no record
        .mockResolvedValueOnce(existingRecord); // yesterday (4/7) open record

      const updatedRecord = {
        ...existingRecord,
        clockOut: clockOutTime,
        status: 'NORMAL',
        updatedAt: clockOutTime,
      };
      prisma.clockRecord.update.mockResolvedValue(updatedRecord);

      const result = await service.clockOut(mockUserId, {});

      // date should still be 2026-04-07 (original clock-in date)
      expect(result.date).toBe('2026-04-07');
      expect(result.clock_out).toBeTruthy();
    });
  });

  describe('getToday', () => {
    it('should return today clock record when exists', async () => {
      const clockInTime = makeUTC8Date(2026, 4, 7, 9, 5);
      const now = makeUTC8Date(2026, 4, 7, 12, 0);
      jest.spyOn(Date, 'now').mockReturnValue(now.getTime());

      const record = {
        id: 'record-uuid-1',
        userId: mockUserId,
        date: makeDateOnly(2026, 4, 7),
        clockIn: clockInTime,
        clockOut: null,
        status: 'LATE',
        note: null,
        createdAt: clockInTime,
        updatedAt: clockInTime,
      };

      prisma.clockRecord.findUnique.mockResolvedValue(record);

      const result = await service.getToday(mockUserId);

      expect(result.id).toBe('record-uuid-1');
      expect(result.clock_in).toBeTruthy();
      expect(result.clock_out).toBeNull();
      expect(result.status).toBe('late');
    });

    it('should return null fields when no record exists today', async () => {
      const now = makeUTC8Date(2026, 4, 7, 8, 0);
      jest.spyOn(Date, 'now').mockReturnValue(now.getTime());

      prisma.clockRecord.findUnique.mockResolvedValue(null);

      const result = await service.getToday(mockUserId);

      expect(result.id).toBeNull();
      expect(result.date).toBe('2026-04-07');
      expect(result.clock_in).toBeNull();
      expect(result.clock_out).toBeNull();
      expect(result.status).toBeNull();
      expect(result.note).toBeNull();
    });
  });

  describe('getRecords', () => {
    it('should return paginated records', async () => {
      const records = [
        {
          id: 'record-1',
          userId: mockUserId,
          date: makeDateOnly(2026, 3, 15),
          clockIn: makeUTC8Date(2026, 3, 15, 8, 50),
          clockOut: makeUTC8Date(2026, 3, 15, 18, 10),
          status: 'NORMAL',
          note: null,
          createdAt: makeUTC8Date(2026, 3, 15, 8, 50),
          updatedAt: makeUTC8Date(2026, 3, 15, 18, 10),
        },
      ];

      prisma.clockRecord.findMany.mockResolvedValue(records);
      prisma.clockRecord.count.mockResolvedValue(22);

      const result = await service.getRecords(mockUserId, {
        start_date: '2026-03-01',
        end_date: '2026-03-31',
        page: 1,
        limit: 20,
      });

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(22);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(20);
      expect(result.meta.totalPages).toBe(2);
    });

    it('should throw INVALID_INPUT when date range exceeds 90 days', async () => {
      await expect(
        service.getRecords(mockUserId, {
          start_date: '2026-01-01',
          end_date: '2026-06-30',
          page: 1,
          limit: 20,
        }),
      ).rejects.toThrow(HttpException);

      try {
        await service.getRecords(mockUserId, {
          start_date: '2026-01-01',
          end_date: '2026-06-30',
          page: 1,
          limit: 20,
        });
      } catch (e) {
        const exception = e as HttpException;
        expect(exception.getStatus()).toBe(HttpStatus.BAD_REQUEST);
        const response = exception.getResponse() as Record<string, string>;
        expect(response.code).toBe('INVALID_INPUT');
        expect(response.message).toContain('90');
      }
    });

    it('should throw INVALID_INPUT when end_date is before start_date', async () => {
      await expect(
        service.getRecords(mockUserId, {
          start_date: '2026-04-10',
          end_date: '2026-04-01',
          page: 1,
          limit: 20,
        }),
      ).rejects.toThrow(HttpException);

      try {
        await service.getRecords(mockUserId, {
          start_date: '2026-04-10',
          end_date: '2026-04-01',
          page: 1,
          limit: 20,
        });
      } catch (e) {
        const exception = e as HttpException;
        expect(exception.getStatus()).toBe(HttpStatus.BAD_REQUEST);
        const response = exception.getResponse() as Record<string, string>;
        expect(response.code).toBe('INVALID_INPUT');
      }
    });

    it('should use default page=1 and limit=20 when not specified', async () => {
      prisma.clockRecord.findMany.mockResolvedValue([]);
      prisma.clockRecord.count.mockResolvedValue(0);

      const result = await service.getRecords(mockUserId, {
        start_date: '2026-04-01',
        end_date: '2026-04-07',
      });

      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(20);
      expect(result.meta.totalPages).toBe(0);
    });
  });
});
