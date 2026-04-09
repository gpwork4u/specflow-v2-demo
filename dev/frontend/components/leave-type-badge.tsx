"use client";

import { cn } from "@/lib/utils";
import { LEAVE_TYPES, getLeaveTypeColor, type LeaveType } from "@/lib/leave-types";

interface LeaveTypeBadgeProps {
  type: LeaveType;
  className?: string;
}

export function LeaveTypeBadge({ type, className }: LeaveTypeBadgeProps) {
  const label = LEAVE_TYPES[type] ?? type;
  const colorClass = getLeaveTypeColor(type);

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        colorClass,
        className
      )}
    >
      {label}
    </span>
  );
}
