import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { NotificationsService } from '../../src/notifications/notifications.service';
import { PrismaService } from '../../src/prisma/prisma.service';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prisma: {
    notification: {
      create: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
  };

  const mockNotification = {
    id: 'notif-uuid-1',
    userId: 'user-uuid-1',
    type: 'leave_approved',
    title: '請假已核准',
    content: '您的特休申請（2026/04/10 - 2026/04/11）已由 李大華 核准。',
    referenceType: 'leave_request',
    referenceId: 'leave-uuid-1',
    isRead: false,
    createdAt: new Date('2026-04-07T14:00:00.000Z'),
    updatedAt: new Date('2026-04-07T14:00:00.000Z'),
  };

  beforeEach(async () => {
    prisma = {
      notification: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ── createNotification ──

  describe('createNotification', () => {
    it('should create a notification successfully', async () => {
      prisma.notification.create.mockResolvedValue(mockNotification);

      const result = await service.createNotification({
        userId: 'user-uuid-1',
        type: 'leave_approved',
        title: '請假已核准',
        content: '您的特休申請（2026/04/10 - 2026/04/11）已由 李大華 核准。',
        referenceType: 'leave_request',
        referenceId: 'leave-uuid-1',
      });

      expect(result.id).toBe('notif-uuid-1');
      expect(result.type).toBe('leave_approved');
      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-uuid-1',
          type: 'leave_approved',
          title: '請假已核准',
          content: '您的特休申請（2026/04/10 - 2026/04/11）已由 李大華 核准。',
          referenceType: 'leave_request',
          referenceId: 'leave-uuid-1',
        },
      });
    });

    it('should create a notification without reference fields', async () => {
      const notifWithoutRef = {
        ...mockNotification,
        referenceType: null,
        referenceId: null,
        type: 'reminder_clock_in',
        title: '打卡提醒',
        content: '提醒：您今日尚未打上班卡。',
      };
      prisma.notification.create.mockResolvedValue(notifWithoutRef);

      const result = await service.createNotification({
        userId: 'user-uuid-1',
        type: 'reminder_clock_in',
        title: '打卡提醒',
        content: '提醒：您今日尚未打上班卡。',
      });

      expect(result.referenceType).toBeNull();
      expect(result.referenceId).toBeNull();
      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          referenceType: null,
          referenceId: null,
        }),
      });
    });
  });

  // ── getNotifications ──

  describe('getNotifications', () => {
    it('should return paginated notification list (Scenario: 查看通知列表)', async () => {
      const notifications = Array.from({ length: 10 }, (_, i) => ({
        ...mockNotification,
        id: `notif-uuid-${i + 1}`,
        isRead: i < 7, // 7 筆已讀，3 筆未讀
      }));

      prisma.notification.findMany.mockResolvedValue(notifications);
      prisma.notification.count.mockResolvedValue(10);

      const result = await service.getNotifications('user-uuid-1', {});

      expect(result.data).toHaveLength(10);
      expect(result.meta.total).toBe(10);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(20);
      expect(result.meta.totalPages).toBe(1);
    });

    it('should return notifications ordered by created_at descending', async () => {
      prisma.notification.findMany.mockResolvedValue([]);
      prisma.notification.count.mockResolvedValue(0);

      await service.getNotifications('user-uuid-1', {});

      expect(prisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
        }),
      );
    });

    it('should filter by is_read=false (Scenario: 篩選未讀通知)', async () => {
      const unreadNotifs = [
        { ...mockNotification, isRead: false },
        { ...mockNotification, id: 'notif-uuid-2', isRead: false },
        { ...mockNotification, id: 'notif-uuid-3', isRead: false },
      ];

      prisma.notification.findMany.mockResolvedValue(unreadNotifs);
      prisma.notification.count.mockResolvedValue(3);

      const result = await service.getNotifications('user-uuid-1', {
        is_read: false,
      });

      expect(result.data).toHaveLength(3);
      expect(prisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isRead: false }),
        }),
      );
    });

    it('should filter by is_read=true', async () => {
      prisma.notification.findMany.mockResolvedValue([]);
      prisma.notification.count.mockResolvedValue(0);

      await service.getNotifications('user-uuid-1', { is_read: true });

      expect(prisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isRead: true }),
        }),
      );
    });

    it('should support pagination', async () => {
      prisma.notification.findMany.mockResolvedValue([]);
      prisma.notification.count.mockResolvedValue(50);

      const result = await service.getNotifications('user-uuid-1', {
        page: 3,
        limit: 10,
      });

      expect(prisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20,
          take: 10,
        }),
      );
      expect(result.meta.totalPages).toBe(5);
      expect(result.meta.page).toBe(3);
    });

    it('should only return notifications for the current user', async () => {
      prisma.notification.findMany.mockResolvedValue([]);
      prisma.notification.count.mockResolvedValue(0);

      await service.getNotifications('user-uuid-1', {});

      expect(prisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: 'user-uuid-1' }),
        }),
      );
    });

    it('should format response with snake_case fields', async () => {
      prisma.notification.findMany.mockResolvedValue([mockNotification]);
      prisma.notification.count.mockResolvedValue(1);

      const result = await service.getNotifications('user-uuid-1', {});

      const item = result.data[0];
      expect(item).toHaveProperty('id');
      expect(item).toHaveProperty('type');
      expect(item).toHaveProperty('title');
      expect(item).toHaveProperty('content');
      expect(item).toHaveProperty('reference_type');
      expect(item).toHaveProperty('reference_id');
      expect(item).toHaveProperty('is_read');
      expect(item).toHaveProperty('created_at');
      // 不應包含 camelCase 欄位
      expect(item).not.toHaveProperty('referenceType');
      expect(item).not.toHaveProperty('referenceId');
      expect(item).not.toHaveProperty('isRead');
      expect(item).not.toHaveProperty('createdAt');
    });
  });

  // ── getUnreadCount ──

  describe('getUnreadCount', () => {
    it('should return unread count (Scenario: 查看未讀數量)', async () => {
      prisma.notification.count.mockResolvedValue(3);

      const result = await service.getUnreadCount('user-uuid-1');

      expect(result.count).toBe(3);
      expect(prisma.notification.count).toHaveBeenCalledWith({
        where: { userId: 'user-uuid-1', isRead: false },
      });
    });

    it('should return 0 when all notifications are read', async () => {
      prisma.notification.count.mockResolvedValue(0);

      const result = await service.getUnreadCount('user-uuid-1');

      expect(result.count).toBe(0);
    });
  });

  // ── markAsRead ──

  describe('markAsRead', () => {
    it('should mark a notification as read (Scenario: 標記單則已讀)', async () => {
      prisma.notification.findFirst.mockResolvedValue(mockNotification);
      prisma.notification.update.mockResolvedValue({
        ...mockNotification,
        isRead: true,
      });

      const result = await service.markAsRead('notif-uuid-1', 'user-uuid-1');

      expect(result.id).toBe('notif-uuid-1');
      expect(result.is_read).toBe(true);
      expect(prisma.notification.update).toHaveBeenCalledWith({
        where: { id: 'notif-uuid-1' },
        data: { isRead: true },
      });
    });

    it('should throw NOT_FOUND for nonexistent notification (Scenario: 標記不存在的通知)', async () => {
      prisma.notification.findFirst.mockResolvedValue(null);

      await expect(
        service.markAsRead('nonexistent-id', 'user-uuid-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NOT_FOUND when marking another user notification (Scenario: 標記他人的通知)', async () => {
      // findFirst with userId filter returns null for other user's notification
      prisma.notification.findFirst.mockResolvedValue(null);

      await expect(
        service.markAsRead('notif-uuid-1', 'other-user'),
      ).rejects.toThrow(NotFoundException);

      // 確認查詢條件包含 userId，不洩漏通知存在與否
      expect(prisma.notification.findFirst).toHaveBeenCalledWith({
        where: { id: 'notif-uuid-1', userId: 'other-user' },
      });
    });

    it('should succeed even if notification is already read', async () => {
      const readNotification = { ...mockNotification, isRead: true };
      prisma.notification.findFirst.mockResolvedValue(readNotification);
      prisma.notification.update.mockResolvedValue(readNotification);

      const result = await service.markAsRead('notif-uuid-1', 'user-uuid-1');

      expect(result.is_read).toBe(true);
    });
  });

  // ── markAllAsRead ──

  describe('markAllAsRead', () => {
    it('should mark all unread notifications as read (Scenario: 全部標記已讀)', async () => {
      prisma.notification.updateMany.mockResolvedValue({ count: 5 });

      const result = await service.markAllAsRead('user-uuid-1');

      expect(result.updated_count).toBe(5);
      expect(prisma.notification.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-uuid-1', isRead: false },
        data: { isRead: true },
      });
    });

    it('should return 0 when no unread notifications exist', async () => {
      prisma.notification.updateMany.mockResolvedValue({ count: 0 });

      const result = await service.markAllAsRead('user-uuid-1');

      expect(result.updated_count).toBe(0);
    });
  });
});
