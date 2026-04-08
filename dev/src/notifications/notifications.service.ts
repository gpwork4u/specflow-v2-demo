import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { QueryNotificationsDto } from './dto/query-notifications.dto';
import { CreateNotificationParams } from './dto/create-notification.dto';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 建立通知（供其他 module 呼叫）
   */
  async createNotification(params: CreateNotificationParams) {
    const notification = await this.prisma.notification.create({
      data: {
        userId: params.userId,
        type: params.type,
        title: params.title,
        content: params.content,
        referenceType: params.referenceType || null,
        referenceId: params.referenceId || null,
      },
    });

    return notification;
  }

  /**
   * 查詢通知列表
   * GET /api/v1/notifications
   */
  async getNotifications(userId: string, query: QueryNotificationsDto) {
    const { page = 1, limit = 20 } = query;

    const where: Record<string, unknown> = { userId };

    if (query.is_read !== undefined) {
      where.isRead = query.is_read;
    }

    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notification.count({ where }),
    ]);

    return {
      data: notifications.map((n) => this.formatNotification(n)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * 取得未讀數量
   * GET /api/v1/notifications/unread-count
   */
  async getUnreadCount(userId: string) {
    const count = await this.prisma.notification.count({
      where: { userId, isRead: false },
    });

    return { count };
  }

  /**
   * 標記單則已讀
   * PUT /api/v1/notifications/:id/read
   */
  async markAsRead(notificationId: string, userId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });

    if (!notification) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: '通知不存在',
      });
    }

    const updated = await this.prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });

    return {
      id: updated.id,
      is_read: updated.isRead,
    };
  }

  /**
   * 全部標記已讀
   * PUT /api/v1/notifications/read-all
   */
  async markAllAsRead(userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });

    return {
      updated_count: result.count,
    };
  }

  // ── Private Methods ──

  private formatNotification(notification: {
    id: string;
    type: string;
    title: string;
    content: string;
    referenceType: string | null;
    referenceId: string | null;
    isRead: boolean;
    createdAt: Date;
  }) {
    return {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      content: notification.content,
      reference_type: notification.referenceType,
      reference_id: notification.referenceId,
      is_read: notification.isRead,
      created_at: notification.createdAt.toISOString(),
    };
  }
}
