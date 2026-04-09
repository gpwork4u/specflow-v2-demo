"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { type ColumnDef } from "@tanstack/react-table";
import {
  format,
  startOfMonth,
  endOfMonth,
  addMonths,
  isSameDay,
  getDay,
  getDaysInMonth as getDaysCount,
  startOfWeek,
} from "date-fns";
import { zhTW } from "date-fns/locale";
import { ChevronLeft, ChevronRight, CalendarDays, List } from "lucide-react";
import { AppLayout, PageHeader } from "@/components/layout";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import api from "@/lib/api";

interface ClockRecord {
  id: string;
  clock_in: string | null;
  clock_out: string | null;
  status: string;
  date: string;
  note: string | null;
}

interface RecordsResponse {
  data: ClockRecord[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// --- 列表欄位定義 ---

const weekDayNames = ["日", "一", "二", "三", "四", "五", "六"];

const listColumns: ColumnDef<ClockRecord, unknown>[] = [
  {
    accessorKey: "date",
    header: "日期",
    cell: ({ row }) => {
      const dateStr = row.getValue("date") as string;
      const d = new Date(dateStr + "T00:00:00");
      const dayOfWeek = weekDayNames[d.getDay()];
      return (
        <span>
          {dateStr} (週{dayOfWeek})
        </span>
      );
    },
  },
  {
    accessorKey: "clock_in",
    header: "上班",
    cell: ({ row }) => {
      const val = row.getValue("clock_in") as string | null;
      return val ? format(new Date(val), "HH:mm:ss") : "--:--:--";
    },
  },
  {
    accessorKey: "clock_out",
    header: "下班",
    cell: ({ row }) => {
      const val = row.getValue("clock_out") as string | null;
      return val ? format(new Date(val), "HH:mm:ss") : "--:--:--";
    },
  },
  {
    accessorKey: "status",
    header: "狀態",
    cell: ({ row }) => {
      const val = row.getValue("status") as string;
      return <StatusBadge type="attendance" value={val} />;
    },
  },
  {
    accessorKey: "note",
    header: "備註",
    cell: ({ row }) => {
      const val = row.getValue("note") as string | null;
      if (!val) return <span className="text-muted-foreground">-</span>;
      return (
        <span className="max-w-[200px] truncate" title={val}>
          {val}
        </span>
      );
    },
  },
];

// --- 月曆輔助函式 ---

interface CalendarDay {
  date: Date;
  dateStr: string;
  dayOfMonth: number;
  isCurrentMonth: boolean;
  isWeekend: boolean;
}

function getCalendarDays(month: Date): CalendarDay[] {
  const year = month.getFullYear();
  const m = month.getMonth();
  const totalDays = getDaysCount(month);

  // 該月 1 號是星期幾（0=日, 1=一, ..., 6=六）
  const firstDay = new Date(year, m, 1);
  // 轉為 Monday-based: 一=0, 二=1, ..., 日=6
  let startDay = getDay(firstDay) - 1;
  if (startDay < 0) startDay = 6;

  const days: CalendarDay[] = [];

  // 填充前面空白
  for (let i = 0; i < startDay; i++) {
    const d = new Date(year, m, -(startDay - 1 - i));
    days.push({
      date: d,
      dateStr: format(d, "yyyy-MM-dd"),
      dayOfMonth: d.getDate(),
      isCurrentMonth: false,
      isWeekend: getDay(d) === 0 || getDay(d) === 6,
    });
  }

  // 當月日期
  for (let i = 1; i <= totalDays; i++) {
    const d = new Date(year, m, i);
    days.push({
      date: d,
      dateStr: format(d, "yyyy-MM-dd"),
      dayOfMonth: i,
      isCurrentMonth: true,
      isWeekend: getDay(d) === 0 || getDay(d) === 6,
    });
  }

  return days;
}

// --- 月曆視圖元件 ---

function CalendarView({
  records,
  month,
  isLoading,
}: {
  records: ClockRecord[];
  month: Date;
  isLoading: boolean;
}) {
  const days = getCalendarDays(month);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="mx-auto h-8 w-48" />
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 35 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* 星期 Header */}
      <div className="grid grid-cols-7 text-center text-sm font-medium text-muted-foreground">
        {["一", "二", "三", "四", "五", "六", "日"].map((d) => (
          <div key={d} className="py-2">
            {d}
          </div>
        ))}
      </div>

      {/* 日期格子 */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const record = records.find((r) => r.date === day.dateStr);
          const isToday = isSameDay(day.date, new Date());

          return (
            <div
              key={day.dateStr}
              className={cn(
                "flex aspect-square flex-col items-center justify-center rounded-lg p-1 text-sm",
                isToday && "ring-2 ring-primary",
                day.isWeekend && "bg-muted/50 text-muted-foreground",
                !day.isCurrentMonth && "opacity-30"
              )}
              title={
                record
                  ? `上班: ${record.clock_in ? format(new Date(record.clock_in), "HH:mm") : "--:--"} / 下班: ${record.clock_out ? format(new Date(record.clock_out), "HH:mm") : "--:--"}`
                  : undefined
              }
            >
              <span>{day.dayOfMonth}</span>
              {record && day.isCurrentMonth && (
                <span
                  className={cn(
                    "mt-0.5 h-2 w-2 rounded-full",
                    record.status === "normal" && "bg-green-500",
                    record.status === "late" && "bg-amber-500",
                    record.status === "early_leave" && "bg-orange-500",
                    record.status === "absent" && "bg-red-500",
                    record.status === "amended" && "bg-blue-500"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* 圖例 */}
      <div className="mt-4 flex flex-wrap justify-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-green-500" /> 正常
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-amber-500" /> 遲到
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-orange-500" /> 早退
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-red-500" /> 缺席
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-blue-500" /> 已補打卡
        </span>
      </div>
    </div>
  );
}

// --- 主頁面 ---

const VIEW_STORAGE_KEY = "clock-records-view";

export default function ClockRecordsPage() {
  const [month, setMonth] = useState(new Date());
  const [view, setView] = useState<"calendar" | "list">("calendar");
  const [listPage, setListPage] = useState(1);
  const limit = 20;

  // 從 localStorage 讀取使用者偏好視圖
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(VIEW_STORAGE_KEY);
      if (saved === "calendar" || saved === "list") {
        setView(saved);
      }
    }
  }, []);

  const handleViewChange = (v: string) => {
    const newView = v as "calendar" | "list";
    setView(newView);
    if (typeof window !== "undefined") {
      localStorage.setItem(VIEW_STORAGE_KEY, newView);
    }
  };

  const startDate = format(startOfMonth(month), "yyyy-MM-dd");
  const endDate = format(endOfMonth(month), "yyyy-MM-dd");

  // 月曆視圖：取整月資料
  const {
    data: calendarData,
    isLoading: calendarLoading,
  } = useQuery<RecordsResponse>({
    queryKey: ["clock", "records", "calendar", format(month, "yyyy-MM")],
    queryFn: async () => {
      const res = await api.get("/clock/records", {
        params: {
          start_date: startDate,
          end_date: endDate,
          limit: 100,
        },
      });
      return res.data;
    },
    enabled: view === "calendar",
  });

  // 列表視圖：分頁
  const {
    data: listData,
    isLoading: listLoading,
  } = useQuery<RecordsResponse>({
    queryKey: ["clock", "records", "list", format(month, "yyyy-MM"), listPage],
    queryFn: async () => {
      const res = await api.get("/clock/records", {
        params: {
          start_date: startDate,
          end_date: endDate,
          page: listPage,
          limit,
        },
      });
      return res.data;
    },
    enabled: view === "list",
  });

  const handleMonthChange = (dir: number) => {
    setMonth((prev) => addMonths(prev, dir));
    setListPage(1);
  };

  return (
    <AppLayout
      breadcrumbs={[
        { label: "Dashboard", href: "/" },
        { label: "打卡紀錄" },
      ]}
    >
      <PageHeader title="打卡紀錄" description="查看您的出勤紀錄" />

      <Tabs value={view} onValueChange={handleViewChange}>
        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {/* 月份選擇器 */}
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => handleMonthChange(-1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-lg font-semibold">
              {format(month, "yyyy年M月")}
            </span>
            <Button
              variant="outline"
              size="icon"
              onClick={() => handleMonthChange(1)}
              disabled={isSameDay(startOfMonth(month), startOfMonth(new Date()))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* 視圖切換 */}
          <TabsList>
            <TabsTrigger value="calendar">
              <CalendarDays className="mr-2 h-4 w-4" />
              月曆
            </TabsTrigger>
            <TabsTrigger value="list">
              <List className="mr-2 h-4 w-4" />
              列表
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="calendar">
          <Card>
            <CardContent className="p-4 md:p-6">
              <CalendarView
                records={calendarData?.data || []}
                month={month}
                isLoading={calendarLoading}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="list">
          <DataTable
            columns={listColumns}
            data={listData?.data || []}
            isLoading={listLoading}
            emptyMessage="這個月沒有打卡紀錄"
            page={listData?.meta?.page}
            totalPages={listData?.meta?.totalPages}
            total={listData?.meta?.total}
            onPageChange={setListPage}
          />
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}
