"use client";

import {
  Clock,
  CheckCircle2,
  XCircle,
  Ban,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LEAVE_STATUS, getLeaveStatusColor, type LeaveStatus } from "@/lib/leave-types";

const statusIcons: Record<LeaveStatus, typeof Clock> = {
  pending: Clock,
  approved: CheckCircle2,
  rejected: XCircle,
  cancelled: Ban,
};

interface LeaveStatusBadgeProps {
  status: LeaveStatus;
  showIcon?: boolean;
  className?: string;
}

export function LeaveStatusBadge({
  status,
  showIcon = true,
  className,
}: LeaveStatusBadgeProps) {
  const label = LEAVE_STATUS[status] ?? status;
  const colorClass = getLeaveStatusColor(status);
  const Icon = statusIcons[status];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        colorClass,
        className
      )}
    >
      {showIcon && Icon && <Icon className="h-3 w-3" />}
      {label}
    </span>
  );
}
