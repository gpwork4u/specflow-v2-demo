"use client";

import {
  startOfMonth,
  endOfMonth,
  getDay,
  eachDayOfInterval,
  isToday,
  format,
} from "date-fns";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

// --- Types ---

export interface CalendarDay {
  date: string; // "2026-04-01"
  is_workday: boolean;
  clock: {
    clock_in: string | null;
    clock_out: string | null;
    status: "normal" | "late" | "early_leave" | "absent" | "amended";
  } | null;
  leaves: {
    id: string;
    leave_type: string;
    start_half: "full" | "morning" | "afternoon";
    end_half: "full" | "morning" | "afternoon";
    status: "approved" | "pending" | "rejected" | "cancelled";
  }[];
  overtime: {
    id: string;
    hours: number;
    status: string;
  } | null;
}

export type DayCellStatus =
  | "present"
  | "late"
  | "early_leave"
  | "leave"
  | "absent"
  | "holiday"
  | "overtime"
  | "half_leave"
  | "future"
  | null;

// --- Helpers ---

export function deriveDayCellStatus(day: CalendarDay): DayCellStatus {
  const today = new Date().toISOString().slice(0, 10);

  if (!day.is_workday && !day.overtime) return "holiday";
  if (day.date > today) return "future";
  if (!day.is_workday && day.overtime) return "overtime";

  const approvedLeaves = day.leaves.filter((l) => l.status === "approved");
  const hasFullDayLeave = approvedLeaves.some((l) => l.start_half === "full");
  if (hasFullDayLeave) return "leave";

  const hasHalfLeave = approvedLeaves.length > 0;
  if (hasHalfLeave && day.clock) return "half_leave";
  if (hasHalfLeave && !day.clock) return "leave";

  if (day.clock) {
    const s = day.clock.status;
    if (s === "normal" || s === "amended") return "present";
    if (s === "late") return "late";
    if (s === "early_leave") return "early_leave";
    if (s === "absent") return "absent";
    return "present";
  }

  if (day.is_workday && day.date <= today) return "absent";

  return null;
}

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

const statusStyles: Record<string, { bg: string; dot: string; label: string }> = {
  present: {
    bg: "bg-green-50 dark:bg-green-950/30",
    dot: "bg-green-500 dark:bg-green-400",
    label: "正常",
  },
  late: {
    bg: "bg-amber-50 dark:bg-amber-950/30",
    dot: "bg-amber-500 dark:bg-amber-400",
    label: "遲到",
  },
  early_leave: {
    bg: "bg-orange-50 dark:bg-orange-950/30",
    dot: "bg-orange-500 dark:bg-orange-400",
    label: "早退",
  },
  leave: {
    bg: "bg-blue-50 dark:bg-blue-950/30",
    dot: "bg-blue-500 dark:bg-blue-400",
    label: "請假",
  },
  absent: {
    bg: "bg-red-50 dark:bg-red-950/30",
    dot: "bg-red-500 dark:bg-red-400",
    label: "缺席",
  },
  holiday: {
    bg: "bg-gray-50 dark:bg-gray-900/30",
    dot: "",
    label: "",
  },
  overtime: {
    bg: "bg-purple-50 dark:bg-purple-950/30",
    dot: "bg-purple-500 dark:bg-purple-400",
    label: "加班",
  },
  half_leave: {
    bg: "bg-blue-50 dark:bg-blue-950/20",
    dot: "bg-blue-400",
    label: "半假",
  },
};

// --- Component ---

interface CalendarMonthProps {
  year: number;
  month: number;
  days: CalendarDay[];
  onDayClick?: (day: CalendarDay) => void;
  isLoading?: boolean;
  selectedDate?: string;
}

export function CalendarMonth({
  year,
  month,
  days,
  onDayClick,
  isLoading = false,
  selectedDate,
}: CalendarMonthProps) {
  const dayMap = new Map(days.map((d) => [d.date, d]));
  const firstDay = startOfMonth(new Date(year, month - 1));
  const lastDay = endOfMonth(firstDay);
  const startOffset = getDay(firstDay);
  const allDays = eachDayOfInterval({ start: firstDay, end: lastDay });

  return (
    <div className="rounded-lg border bg-card">
      {/* Weekday header */}
      <div className="grid grid-cols-7 border-b">
        {WEEKDAYS.map((day, i) => (
          <div
            key={day}
            className={cn(
              "p-2 text-center text-xs font-medium text-muted-foreground",
              i === 0 && "text-destructive",
              i === 6 && "text-blue-500"
            )}
          >
            {day}
          </div>
        ))}
      </div>

      {/* Day grid */}
      {isLoading ? (
        <div className="grid grid-cols-7">
          {Array.from({ length: 35 }).map((_, i) => (
            <div key={i} className="min-h-[80px] border-b border-r p-1.5 lg:min-h-[100px]">
              <Skeleton className="h-full w-full rounded" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-7">
          {Array.from({ length: startOffset }).map((_, i) => (
            <div key={`empty-${i}`} className="min-h-[80px] border-b border-r lg:min-h-[100px]" />
          ))}
          {allDays.map((date) => {
            const dateStr = format(date, "yyyy-MM-dd");
            const dayData = dayMap.get(dateStr);
            const status = dayData ? deriveDayCellStatus(dayData) : null;
            const style = status ? statusStyles[status] : null;
            const isSelected = selectedDate === dateStr;
            const today = isToday(date);

            return (
              <button
                key={dateStr}
                type="button"
                className={cn(
                  "min-h-[80px] border-b border-r p-1.5 text-left transition-colors lg:min-h-[100px]",
                  "hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                  style?.bg,
                  isSelected && "ring-2 ring-primary ring-inset"
                )}
                onClick={() => dayData && onDayClick?.(dayData)}
                aria-label={`${format(date, "M月d日")}${style?.label ? ` ${style.label}` : ""}`}
                aria-pressed={isSelected}
              >
                <div className="flex items-start justify-between">
                  <span
                    className={cn(
                      "text-sm font-medium",
                      today &&
                        "flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground"
                    )}
                  >
                    {date.getDate()}
                  </span>
                  {style?.dot && (
                    <span
                      className={cn("mt-1 h-2 w-2 rounded-full", style.dot)}
                      aria-hidden="true"
                    />
                  )}
                </div>
                {style?.label && (
                  <span className="mt-1 hidden text-[10px] leading-tight text-muted-foreground lg:block">
                    {style.label}
                  </span>
                )}
                {dayData?.clock?.clock_in && (
                  <span className="mt-0.5 hidden text-[10px] leading-tight text-muted-foreground lg:block">
                    {dayData.clock.clock_in.slice(11, 16)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-3 border-t px-3 py-2">
        {Object.entries(statusStyles)
          .filter(([, v]) => v.label)
          .map(([key, style]) => (
            <div key={key} className="flex items-center gap-1">
              <span className={cn("h-2 w-2 rounded-full", style.dot)} aria-hidden="true" />
              <span className="text-xs text-muted-foreground">{style.label}</span>
            </div>
          ))}
      </div>
    </div>
  );
}
