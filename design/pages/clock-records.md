# 打卡紀錄頁

## 對應 Feature

#8 F-001: 打卡（上班/下班）

## Layout

```
┌──────────────────────────────────────────────────┐
│ Header: [≡] 打卡紀錄              [Avatar ▼]     │
├────────────┬─────────────────────────────────────┤
│ Sidebar    │ Main Content                        │
│            │                                     │
│   Dashboard│ ┌── PageHeader ──────────────────┐  │
│   打卡     │ │ 打卡紀錄                       │  │
│ > 打卡紀錄 │ │ 查看您的出勤紀錄               │  │
│   ─────    │ └────────────────────────────────┘  │
│   員工管理 │                                     │
│   部門管理 │ ┌── Controls ────────────────────┐  │
│            │ │ [◀] 2026年4月 [▶]  [列表|月曆] │  │
│            │ │ [狀態▼]                         │  │
│            │ └────────────────────────────────┘  │
│            │                                     │
│            │ ┌── Calendar View ────────────────┐ │
│            │ │ 一  二  三  四  五  六  日      │  │
│            │ │          1   2   3   4   5      │  │
│            │ │          ✓   ✓   ✓   ✓   -      │  │
│            │ │ 6   7   8   9  10  11  12      │  │
│            │ │ -   !   ✓   ✓   ✓   ✓   -      │  │
│            │ │ ...                              │ │
│            │ └────────────────────────────────┘  │
│            │                                     │
│            │ ─── 或 ───                           │
│            │                                     │
│            │ ┌── List View ───────────────────┐  │
│            │ │ 日期    上班    下班    狀態     │  │
│            │ │ 04/07  09:00  18:05  [正常]    │  │
│            │ │ 04/06  09:15  18:00  [遲到]    │  │
│            │ │ 04/05  --:--  --:--  [缺席]    │  │
│            │ │ ...                             │  │
│            │ ├────────────────────────────────┤  │
│            │ │ 共 22 筆  [< 1/2 >]            │  │
│            │ └────────────────────────────────┘  │
└────────────┴─────────────────────────────────────┘
```

## 頁面規格

| 項目 | 說明 |
|------|------|
| 路由 | `/clock/records` |
| 認證 | 需要（所有角色） |
| Layout | `AppLayout` |
| Breadcrumb | `[Dashboard, 打卡紀錄]` |

## 使用的元件

| 元件 | 來源 | 用途 |
|------|------|------|
| AppLayout | `components/layout` | 頁面框架 |
| PageHeader | `components/layout` | 頁面標題 |
| DataTable | `components/data-table` | 列表視圖 |
| StatusBadge | `components/status-badge` | 出勤狀態 |
| Button | shadcn/ui | 月份切換、視圖切換 |
| Tabs | shadcn/ui | 列表/月曆切換 |
| EmptyState | `components/empty-state` | 無紀錄狀態 |

## 視圖切換

### 月曆視圖

以月曆形式顯示每日出勤狀態。

| 部位 | 樣式 |
|------|------|
| 月份選擇 | `flex items-center gap-2`，左右箭頭 + 月份文字 |
| 月曆格子 | 7 欄 grid，每格 `aspect-square rounded-lg` |
| 格子內容 | 日期數字 + 狀態 icon |
| 狀態 icon | 正常=綠點、遲到=橙點、早退=橙點、缺席=紅點、未打卡=灰 |
| 今日 | `ring-2 ring-primary` 標示 |
| 假日 | `text-muted-foreground`，灰色背景 |

```tsx
function CalendarView({ records, month, onMonthChange }) {
  const days = getDaysInMonth(month);

  return (
    <div>
      {/* 月份選擇器 */}
      <div className="mb-4 flex items-center justify-center gap-4">
        <Button variant="outline" size="icon" onClick={() => onMonthChange(-1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-lg font-semibold">
          {format(month, "yyyy年M月")}
        </span>
        <Button variant="outline" size="icon" onClick={() => onMonthChange(1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* 星期 Header */}
      <div className="grid grid-cols-7 text-center text-sm font-medium text-muted-foreground">
        {["一", "二", "三", "四", "五", "六", "日"].map((d) => (
          <div key={d} className="py-2">{d}</div>
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
                day.isWeekend && "bg-muted/50 text-muted-foreground"
              )}
            >
              <span>{day.dayOfMonth}</span>
              {record && (
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
```

### 列表視圖

使用 DataTable 顯示。

| 欄位 | Header | 說明 |
|------|--------|------|
| date | 日期 | `yyyy-MM-dd (週X)` 格式 |
| clock_in | 上班 | `HH:mm:ss` 或 `--:--:--` |
| clock_out | 下班 | `HH:mm:ss` 或 `--:--:--` |
| status | 狀態 | StatusBadge(type="attendance") |
| note | 備註 | 截斷顯示，hover 顯示全文 |

## 互動行為

### 月份切換

- 左右箭頭切換月份
- 最遠可查到 90 天前的紀錄
- 切換時呼叫 `GET /api/v1/clock/records?start_date=...&end_date=...`

### 視圖切換

- 使用 `Tabs` 元件切換月曆/列表
- 記住使用者偏好（localStorage）

### 月曆格子點擊

- 點擊有紀錄的日期，顯示詳細資訊（Popover）
- 包含：上班時間、下班時間、狀態、備註

## 範例程式碼（頁面組裝）

```tsx
"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarDays, List } from "lucide-react";

export default function ClockRecordsPage() {
  const [month, setMonth] = useState(new Date());
  const [view, setView] = useState<"calendar" | "list">("calendar");

  const { data: records, isLoading } = useQuery({
    queryKey: ["clock", "records", format(month, "yyyy-MM")],
    queryFn: () =>
      api.get("/clock/records", {
        params: {
          start_date: startOfMonth(month).toISOString().split("T")[0],
          end_date: endOfMonth(month).toISOString().split("T")[0],
          limit: 100,
        },
      }),
  });

  return (
    <AppLayout
      breadcrumbs={[
        { label: "Dashboard", href: "/" },
        { label: "打卡紀錄" },
      ]}
    >
      <PageHeader title="打卡紀錄" description="查看您的出勤紀錄" />

      <Tabs value={view} onValueChange={(v) => setView(v as any)}>
        <div className="mb-4 flex items-center justify-between">
          <div>{/* 月份選擇器放這裡 */}</div>
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
          <CalendarView
            records={records?.data || []}
            month={month}
            onMonthChange={(dir) =>
              setMonth((prev) => addMonths(prev, dir))
            }
          />
        </TabsContent>

        <TabsContent value="list">
          <DataTable
            columns={clockRecordColumns}
            data={records?.data || []}
            isLoading={isLoading}
            emptyMessage="這個月沒有打卡紀錄"
          />
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}
```

## 響應式行為

| 斷點 | 月曆 | 列表 |
|------|------|------|
| >= 768px (md) | 正常大小 | 完整欄位 |
| < 768px | 緊湊版（數字 + 小點） | 隱藏備註欄位 |

月曆視圖在手機上仍可操作，但格子較小。列表視圖可能更適合手機使用。

## API 呼叫

```
GET /api/v1/clock/records?start_date={yyyy-MM-dd}&end_date={yyyy-MM-dd}&page=1&limit=100
```
