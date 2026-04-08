# CalendarMonth

## 用途

個人月曆元件，以格子視圖呈現整月的出勤狀態。每個日格以色彩標示當日出勤狀態（正常、遲到、請假、缺席等），點擊日格可展開詳情。搭配 `MonthPicker` 切換月份。

## Props

| Prop | Type | Default | 說明 |
|------|------|---------|------|
| year | `number` | - | 年份 |
| month | `number` | - | 月份（1-12） |
| days | `CalendarDay[]` | - | 整月日期資料（來自 API） |
| onDayClick | `(day: CalendarDay) => void` | - | 日格點擊回呼 |
| isLoading | `boolean` | `false` | 載入中狀態 |
| selectedDate | `string` | - | 目前選中的日期（YYYY-MM-DD） |

## 子型別

```ts
interface CalendarDay {
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

// 日格衍生狀態（由元件內部計算）
type DayCellStatus =
  | "present"    // 正常出勤（綠）
  | "late"       // 遲到（橙）
  | "early_leave"// 早退（深橙）
  | "leave"      // 請假（藍，或依假別色）
  | "absent"     // 缺席（紅）
  | "holiday"    // 假日（灰）
  | "overtime"   // 加班（紫）
  | "half_leave" // 半天假+半天出勤（左右分色）
  | "future"     // 未來日期（無色）
  | null;        // 無資料
```

## Layout

```
┌───────────────────────────────────────────────────┐
│  日    一    二    三    四    五    六             │
├───────────────────────────────────────────────────┤
│       [  1] [  2] [  3] [  4] [  5] [  6]         │
│       正常   特休  正常   正常  遲到  (六)          │
│                                                   │
│ [  7] [  8] [  9] [ 10] [ 11] [ 12] [ 13]         │
│ (日)  正常   正常  半假   缺席  正常  (六)          │
│                   +出勤                            │
│ ...                                               │
└───────────────────────────────────────────────────┘

日格內部（48x48 以上）：
┌──────────┐
│  日期數字 │  ← text-sm font-medium
│  [狀態點] │  ← 小圓點或 mini 文字標籤
│  [時間]   │  ← text-xs（選填，桌面版才顯示）
└──────────┘
```

## 外觀規格

| 部位 | 樣式 |
|------|------|
| 容器 | `rounded-lg border bg-card` |
| 星期 Header | `grid grid-cols-7 border-b`，每格 `p-2 text-center text-xs font-medium text-muted-foreground` |
| 日格容器 | `grid grid-cols-7`，每格 `min-h-[80px] lg:min-h-[100px] border-b border-r p-1.5` |
| 日期數字 | `text-sm font-medium`，今天額外 `bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center` |
| 狀態指示 | 小圓點 `w-2 h-2 rounded-full`，使用 `calendar-colors.css` 的 token |
| 狀態標籤 | `text-[10px] leading-tight`，使用對應狀態文字色 |
| 假日日格 | `bg-[hsl(var(--cal-holiday-bg))]` |
| 選中日格 | `ring-2 ring-primary ring-inset` |
| hover 日格 | `hover:bg-accent/50 cursor-pointer` |
| 非當月日格 | `opacity-30` |
| Loading | `Skeleton` 填滿整個格子區域 |
| 週六 Header | `text-[hsl(var(--cal-holiday-text))]` |
| 週日 Header | `text-destructive` |

## 日格狀態色彩對應

| DayCellStatus | 背景 Token | 圓點色 Token | 標籤文字 |
|---------------|-----------|-------------|---------|
| present | `--cal-present-bg` | `--cal-present` | 正常 |
| late | `--cal-late-bg` | `--cal-late` | 遲到 |
| early_leave | `--cal-early-leave-bg` | `--cal-early-leave` | 早退 |
| leave | `--cal-leave-bg` 或依假別色 | `--cal-leave` | 假別名 |
| absent | `--cal-absent-bg` | `--cal-absent` | 缺席 |
| holiday | `--cal-holiday-bg` | - | - |
| overtime | `--cal-overtime-bg` | `--cal-overtime` | 加班 |
| half_leave | 左半 leave 色 / 右半 present 色 | 兩色圓點 | 半假 |
| future | 無特殊背景 | - | - |

## 狀態衍生邏輯

```ts
function deriveDayCellStatus(day: CalendarDay): DayCellStatus {
  const today = new Date().toISOString().slice(0, 10);

  // 假日
  if (!day.is_workday && !day.overtime) return "holiday";

  // 未來日期
  if (day.date > today) return "future";

  // 加班（假日加班）
  if (!day.is_workday && day.overtime) return "overtime";

  // 全天請假
  const approvedLeaves = day.leaves.filter((l) => l.status === "approved");
  const hasFullDayLeave = approvedLeaves.some((l) => l.start_half === "full");
  if (hasFullDayLeave) return "leave";

  // 半天假 + 有打卡
  const hasHalfLeave = approvedLeaves.length > 0;
  if (hasHalfLeave && day.clock) return "half_leave";
  if (hasHalfLeave && !day.clock) return "leave";

  // 有打卡紀錄
  if (day.clock) return day.clock.status as DayCellStatus;

  // 工作日無打卡無請假
  if (day.is_workday && day.date <= today) return "absent";

  return null;
}
```

## 範例程式碼

```tsx
"use client";

import { useState } from "react";
import { format, startOfMonth, endOfMonth, getDay, eachDayOfInterval, isSameDay, isToday } from "date-fns";
import { zhTW } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

const statusStyles: Record<string, { bg: string; dot: string; label: string }> = {
  present: {
    bg: "bg-[hsl(var(--cal-present-bg))]",
    dot: "bg-[hsl(var(--cal-present))]",
    label: "正常",
  },
  late: {
    bg: "bg-[hsl(var(--cal-late-bg))]",
    dot: "bg-[hsl(var(--cal-late))]",
    label: "遲到",
  },
  early_leave: {
    bg: "bg-[hsl(var(--cal-early-leave-bg))]",
    dot: "bg-[hsl(var(--cal-early-leave))]",
    label: "早退",
  },
  leave: {
    bg: "bg-[hsl(var(--cal-leave-bg))]",
    dot: "bg-[hsl(var(--cal-leave))]",
    label: "請假",
  },
  absent: {
    bg: "bg-[hsl(var(--cal-absent-bg))]",
    dot: "bg-[hsl(var(--cal-absent))]",
    label: "缺席",
  },
  holiday: {
    bg: "bg-[hsl(var(--cal-holiday-bg))]",
    dot: "",
    label: "",
  },
  overtime: {
    bg: "bg-[hsl(var(--cal-overtime-bg))]",
    dot: "bg-[hsl(var(--cal-overtime))]",
    label: "加班",
  },
};

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
  // 建立日期 lookup map
  const dayMap = new Map(days.map((d) => [d.date, d]));

  // 計算月曆格
  const firstDay = startOfMonth(new Date(year, month - 1));
  const lastDay = endOfMonth(firstDay);
  const startOffset = getDay(firstDay); // 0=日, 1=一, ...
  const allDays = eachDayOfInterval({ start: firstDay, end: lastDay });

  return (
    <div className="rounded-lg border bg-card">
      {/* 星期 Header */}
      <div className="grid grid-cols-7 border-b">
        {WEEKDAYS.map((day, i) => (
          <div
            key={day}
            className={cn(
              "p-2 text-center text-xs font-medium text-muted-foreground",
              i === 0 && "text-destructive",
              i === 6 && "text-[hsl(var(--cal-holiday-text))]"
            )}
          >
            {day}
          </div>
        ))}
      </div>

      {/* 日格 */}
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
          {/* 前置空格 */}
          {Array.from({ length: startOffset }).map((_, i) => (
            <div key={`empty-${i}`} className="min-h-[80px] border-b border-r lg:min-h-[100px]" />
          ))}

          {/* 日期格 */}
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
                aria-label={`${format(date, "M月d日")}${style?.label ? `，${style.label}` : ""}`}
                aria-pressed={isSelected}
              >
                {/* 日期數字 */}
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
                  {/* 狀態圓點 */}
                  {style?.dot && (
                    <span
                      className={cn("mt-1 h-2 w-2 rounded-full", style.dot)}
                      aria-hidden="true"
                    />
                  )}
                </div>

                {/* 狀態文字（桌面版） */}
                {style?.label && (
                  <span className="mt-1 hidden text-[10px] leading-tight text-muted-foreground lg:block">
                    {style.label}
                  </span>
                )}

                {/* 打卡時間（桌面版） */}
                {dayData?.clock?.clock_in && (
                  <span className="mt-0.5 hidden text-[10px] leading-tight text-muted-foreground lg:block">
                    {format(new Date(dayData.clock.clock_in), "HH:mm")}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* 圖例 */}
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
```

## 日格點擊詳情

點擊日格後建議使用 `Sheet`（側邊抽屜）或 `Dialog` 顯示詳情：

```tsx
// 詳情面板內容
<div className="space-y-4">
  <h3 className="font-semibold">{format(selectedDate, "yyyy年M月d日 EEEE", { locale: zhTW })}</h3>

  {/* 打卡紀錄 */}
  {day.clock && (
    <div className="space-y-2">
      <h4 className="text-sm font-medium">打卡紀錄</h4>
      <div className="flex justify-between text-sm">
        <span>上班</span>
        <span>{format(new Date(day.clock.clock_in), "HH:mm:ss")}</span>
      </div>
      <div className="flex justify-between text-sm">
        <span>下班</span>
        <span>{day.clock.clock_out ? format(new Date(day.clock.clock_out), "HH:mm:ss") : "--:--:--"}</span>
      </div>
      <StatusBadge type="attendance" value={day.clock.status} />
    </div>
  )}

  {/* 請假紀錄 */}
  {day.leaves.length > 0 && (
    <div className="space-y-2">
      <h4 className="text-sm font-medium">請假紀錄</h4>
      {day.leaves.map((leave) => (
        <div key={leave.id} className="flex items-center justify-between text-sm">
          <LeaveTypeBadge type={leave.leave_type} />
          <LeaveStatusBadge status={leave.status} />
        </div>
      ))}
    </div>
  )}

  {/* 加班紀錄 */}
  {day.overtime && (
    <div className="space-y-2">
      <h4 className="text-sm font-medium">加班紀錄</h4>
      <span className="text-sm">{day.overtime.hours} 小時</span>
    </div>
  )}
</div>
```

## 響應式行為

| 斷點 | 日格高度 | 日格內容 |
|------|---------|---------|
| >= 1024px (lg) | 100px | 日期 + 狀態圓點 + 狀態文字 + 時間 |
| < 1024px | 80px | 日期 + 狀態圓點 |

## Accessibility

- 每個日格為 `<button>` 元素，支援 keyboard focus
- 日格有 `aria-label` 含完整日期和狀態描述
- 選中日格有 `aria-pressed="true"`
- 狀態圓點有 `aria-hidden="true"`（裝飾性）
- 圖例區提供視覺以外的色彩含義說明
- focus 時顯示 `ring` 高亮
- 色彩對比度符合 WCAG 2.1 AA

## 使用的 shadcn/ui 元件

- `Skeleton`（Loading 狀態）
- `Sheet` 或 `Dialog`（日格詳情面板）
