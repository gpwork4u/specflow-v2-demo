import { Test, TestingModule } from '@nestjs/testing';
import { LeavesController } from '../../src/leaves/leaves.controller';
import { LeavesService } from '../../src/leaves/leaves.service';
import { CurrentUserData } from '../../src/auth/decorators/current-user.decorator';

describe('LeavesController', () => {
  let controller: LeavesController;
  let leavesService: {
    createLeave: jest.Mock;
    getLeaves: jest.Mock;
    getLeaveById: jest.Mock;
    cancelLeave: jest.Mock;
  };

  const mockUser: CurrentUserData = {
    userId: 'user-uuid-1',
    role: 'EMPLOYEE',
    departmentId: 'dept-uuid-1',
  };

  const mockLeaveResponse = {
    id: 'leave-uuid-1',
    user_id: 'user-uuid-1',
    leave_type: 'annual',
    start_date: '2026-04-10',
    end_date: '2026-04-10',
    start_half: 'full',
    end_half: 'full',
    hours: 8,
    reason: '個人事務',
    status: 'pending',
    reviewer_id: null,
    reviewed_at: null,
    review_comment: null,
    created_at: '2026-04-07T10:00:00.000Z',
  };

  beforeEach(async () => {
    leavesService = {
      createLeave: jest.fn(),
      getLeaves: jest.fn(),
      getLeaveById: jest.fn(),
      cancelLeave: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [LeavesController],
      providers: [{ provide: LeavesService, useValue: leavesService }],
    }).compile();

    controller = module.get<LeavesController>(LeavesController);
  });

  describe('POST /leaves', () => {
    it('should call createLeave with user ID and DTO', async () => {
      leavesService.createLeave.mockResolvedValue(mockLeaveResponse);

      const dto = {
        leave_type: 'annual' as const,
        start_date: '2026-04-10',
        end_date: '2026-04-10',
        reason: '個人事務',
      };

      const result = await controller.createLeave(mockUser, dto as any);

      expect(leavesService.createLeave).toHaveBeenCalledWith('user-uuid-1', dto);
      expect(result.id).toBe('leave-uuid-1');
      expect(result.status).toBe('pending');
    });
  });

  describe('GET /leaves', () => {
    it('should call getLeaves with user ID and query', async () => {
      const mockResult = {
        data: [mockLeaveResponse],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      };
      leavesService.getLeaves.mockResolvedValue(mockResult);

      const query = { page: 1, limit: 20 };
      const result = await controller.getLeaves(mockUser, query as any);

      expect(leavesService.getLeaves).toHaveBeenCalledWith('user-uuid-1', query);
      expect(result.data).toHaveLength(1);
    });
  });

  describe('GET /leaves/:id', () => {
    it('should call getLeaveById with correct params', async () => {
      leavesService.getLeaveById.mockResolvedValue(mockLeaveResponse);

      const result = await controller.getLeaveById(mockUser, 'leave-uuid-1');

      expect(leavesService.getLeaveById).toHaveBeenCalledWith(
        'leave-uuid-1',
        'user-uuid-1',
        'EMPLOYEE',
        'dept-uuid-1',
      );
      expect(result.id).toBe('leave-uuid-1');
    });
  });

  describe('PUT /leaves/:id/cancel', () => {
    it('should call cancelLeave with correct params', async () => {
      const cancelResponse = {
        id: 'leave-uuid-1',
        status: 'cancelled',
        updated_at: '2026-04-07T11:00:00.000Z',
      };
      leavesService.cancelLeave.mockResolvedValue(cancelResponse);

      const result = await controller.cancelLeave(mockUser, 'leave-uuid-1');

      expect(leavesService.cancelLeave).toHaveBeenCalledWith(
        'leave-uuid-1',
        'user-uuid-1',
      );
      expect(result.status).toBe('cancelled');
    });
  });
});
