"use client";

import { cn } from "@/lib/utils";
import type { LeaveQuota } from "@/lib/leave-types";

interface QuotaProgressBarProps {
  quota: LeaveQuota;
  className?: string;
}

export function QuotaProgressBar({ quota, className }: QuotaProgressBarProps) {
  const percentage =
    quota.total_hours > 0
      ? Math.min((quota.used_hours / quota.total_hours) * 100, 100)
      : 0;

  const remainingDays = quota.remaining_hours / 8;
  const totalDays = quota.total_hours / 8;
  const usedDays = quota.used_hours / 8;

  const isLow = percentage >= 80;
  const isEmpty = percentage >= 100;

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{quota.leave_type_label}</span>
        <span className="text-muted-foreground">
          {isEmpty ? (
            <span className="text-destructive">額度已用完</span>
          ) : (
            <>
              剩餘 {remainingDays % 1 === 0 ? remainingDays : remainingDays.toFixed(1)} 天
              <span className="text-xs">
                {" "}
                ({usedDays % 1 === 0 ? usedDays : usedDays.toFixed(1)} / {totalDays % 1 === 0 ? totalDays : totalDays.toFixed(1)} 天)
              </span>
            </>
          )}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            isEmpty
              ? "bg-destructive"
              : isLow
                ? "bg-amber-500"
                : "bg-primary"
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
