"use client";

import {
  CheckCircle2,
  Clock,
  LogOut,
  XCircle,
  FileEdit,
  MinusCircle,
  Ban,
  Shield,
  UserCog,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";

type StatusType = "attendance" | "account" | "role";

interface StatusBadgeProps {
  type: StatusType;
  value: string;
  showIcon?: boolean;
}

const statusConfig = {
  attendance: {
    normal: {
      label: "正常",
      icon: CheckCircle2,
      className: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400",
    },
    late: {
      label: "遲到",
      icon: Clock,
      className: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
    },
    early_leave: {
      label: "早退",
      icon: LogOut,
      className: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400",
    },
    absent: {
      label: "缺席",
      icon: XCircle,
      className: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
    },
    amended: {
      label: "已補打卡",
      icon: FileEdit,
      className: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
    },
  },
  account: {
    active: {
      label: "啟用",
      icon: CheckCircle2,
      className: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400",
    },
    inactive: {
      label: "停用",
      icon: MinusCircle,
      className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
    },
    suspended: {
      label: "凍結",
      icon: Ban,
      className: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
    },
  },
  role: {
    admin: {
      label: "管理員",
      icon: Shield,
      className: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-400",
    },
    manager: {
      label: "主管",
      icon: UserCog,
      className: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
    },
    employee: {
      label: "員工",
      icon: User,
      className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
    },
  },
} as const;

export function StatusBadge({ type, value, showIcon = true }: StatusBadgeProps) {
  const typeConfig = statusConfig[type];
  const config = (typeConfig as Record<string, any>)?.[value];

  if (!config) return null;

  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        config.className
      )}
    >
      {showIcon && <Icon className="h-3 w-3" />}
      {config.label}
    </span>
  );
}
