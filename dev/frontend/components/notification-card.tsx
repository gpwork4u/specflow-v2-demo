"use client";

import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Bell,
  Clock,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow, parseISO } from "date-fns";
import { zhTW } from "date-fns/locale";

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  reference_type?: string;
  reference_id?: string;
  created_at: string;
}

interface NotificationCardProps {
  notification: NotificationItem;
  onClick: (id: string) => void;
  compact?: boolean;
}

const typeIcons: Record<string, { icon: typeof Bell; className: string }> = {
  approved: {
    icon: CheckCircle2,
    className: "text-green-600 dark:text-green-400",
  },
  rejected: {
    icon: XCircle,
    className: "text-red-600 dark:text-red-400",
  },
  reminder: {
    icon: AlertTriangle,
    className: "text-amber-600 dark:text-amber-400",
  },
  request: {
    icon: FileText,
    className: "text-blue-600 dark:text-blue-400",
  },
  default: {
    icon: Bell,
    className: "text-muted-foreground",
  },
};

function getIconConfig(type: string) {
  if (type.includes("approved")) return typeIcons.approved;
  if (type.includes("rejected")) return typeIcons.rejected;
  if (type.startsWith("reminder_")) return typeIcons.reminder;
  if (type.startsWith("new_")) return typeIcons.request;
  return typeIcons.default;
}

export function NotificationCard({
  notification,
  onClick,
  compact = false,
}: NotificationCardProps) {
  const { icon: Icon, className: iconClass } = getIconConfig(
    notification.type
  );

  const timeAgo = formatDistanceToNow(parseISO(notification.created_at), {
    addSuffix: true,
    locale: zhTW,
  });

  return (
    <button
      type="button"
      className={cn(
        "flex w-full items-start gap-3 text-left transition-colors hover:bg-muted/50",
        compact ? "px-4 py-3" : "px-4 py-4",
        !notification.is_read && "bg-primary/5"
      )}
      onClick={() => onClick(notification.id)}
    >
      {/* Unread indicator */}
      <div className="flex shrink-0 items-center pt-1">
        {!notification.is_read && (
          <span className="mr-1.5 h-2 w-2 rounded-full bg-primary" />
        )}
        <Icon className={cn("h-4 w-4", iconClass)} />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p
            className={cn(
              "text-sm",
              !notification.is_read ? "font-semibold" : "font-medium"
            )}
          >
            {notification.title}
          </p>
          <span className="shrink-0 text-xs text-muted-foreground">
            {timeAgo}
          </span>
        </div>
        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
          {notification.message}
        </p>
      </div>
    </button>
  );
}
