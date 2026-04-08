import { Test, TestingModule } from '@nestjs/testing';
import { ClockController } from '../../src/clock/clock.controller';
import { ClockService } from '../../src/clock/clock.service';

describe('ClockController', () => {
  let controller: ClockController;
  let clockService: {
    clockIn: jest.Mock;
    clockOut: jest.Mock;
    getToday: jest.Mock;
    getRecords: jest.Mock;
  };

  const mockUser = {
    userId: 'user-uuid-1',
    role: 'EMPLOYEE',
    departmentId: 'dept-uuid-1',
  };

  beforeEach(async () => {
    clockService = {
      clockIn: jest.fn(),
      clockOut: jest.fn(),
      getToday: jest.fn(),
      getRecords: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ClockController],
      providers: [
        { provide: ClockService, useValue: clockService },
      ],
    }).compile();

    controller = module.get<ClockController>(ClockController);
  });

  describe('clockIn', () => {
    it('should call clockService.clockIn with userId and dto', async () => {
      const dto = { note: '外出開會' };
      const expected = {
        id: 'record-uuid-1',
        user_id: 'user-uuid-1',
        date: '2026-04-07',
        clock_in: '2026-04-07T01:00:00.000Z',
        clock_out: null,
        status: 'normal',
        note: '外出開會',
        created_at: '2026-04-07T01:00:00.000Z',
      };

      clockService.clockIn.mockResolvedValue(expected);

      const result = await controller.clockIn(mockUser, dto);

      expect(clockService.clockIn).toHaveBeenCalledWith('user-uuid-1', dto);
      expect(result).toEqual(expected);
    });
  });

  describe('clockOut', () => {
    it('should call clockService.clockOut with userId and dto', async () => {
      const dto = {};
      const expected = {
        id: 'record-uuid-1',
        user_id: 'user-uuid-1',
        date: '2026-04-07',
        clock_in: '2026-04-07T01:00:00.000Z',
        clock_out: '2026-04-07T10:00:00.000Z',
        status: 'normal',
        note: null,
        created_at: '2026-04-07T01:00:00.000Z',
        updated_at: '2026-04-07T10:00:00.000Z',
      };

      clockService.clockOut.mockResolvedValue(expected);

      const result = await controller.clockOut(mockUser, dto);

      expect(clockService.clockOut).toHaveBeenCalledWith('user-uuid-1', dto);
      expect(result).toEqual(expected);
    });
  });

  describe('getToday', () => {
    it('should call clockService.getToday with userId', async () => {
      const expected = {
        id: 'record-uuid-1',
        date: '2026-04-07',
        clock_in: '2026-04-07T01:00:00.000Z',
        clock_out: null,
        status: 'late',
        note: null,
      };

      clockService.getToday.mockResolvedValue(expected);

      const result = await controller.getToday(mockUser);

      expect(clockService.getToday).toHaveBeenCalledWith('user-uuid-1');
      expect(result).toEqual(expected);
    });
  });

  describe('getRecords', () => {
    it('should call clockService.getRecords with userId and query', async () => {
      const query = {
        start_date: '2026-03-01',
        end_date: '2026-03-31',
        page: 1,
        limit: 20,
      };
      const expected = {
        data: [],
        meta: { total: 0, page: 1, limit: 20, totalPages: 0 },
      };

      clockService.getRecords.mockResolvedValue(expected);

      const result = await controller.getRecords(mockUser, query);

      expect(clockService.getRecords).toHaveBeenCalledWith('user-uuid-1', query);
      expect(result).toEqual(expected);
    });
  });
});
