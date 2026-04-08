import {
  Controller,
  Get,
  Put,
  Query,
  Param,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { QueryNotificationsDto } from './dto/query-notifications.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserData } from '../auth/decorators/current-user.decorator';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * 查詢通知列表
   * GET /api/v1/notifications
   */
  @Get()
  async getNotifications(
    @CurrentUser() user: CurrentUserData,
    @Query() query: QueryNotificationsDto,
  ) {
    return this.notificationsService.getNotifications(user.userId, query);
  }

  /**
   * 取得未讀數量
   * GET /api/v1/notifications/unread-count
   */
  @Get('unread-count')
  async getUnreadCount(@CurrentUser() user: CurrentUserData) {
    return this.notificationsService.getUnreadCount(user.userId);
  }

  /**
   * 標記單則已讀
   * PUT /api/v1/notifications/:id/read
   */
  @Put(':id/read')
  async markAsRead(
    @CurrentUser() user: CurrentUserData,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.notificationsService.markAsRead(id, user.userId);
  }

  /**
   * 全部標記已讀
   * PUT /api/v1/notifications/read-all
   */
  @Put('read-all')
  async markAllAsRead(@CurrentUser() user: CurrentUserData) {
    return this.notificationsService.markAllAsRead(user.userId);
  }
}
