"use client";

import { Bell } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import {
  NotificationCard,
  type NotificationItem,
} from "@/components/notification-card";

interface NotificationBellProps {
  unreadCount: number;
  notifications: NotificationItem[];
  onNotificationClick: (id: string) => void;
  onMarkAllRead: () => void;
  onViewAll: () => void;
}

export function NotificationBell({
  unreadCount,
  notifications,
  onNotificationClick,
  onMarkAllRead,
  onViewAll,
}: NotificationBellProps) {
  const displayCount = unreadCount > 99 ? "99+" : unreadCount;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={`通知${unreadCount > 0 ? `，${unreadCount} 則未讀` : ""}`}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span
              className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-xs font-medium text-destructive-foreground"
              aria-hidden="true"
            >
              {displayCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[380px] p-0" align="end" sideOffset={8}>
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="text-sm font-semibold">通知</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-primary"
              onClick={onMarkAllRead}
            >
              全部標為已讀
            </Button>
          )}
        </div>

        {/* Notification list */}
        <div className="max-h-[400px] divide-y overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Bell className="mb-2 h-8 w-8 opacity-30" />
              <p className="text-sm">目前沒有通知</p>
            </div>
          ) : (
            notifications.map((n) => (
              <NotificationCard
                key={n.id}
                notification={n}
                onClick={onNotificationClick}
                compact
              />
            ))
          )}
        </div>

        {/* View all */}
        {notifications.length > 0 && (
          <button
            type="button"
            className="block w-full border-t px-4 py-3 text-center text-sm text-primary transition-colors hover:bg-muted"
            onClick={onViewAll}
          >
            查看所有通知
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}
