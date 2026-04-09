"use client";

import {
  eachDayOfInterval,
  startOfMonth,
  endOfMonth,
  getDay,
  format,
  isToday,
} from "date-fns";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// --- Types ---

export interface TeamMemberDay {
  date: string;
  status: "normal" | "late" | "early_leave" | "absent" | "leave" | "holiday" | "overtime" | null;
  clock_in?: string | null;
  clock_out?: string | null;
  leave_type?: string | null;
}

export interface TeamMember {
  user_id: string;
  employee_id: string;
  name: string;
  days: TeamMemberDay[];
}

// --- Helpers ---

const statusColors: Record<string, { bg: string; label: string }> = {
  normal: { bg: "bg-green-500", label: "正常" },
  late: { bg: "bg-amber-500", label: "遲到" },
  early_leave: { bg: "bg-orange-500", label: "早退" },
  absent: { bg: "bg-red-500", label: "缺席" },
  leave: { bg: "bg-blue-500", label: "請假" },
  holiday: { bg: "bg-gray-300 dark:bg-gray-600", label: "假日" },
  overtime: { bg: "bg-purple-500", label: "加班" },
};

const WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"];

// --- Component ---

interface TeamCalendarGridProps {
  year: number;
  month: number;
  members: TeamMember[];
  isLoading?: boolean;
}

export function TeamCalendarGrid({
  year,
  month,
  members,
  isLoading = false,
}: TeamCalendarGridProps) {
  const firstDay = startOfMonth(new Date(year, month - 1));
  const lastDay = endOfMonth(firstDay);
  const allDays = eachDayOfInterval({ start: firstDay, end: lastDay });

  if (isLoading) {
    return (
      <div className="rounded-lg border bg-card p-4">
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (members.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
        暫無團隊成員資料
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b">
                <th className="sticky left-0 z-10 min-w-[120px] bg-card px-3 py-2 text-left font-medium text-muted-foreground">
                  成員
                </th>
                {allDays.map((date) => {
                  const dayOfWeek = getDay(date);
                  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                  const today = isToday(date);
                  return (
                    <th
                      key={date.toISOString()}
                      className={cn(
                        "min-w-[32px] px-0.5 py-2 text-center font-medium",
                        isWeekend
                          ? "text-muted-foreground/60"
                          : "text-muted-foreground",
                        today && "bg-primary/5"
                      )}
                    >
                      <div className="text-xs">{date.getDate()}</div>
                      <div className="text-[10px]">{WEEKDAY_LABELS[dayOfWeek]}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {members.map((member) => {
                const dayMap = new Map(member.days.map((d) => [d.date, d]));
                return (
                  <tr key={member.user_id} className="border-b last:border-b-0">
                    <td className="sticky left-0 z-10 bg-card px-3 py-2">
                      <div className="text-xs text-muted-foreground">{member.employee_id}</div>
                      <div className="font-medium">{member.name}</div>
                    </td>
                    {allDays.map((date) => {
                      const dateStr = format(date, "yyyy-MM-dd");
                      const dayData = dayMap.get(dateStr);
                      const status = dayData?.status;
                      const style = status ? statusColors[status] : null;
                      const today = isToday(date);

                      return (
                        <td
                          key={dateStr}
                          className={cn(
                            "px-0.5 py-2 text-center",
                            today && "bg-primary/5"
                          )}
                        >
                          {style ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div
                                  className={cn(
                                    "mx-auto h-5 w-5 rounded-sm",
                                    style.bg
                                  )}
                                  aria-label={`${member.name} ${format(date, "M/d")} ${style.label}`}
                                />
                              </TooltipTrigger>
                              <TooltipContent>
                                <div className="text-xs">
                                  <p className="font-medium">{member.name} - {format(date, "M/d")}</p>
                                  <p>{style.label}</p>
                                  {dayData?.clock_in && (
                                    <p>上班: {dayData.clock_in.slice(11, 16)}</p>
                                  )}
                                  {dayData?.clock_out && (
                                    <p>下班: {dayData.clock_out.slice(11, 16)}</p>
                                  )}
                                  {dayData?.leave_type && (
                                    <p>假別: {dayData.leave_type}</p>
                                  )}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <div className="mx-auto h-5 w-5" />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 border-t px-3 py-2">
          {Object.entries(statusColors).map(([key, style]) => (
            <div key={key} className="flex items-center gap-1">
              <span className={cn("h-3 w-3 rounded-sm", style.bg)} aria-hidden="true" />
              <span className="text-xs text-muted-foreground">{style.label}</span>
            </div>
          ))}
        </div>
      </div>
    </TooltipProvider>
  );
}
