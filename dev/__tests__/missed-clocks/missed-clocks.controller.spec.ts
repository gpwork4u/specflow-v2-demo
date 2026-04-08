import { Test, TestingModule } from '@nestjs/testing';
import { MissedClocksController } from '../../src/missed-clocks/missed-clocks.controller';
import { MissedClocksService } from '../../src/missed-clocks/missed-clocks.service';
import { Reflector } from '@nestjs/core';

describe('MissedClocksController', () => {
  let controller: MissedClocksController;
  let service: {
    create: jest.Mock;
    findAll: jest.Mock;
    findOne: jest.Mock;
    findPending: jest.Mock;
    approve: jest.Mock;
    reject: jest.Mock;
  };

  const mockUser = {
    userId: 'user-uuid-1',
    role: 'EMPLOYEE',
    departmentId: 'dept-uuid-1',
  };

  const mockManager = {
    userId: 'manager-uuid-1',
    role: 'MANAGER',
    departmentId: 'dept-uuid-1',
  };

  beforeEach(async () => {
    service = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      findPending: jest.fn(),
      approve: jest.fn(),
      reject: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MissedClocksController],
      providers: [
        { provide: MissedClocksService, useValue: service },
        Reflector,
      ],
    }).compile();

    controller = module.get<MissedClocksController>(MissedClocksController);
  });

  describe('create', () => {
    it('should call service.create with userId and dto', async () => {
      const dto = {
        date: '2026-04-06',
        clock_type: 'clock_in',
        requested_time: '2026-04-06T01:00:00Z',
        reason: '忘記打卡',
      };
      const expected = { id: 'req-1', status: 'pending' };
      service.create.mockResolvedValue(expected);

      const result = await controller.create(mockUser, dto);

      expect(service.create).toHaveBeenCalledWith(mockUser.userId, dto);
      expect(result).toEqual(expected);
    });
  });

  describe('findAll', () => {
    it('should call service.findAll with userId and query', async () => {
      const query = { status: 'pending' };
      const expected = { data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } };
      service.findAll.mockResolvedValue(expected);

      const result = await controller.findAll(mockUser, query);

      expect(service.findAll).toHaveBeenCalledWith(mockUser.userId, query);
      expect(result).toEqual(expected);
    });
  });

  describe('findOne', () => {
    it('should call service.findOne with id, userId, and role', async () => {
      const expected = { id: 'req-1', status: 'pending' };
      service.findOne.mockResolvedValue(expected);

      const result = await controller.findOne(mockUser, 'req-1');

      expect(service.findOne).toHaveBeenCalledWith(
        'req-1',
        mockUser.userId,
        mockUser.role,
      );
      expect(result).toEqual(expected);
    });
  });

  describe('findPending', () => {
    it('should call service.findPending with user and query', async () => {
      const query = {};
      const expected = { data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } };
      service.findPending.mockResolvedValue(expected);

      const result = await controller.findPending(mockManager, query);

      expect(service.findPending).toHaveBeenCalledWith(mockManager, query);
      expect(result).toEqual(expected);
    });
  });

  describe('approve', () => {
    it('should call service.approve with id, user, and comment', async () => {
      const expected = { id: 'req-1', status: 'approved' };
      service.approve.mockResolvedValue(expected);

      const result = await controller.approve('req-1', mockManager, {
        comment: '核准',
      });

      expect(service.approve).toHaveBeenCalledWith(
        'req-1',
        mockManager,
        '核准',
      );
      expect(result).toEqual(expected);
    });
  });

  describe('reject', () => {
    it('should call service.reject with id, user, and comment', async () => {
      const expected = { id: 'req-1', status: 'rejected' };
      service.reject.mockResolvedValue(expected);

      const result = await controller.reject('req-1', mockManager, {
        comment: '時間不合理',
      });

      expect(service.reject).toHaveBeenCalledWith(
        'req-1',
        mockManager,
        '時間不合理',
      );
      expect(result).toEqual(expected);
    });
  });
});
