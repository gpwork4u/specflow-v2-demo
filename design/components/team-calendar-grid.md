# TeamCalendarGrid

## 用途

團隊行事曆元件，以「成員 x 日期」表格呈現整個團隊的月出勤狀況。行為成員名稱，列為每日狀態，使用色彩方塊標示。適用於主管和 Admin 查看團隊出勤總覽。

## Props

| Prop | Type | Default | 說明 |
|------|------|---------|------|
| year | `number` | - | 年份 |
| month | `number` | - | 月份（1-12） |
| department | `{ id: string; name: string }` | - | 部門資訊 |
| members | `TeamMember[]` | - | 團隊成員出勤資料（來自 API） |
| onMemberClick | `(member: TeamMember) => void` | - | 成員名點擊回呼 |
| onCellClick | `(member: TeamMember, date: string) => void` | - | 日格點擊回呼 |
| isLoading | `boolean` | `false` | 載入中狀態 |

## 子型別

```ts
interface TeamMember {
  user: {
    id: string;
    name: string;
    employee_id: string;
  };
  days: TeamDay[];
}

interface TeamDay {
  date: string;        // "2026-04-01"
  status: TeamDayStatus;
  leave_type: string | null; // 請假時的假別
}

type TeamDayStatus =
  | "present"      // 正常出勤
  | "late"         // 遲到
  | "early_leave"  // 早退
  | "leave"        // 請假
  | "absent"       // 缺席
  | "holiday"      // 假日
  | "overtime";    // 加班
```

## Layout

```
┌───────────┬────┬────┬────┬────┬────┬────┬────┬─ ...
│ 成員      │  1 │  2 │  3 │  4 │  5 │  6 │  7 │
│           │ 三 │ 四 │ 五 │ 六 │ 日 │ 一 │ 二 │
├───────────┼────┼────┼────┼────┼────┼────┼────┤
│ EMP001    │ ■  │ ■  │ ■  │ -- │ -- │ ■  │ ■  │
│ 王小明    │ 綠 │ 綠 │ 橙 │ 灰 │ 灰 │ 藍 │ 綠 │
├───────────┼────┼────┼────┼────┼────┼────┼────┤
│ EMP002    │ ■  │ ■  │ ■  │ -- │ -- │ ■  │ ■  │
│ 李小華    │ 綠 │ 紅 │ 綠 │ 灰 │ 灰 │ 綠 │ 綠 │
└───────────┴────┴────┴────┴────┴────┴────┴────┘
                                         ← 橫向可捲動 →
```

## 外觀規格

| 部位 | 樣式 |
|------|------|
| 外層容器 | `rounded-lg border bg-card overflow-hidden` |
| 捲動容器 | `overflow-x-auto`（日期欄可橫向捲動） |
| 表格 | `min-w-full` |
| 成員欄（sticky） | `sticky left-0 z-10 bg-card min-w-[140px] px-3 py-2 border-r` |
| 成員名 | `text-sm font-medium truncate` |
| 員工編號 | `text-xs text-muted-foreground font-mono` |
| 日期 Header | `text-center min-w-[40px] px-1 py-2 text-xs` |
| 日期數字 | `font-medium` |
| 星期文字 | `text-muted-foreground` |
| 假日欄 Header | `bg-[hsl(var(--cal-holiday-bg))]` |
| 狀態方塊 | `w-6 h-6 rounded mx-auto`，使用 `calendar-colors.css` token |
| 表格行 | `border-b hover:bg-muted/30` |
| 今日欄 | `border-x-2 border-[hsl(var(--cal-today-ring))]` |

## 狀態方塊色彩對應

| Status | 方塊背景色 | Tooltip |
|--------|----------|---------|
| present | `bg-[hsl(var(--cal-present))]` | 正常出勤 |
| late | `bg-[hsl(var(--cal-late))]` | 遲到 |
| early_leave | `bg-[hsl(var(--cal-early-leave))]` | 早退 |
| leave | `bg-[hsl(var(--cal-leave))]` 或依假別色 | 請假（假別名） |
| absent | `bg-[hsl(var(--cal-absent))]` | 缺席 |
| holiday | 無方塊，顯示 `--` | 假日 |
| overtime | `bg-[hsl(var(--cal-overtime))]` | 加班 |

## 範例程式碼

```tsx
"use client";

import { format, eachDayOfInterval, startOfMonth, endOfMonth, getDay, isToday } from "date-fns";
import { zhTW } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";

const statusColorMap: Record<TeamDayStatus, { bg: string; label: string }> = {
  present: { bg: "bg-[hsl(var(--cal-present))]", label: "正常出勤" },
  late: { bg: "bg-[hsl(var(--cal-late))]", label: "遲到" },
  early_leave: { bg: "bg-[hsl(var(--cal-early-leave))]", label: "早退" },
  leave: { bg: "bg-[hsl(var(--cal-leave))]", label: "請假" },
  absent: { bg: "bg-[hsl(var(--cal-absent))]", label: "缺席" },
  holiday: { bg: "", label: "假日" },
  overtime: { bg: "bg-[hsl(var(--cal-overtime))]", label: "加班" },
};

// 假別色彩對應（使用 leave-colors.css）
const leaveTypeColorMap: Record<string, string> = {
  annual: "bg-[hsl(var(--leave-annual))]",
  personal: "bg-[hsl(var(--leave-personal))]",
  sick: "bg-[hsl(var(--leave-sick))]",
  marriage: "bg-[hsl(var(--leave-marriage))]",
  bereavement: "bg-[hsl(var(--leave-bereavement))]",
  maternity: "bg-[hsl(var(--leave-maternity))]",
  paternity: "bg-[hsl(var(--leave-paternity))]",
  official: "bg-[hsl(var(--leave-official))]",
};

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

interface TeamCalendarGridProps {
  year: number;
  month: number;
  department: { id: string; name: string };
  members: TeamMember[];
  onMemberClick?: (member: TeamMember) => void;
  onCellClick?: (member: TeamMember, date: string) => void;
  isLoading?: boolean;
}

export function TeamCalendarGrid({
  year,
  month,
  department,
  members,
  onMemberClick,
  onCellClick,
  isLoading = false,
}: TeamCalendarGridProps) {
  const firstDay = startOfMonth(new Date(year, month - 1));
  const lastDay = endOfMonth(firstDay);
  const allDays = eachDayOfInterval({ start: firstDay, end: lastDay });

  if (isLoading) {
    return (
      <div className="rounded-lg border bg-card p-4">
        <Skeleton className="mb-4 h-6 w-48" />
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse">
            <thead>
              <tr className="border-b">
                {/* 成員欄 Header */}
                <th className="sticky left-0 z-10 min-w-[140px] border-r bg-card px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                  成員 ({members.length})
                </th>

                {/* 日期欄 Header */}
                {allDays.map((date) => {
                  const dow = getDay(date);
                  const isHoliday = dow === 0 || dow === 6;
                  const today = isToday(date);
                  return (
                    <th
                      key={date.toISOString()}
                      className={cn(
                        "min-w-[40px] px-1 py-2 text-center text-xs",
                        isHoliday && "bg-[hsl(var(--cal-holiday-bg))]",
                        today && "border-x-2 border-[hsl(var(--cal-today-ring))]"
                      )}
                    >
                      <div className="font-medium">{date.getDate()}</div>
                      <div className={cn(
                        "text-muted-foreground",
                        dow === 0 && "text-destructive",
                        dow === 6 && "text-[hsl(var(--cal-holiday-text))]"
                      )}>
                        {format(date, "EEEEE", { locale: zhTW })}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {members.map((member) => {
                const dayMap = new Map(member.days.map((d) => [d.date, d]));

                return (
                  <tr key={member.user.id} className="border-b hover:bg-muted/30">
                    {/* 成員名 */}
                    <td className="sticky left-0 z-10 min-w-[140px] border-r bg-card px-3 py-2">
                      <button
                        type="button"
                        className="text-left hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                        onClick={() => onMemberClick?.(member)}
                      >
                        <div className="text-sm font-medium truncate">{member.user.name}</div>
                        <div className="text-xs text-muted-foreground font-mono">
                          {member.user.employee_id}
                        </div>
                      </button>
                    </td>

                    {/* 日期狀態格 */}
                    {allDays.map((date) => {
                      const dateStr = format(date, "yyyy-MM-dd");
                      const dayData = dayMap.get(dateStr);
                      const today = isToday(date);

                      if (!dayData) {
                        return (
                          <td key={dateStr} className={cn(
                            "px-1 py-2 text-center",
                            today && "border-x-2 border-[hsl(var(--cal-today-ring))]"
                          )}>
                            <span className="text-xs text-muted-foreground">-</span>
                          </td>
                        );
                      }

                      const statusConfig = statusColorMap[dayData.status];
                      const isLeave = dayData.status === "leave" && dayData.leave_type;
                      const cellBg = isLeave
                        ? leaveTypeColorMap[dayData.leave_type!] ?? statusConfig.bg
                        : statusConfig.bg;
                      const tooltipLabel = isLeave
                        ? `${leaveTypeLabels[dayData.leave_type!] ?? dayData.leave_type}`
                        : statusConfig.label;

                      return (
                        <td
                          key={dateStr}
                          className={cn(
                            "px-1 py-2 text-center",
                            today && "border-x-2 border-[hsl(var(--cal-today-ring))]"
                          )}
                        >
                          {dayData.status === "holiday" ? (
                            <span className="text-xs text-muted-foreground" aria-label="假日">--</span>
                          ) : (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  className={cn(
                                    "mx-auto h-6 w-6 rounded transition-transform hover:scale-110",
                                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                    cellBg
                                  )}
                                  onClick={() => onCellClick?.(member, dateStr)}
                                  aria-label={`${member.user.name} ${format(date, "M月d日")} ${tooltipLabel}`}
                                />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{member.user.name} - {format(date, "M/d")}</p>
                                <p className="font-medium">{tooltipLabel}</p>
                              </TooltipContent>
                            </Tooltip>
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

        {/* 圖例 */}
        <div className="flex flex-wrap gap-3 border-t px-3 py-2">
          {Object.entries(statusColorMap)
            .filter(([key]) => key !== "holiday")
            .map(([key, config]) => (
              <div key={key} className="flex items-center gap-1.5">
                <span className={cn("h-3 w-3 rounded", config.bg)} aria-hidden="true" />
                <span className="text-xs text-muted-foreground">{config.label}</span>
              </div>
            ))}
        </div>
      </div>
    </TooltipProvider>
  );
}
```

## 響應式行為

| 斷點 | 行為 |
|------|------|
| >= 1280px (xl) | 完整表格，所有日期可見 |
| 768-1279px | 成員欄 sticky，日期欄橫向捲動 |
| < 768px | 同上，建議提示「橫向滑動查看更多」 |

## Accessibility

- 使用語意化 `<table>` 元素（`<thead>`, `<tbody>`, `<tr>`, `<th>`, `<td>`）
- 成員欄 Header 和日期 Header 為 `<th>` 元素
- 狀態方塊為 `<button>` 元素，有完整 `aria-label`（含成員名、日期、狀態）
- Tooltip 提供色彩以外的狀態文字說明
- 假日欄位使用 `aria-label="假日"`
- 成員名可點擊，有 `focus-visible` ring
- 圖例區提供色彩含義的文字對照

## 使用的 shadcn/ui 元件

- `Tooltip`（TooltipProvider, TooltipTrigger, TooltipContent）
- `Skeleton`（Loading 狀態）
