# 個人行事曆頁

## 對應 Feature

#21 F-004: 行事曆檢視

## Layout

```
┌──────────────────────────────────────────────────┐
│ Header: [=] 行事曆 > 個人行事曆     [Avatar v]   │
├────────────┬─────────────────────────────────────┤
│ Sidebar    │ Main Content                        │
│            │                                     │
│ Dashboard  │ ┌── PageHeader ──────────────────┐  │
│ 打卡       │ │ 個人行事曆                     │  │
│ 打卡紀錄   │ │ 查看您的月出勤、請假、加班紀錄 │  │
│ ─────      │ └────────────────────────────────┘  │
│ > 行事曆   │                                     │
│   個人     │ ┌── MonthPicker ─────────────────┐  │
│   團隊     │ │ [<]  2026 年 4 月  [>]         │  │
│ ─────      │ └────────────────────────────────┘  │
│ 報表       │                                     │
│   個人     │ ┌── CalendarMonth ───────────────┐  │
│   團隊     │ │ 日  一  二  三  四  五  六      │  │
│   全公司   │ │ ...（整月格子視圖）...          │  │
│            │ │                                 │  │
│            │ │ ■正常 ■遲到 ■請假 ■缺席 ■加班  │  │
│            │ └────────────────────────────────┘  │
│            │                                     │
│            │ ┌── 日期詳情 Sheet ──────────────┐  │
│            │ │ （點擊日格後從右側滑入）        │  │
│            │ │ 2026年4月10日 星期五            │  │
│            │ │ 打卡: 09:05 - 18:30            │  │
│            │ │ 狀態: [遲到]                    │  │
│            │ │ 請假: 無                        │  │
│            │ └────────────────────────────────┘  │
└────────────┴─────────────────────────────────────┘
```

## 頁面規格

| 項目 | 說明 |
|------|------|
| 路由 | `/calendar/personal` |
| 認證 | 需要（所有角色） |
| Layout | `AppLayout` |
| Breadcrumb | `[行事曆, 個人行事曆]` |

## API 呼叫

| API | 時機 | 說明 |
|-----|------|------|
| `GET /api/v1/calendar/personal?year={y}&month={m}` | 頁面載入、月份切換 | 取得整月出勤資料 |

## 使用的元件

| 元件 | 來源 | 用途 |
|------|------|------|
| AppLayout | `components/layout` | 頁面框架 |
| PageHeader | `components/layout` | 頁面標題 |
| MonthPicker | `components/month-picker` | 月份切換 |
| CalendarMonth | `components/calendar-month` | 月曆格子視圖 |
| Sheet | shadcn/ui | 日格詳情抽屜 |
| StatusBadge | `components/status-badge` | 打卡狀態標籤 |
| LeaveTypeBadge | `components/leave-type-badge` | 假別標籤 |

## 互動行為

1. 頁面載入時以當前年月呼叫 API
2. 使用 MonthPicker 切換月份，觸發重新載入
3. 點擊日格開啟右側 Sheet 顯示詳情（打卡時間、請假紀錄、加班紀錄）
4. Sheet 關閉時清除選中狀態
5. 使用 `@tanstack/react-query` 快取資料，切回已瀏覽的月份不重複請求
6. Loading 狀態：CalendarMonth 顯示 Skeleton grid

## 範例程式碼

```tsx
"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout";
import { PageHeader } from "@/components/page-header";
import { MonthPicker } from "@/components/month-picker";
import { CalendarMonth, CalendarDay } from "@/components/calendar-month";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { StatusBadge } from "@/components/status-badge";
import { format } from "date-fns";
import { zhTW } from "date-fns/locale";
import { fetchPersonalCalendar } from "@/lib/api/calendar";

export default function PersonalCalendarPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["calendar", "personal", year, month],
    queryFn: () => fetchPersonalCalendar(year, month),
  });

  return (
    <AppLayout breadcrumbs={[{ label: "行事曆", href: "/calendar" }, { label: "個人行事曆" }]}>
      <PageHeader
        title="個人行事曆"
        description="查看您的月出勤、請假、加班紀錄"
      />

      {/* 月份選擇 */}
      <div className="mb-4">
        <MonthPicker
          year={year}
          month={month}
          onChange={(y, m) => {
            setYear(y);
            setMonth(m);
            setSelectedDay(null);
          }}
        />
      </div>

      {/* 月曆 */}
      <CalendarMonth
        year={year}
        month={month}
        days={data?.days ?? []}
        isLoading={isLoading}
        selectedDate={selectedDay?.date}
        onDayClick={(day) => setSelectedDay(day)}
      />

      {/* 日格詳情 Sheet */}
      <Sheet open={!!selectedDay} onOpenChange={(open) => !open && setSelectedDay(null)}>
        <SheetContent>
          {selectedDay && (
            <>
              <SheetHeader>
                <SheetTitle>
                  {format(new Date(selectedDay.date), "yyyy年M月d日 EEEE", { locale: zhTW })}
                </SheetTitle>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                {/* 打卡紀錄 */}
                {selectedDay.clock && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold">打卡紀錄</h4>
                    <div className="rounded-lg border p-3 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">上班</span>
                        <span className="font-mono">
                          {selectedDay.clock.clock_in
                            ? format(new Date(selectedDay.clock.clock_in), "HH:mm:ss")
                            : "--:--:--"}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">下班</span>
                        <span className="font-mono">
                          {selectedDay.clock.clock_out
                            ? format(new Date(selectedDay.clock.clock_out), "HH:mm:ss")
                            : "--:--:--"}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">狀態</span>
                        <StatusBadge type="attendance" value={selectedDay.clock.status} />
                      </div>
                    </div>
                  </div>
                )}

                {/* 請假紀錄 */}
                {selectedDay.leaves.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold">請假紀錄</h4>
                    {selectedDay.leaves.map((leave) => (
                      <div key={leave.id} className="rounded-lg border p-3 space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span>{leave.leave_type}</span>
                          <StatusBadge type="leave" value={leave.status} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* 加班紀錄 */}
                {selectedDay.overtime && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold">加班紀錄</h4>
                    <div className="rounded-lg border p-3">
                      <span className="text-sm">{selectedDay.overtime.hours} 小時</span>
                    </div>
                  </div>
                )}

                {/* 無資料 */}
                {!selectedDay.clock && selectedDay.leaves.length === 0 && !selectedDay.overtime && (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    {selectedDay.is_workday ? "當日無出勤紀錄" : "非工作日"}
                  </p>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </AppLayout>
  );
}
```

## 響應式行為

| 斷點 | CalendarMonth | Sheet |
|------|-------------|-------|
| >= 1024px (lg) | 日格 100px，顯示狀態文字+時間 | 右側 400px |
| 768-1023px (md) | 日格 80px，僅顯示圓點 | 右側 320px |
| < 768px | 日格 80px，僅顯示圓點 | 底部全寬 Sheet |
