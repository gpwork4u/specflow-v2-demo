"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout";
import { PageHeader } from "@/components/layout";
import { MonthPicker } from "@/components/month-picker";
import { CalendarMonth, type CalendarDay } from "@/components/calendar-month";
import { StatusBadge } from "@/components/status-badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { format } from "date-fns";
import { zhTW } from "date-fns/locale";
import api from "@/lib/api";

const leaveTypeLabels: Record<string, string> = {
  annual: "特休",
  personal: "事假",
  sick: "病假",
  marriage: "婚假",
  bereavement: "喪假",
  maternity: "產假",
  paternity: "陪產假",
  official: "公假",
};

const leaveStatusLabels: Record<string, string> = {
  approved: "已核准",
  pending: "待審核",
  rejected: "已駁回",
  cancelled: "已取消",
};

export default function PersonalCalendarPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["calendar", "personal", year, month],
    queryFn: async () => {
      const res = await api.get("/calendar/personal", {
        params: { year, month },
      });
      return res.data as { days: CalendarDay[] };
    },
  });

  const handleMonthChange = (y: number, m: number) => {
    setYear(y);
    setMonth(m);
    setSelectedDay(null);
  };

  return (
    <AppLayout
      breadcrumbs={[
        { label: "行事曆", href: "/calendar" },
        { label: "個人行事曆" },
      ]}
    >
      <PageHeader
        title="個人行事曆"
        description="查看您的月出勤、請假、加班紀錄"
      />

      <div className="mb-4">
        <MonthPicker year={year} month={month} onChange={handleMonthChange} />
      </div>

      <CalendarMonth
        year={year}
        month={month}
        days={data?.days ?? []}
        isLoading={isLoading}
        selectedDate={selectedDay?.date}
        onDayClick={(day) => setSelectedDay(day)}
      />

      {/* Day detail sheet */}
      <Sheet
        open={!!selectedDay}
        onOpenChange={(open) => !open && setSelectedDay(null)}
      >
        <SheetContent>
          <SheetHeader>
            <SheetTitle>
              {selectedDay &&
                format(new Date(selectedDay.date), "yyyy年M月d日 EEEE", {
                  locale: zhTW,
                })}
            </SheetTitle>
          </SheetHeader>

          {selectedDay && (
            <div className="mt-6 space-y-6">
              {/* Clock record */}
              {selectedDay.clock && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">打卡紀錄</h4>
                  <div className="rounded-lg border p-3 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">上班</span>
                      <span>
                        {selectedDay.clock.clock_in
                          ? selectedDay.clock.clock_in.slice(11, 19)
                          : "--:--:--"}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">下班</span>
                      <span>
                        {selectedDay.clock.clock_out
                          ? selectedDay.clock.clock_out.slice(11, 19)
                          : "--:--:--"}
                      </span>
                    </div>
                    <div className="pt-1">
                      <StatusBadge
                        type="attendance"
                        value={selectedDay.clock.status}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Leave records */}
              {selectedDay.leaves.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">請假紀錄</h4>
                  {selectedDay.leaves.map((leave) => (
                    <div
                      key={leave.id}
                      className="flex items-center justify-between rounded-lg border p-3 text-sm"
                    >
                      <span>
                        {leaveTypeLabels[leave.leave_type] || leave.leave_type}
                      </span>
                      <span
                        className={
                          leave.status === "approved"
                            ? "text-green-600"
                            : leave.status === "rejected"
                              ? "text-red-600"
                              : "text-muted-foreground"
                        }
                      >
                        {leaveStatusLabels[leave.status] || leave.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Overtime */}
              {selectedDay.overtime && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">加班紀錄</h4>
                  <div className="rounded-lg border p-3 text-sm">
                    <span>{selectedDay.overtime.hours} 小時</span>
                  </div>
                </div>
              )}

              {/* No records */}
              {!selectedDay.clock &&
                selectedDay.leaves.length === 0 &&
                !selectedDay.overtime && (
                  <p className="text-sm text-muted-foreground">
                    {selectedDay.is_workday ? "無出勤紀錄" : "非工作日"}
                  </p>
                )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </AppLayout>
  );
}
