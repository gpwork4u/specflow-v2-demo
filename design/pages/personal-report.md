# 個人出勤報表

## 對應 Feature

#22 F-005: 出席報表/統計

## Layout

```
┌──────────────────────────────────────────────────┐
│ Header: [=] 報表 > 個人報表          [Avatar v]   │
├────────────┬─────────────────────────────────────┤
│ Sidebar    │ Main Content                        │
│            │                                     │
│ Dashboard  │ ┌── PageHeader ──────────────────┐  │
│ 打卡       │ │ 個人出勤報表                   │  │
│ 打卡紀錄   │ │ 查看您的月出勤統計             │  │
│ ─────      │ └────────────────────────────────┘  │
│ 行事曆     │                                     │
│ ─────      │ ┌── MonthPicker ─────────────────┐  │
│ > 報表     │ │ [<]  2026 年 4 月  [>]         │  │
│   個人     │ └────────────────────────────────┘  │
│   團隊     │                                     │
│   全公司   │ ┌── StatsCards (grid-cols-4) ─────┐ │
│            │ │ [出勤率]  [遲到]  [請假]  [加班] │ │
│            │ │  95.5%    2次     2天     8h     │ │
│            │ │  (環形)                          │ │
│            │ └────────────────────────────────┘  │
│            │                                     │
│            │ ┌── Charts (grid-cols-2) ─────────┐ │
│            │ │ [出勤分布]    [請假類型分布]     │ │
│            │ │  圓餅圖        圓餅圖            │ │
│            │ └────────────────────────────────┘  │
│            │                                     │
│            │ ┌── 請假明細 ────────────────────┐  │
│            │ │ leave_type │ hours │ 說明       │  │
│            │ │ 特休       │ 16h   │            │  │
│            │ │ 病假       │  0h   │            │  │
│            │ └────────────────────────────────┘  │
└────────────┴─────────────────────────────────────┘
```

## 頁面規格

| 項目 | 說明 |
|------|------|
| 路由 | `/reports/personal` |
| 認證 | 需要（所有角色） |
| Layout | `AppLayout` |
| Breadcrumb | `[報表, 個人報表]` |

## API 呼叫

| API | 時機 | 說明 |
|-----|------|------|
| `GET /api/v1/reports/personal?year={y}&month={m}` | 頁面載入、月份切換 | 取得個人出勤統計 |

## 使用的元件

| 元件 | 來源 | 用途 |
|------|------|------|
| AppLayout | `components/layout` | 頁面框架 |
| PageHeader | `components/layout` | 頁面標題 |
| MonthPicker | `components/month-picker` | 月份切換 |
| StatsCard | `components/stats-card` | 統計指標卡片 |
| AttendancePieChart | `components/attendance-chart` | 出勤分布圓餅圖 |
| Table | shadcn/ui | 請假明細表格 |

## 內容區塊

### 1. 統計卡片區（grid-cols-4）

| 卡片 | Icon | 主值 | 單位 | 進度環 | variant | 子指標 |
|------|------|------|------|--------|---------|--------|
| 出勤率 | `CalendarCheck` | attendance_rate | % | 有 | success/warning/danger | 出勤天數, 工作日 |
| 遲到 | `AlertTriangle` | late_days | 次 | 無 | warning（>0時） | - |
| 請假 | `CalendarX` | leave_days | 天 | 無 | default | - |
| 加班 | `Timer` | overtime_hours | h | 無 | default | - |

### 2. 圖表區（grid-cols-2）

| 圖表 | 類型 | 資料來源 | 中央標籤 |
|------|------|---------|---------|
| 出勤分布 | Donut Pie | summary 中的各天數 | 出勤天數/工作日 |
| 請假類型分布 | Donut Pie | leave_summary | 總請假天數 |

### 3. 請假明細表

簡單表格顯示各假別使用時數，來自 `leave_summary`。

## 範例程式碼

```tsx
"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout";
import { PageHeader } from "@/components/page-header";
import { MonthPicker } from "@/components/month-picker";
import { StatsCard } from "@/components/stats-card";
import { AttendancePieChart } from "@/components/attendance-chart";
import {
  Table, TableBody, TableCell,
  TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  CalendarCheck, AlertTriangle, CalendarX, Timer,
} from "lucide-react";
import { fetchPersonalReport } from "@/lib/api/reports";

const leaveTypeLabels: Record<string, string> = {
  annual: "特休", personal: "事假", sick: "病假",
  marriage: "婚假", bereavement: "喪假", maternity: "產假",
  paternity: "陪產假", official: "公假",
};

export default function PersonalReportPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const { data, isLoading } = useQuery({
    queryKey: ["reports", "personal", year, month],
    queryFn: () => fetchPersonalReport(year, month),
  });

  const summary = data?.summary;

  // 出勤率 variant
  const rateVariant = !summary ? "default"
    : summary.attendance_rate >= 95 ? "success"
    : summary.attendance_rate >= 90 ? "warning"
    : "danger";

  return (
    <AppLayout breadcrumbs={[{ label: "報表", href: "/reports" }, { label: "個人報表" }]}>
      <PageHeader title="個人出勤報表" description="查看您的月出勤統計" />

      {/* 月份選擇 */}
      <div className="mb-6">
        <MonthPicker year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m); }} />
      </div>

      {/* 統計卡片 */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="出勤率"
          value={summary?.attendance_rate ?? 0}
          unit="%"
          icon={CalendarCheck}
          variant={rateVariant}
          progress={summary?.attendance_rate}
          subItems={[
            { label: "出勤天數", value: summary?.present_days ?? 0 },
            { label: "工作日", value: summary?.workdays ?? 0 },
          ]}
        />
        <StatsCard
          title="遲到"
          value={summary?.late_days ?? 0}
          unit="次"
          icon={AlertTriangle}
          variant={summary?.late_days ? "warning" : "default"}
        />
        <StatsCard
          title="請假"
          value={summary?.leave_days ?? 0}
          unit="天"
          icon={CalendarX}
        />
        <StatsCard
          title="加班"
          value={summary?.overtime_hours ?? 0}
          unit="h"
          icon={Timer}
        />
      </div>

      {/* 圖表 */}
      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <AttendancePieChart
          title="出勤分布"
          description={`${year} 年 ${month} 月`}
          centerLabel="出勤天數"
          centerValue={summary?.present_days ?? 0}
          data={[
            { name: "present", value: summary?.present_days ?? 0, color: "--chart-present" },
            { name: "late", value: summary?.late_days ?? 0, color: "--chart-late" },
            { name: "leave", value: summary?.leave_days ?? 0, color: "--chart-leave" },
            { name: "absent", value: summary?.absent_days ?? 0, color: "--chart-absent" },
          ].filter((d) => d.value > 0)}
          config={{
            present: { label: "正常出勤", color: "hsl(var(--chart-present))" },
            late: { label: "遲到", color: "hsl(var(--chart-late))" },
            leave: { label: "請假", color: "hsl(var(--chart-leave))" },
            absent: { label: "缺席", color: "hsl(var(--chart-absent))" },
          }}
        />

        <AttendancePieChart
          title="請假類型分布"
          description={`${year} 年 ${month} 月`}
          centerLabel="總請假"
          centerValue={`${summary?.leave_days ?? 0}天`}
          data={(data?.leave_summary ?? [])
            .filter((l) => l.hours > 0)
            .map((l) => ({
              name: l.leave_type,
              value: l.hours / 8,
              color: `--leave-${l.leave_type}`,
            }))}
          config={Object.fromEntries(
            (data?.leave_summary ?? []).map((l) => [
              l.leave_type,
              { label: leaveTypeLabels[l.leave_type] ?? l.leave_type, color: `hsl(var(--leave-${l.leave_type}))` },
            ])
          )}
        />
      </div>

      {/* 請假明細 */}
      <div className="rounded-lg border bg-card">
        <div className="px-6 pt-6 pb-2">
          <h3 className="text-lg font-semibold">請假明細</h3>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="bg-muted/50">假別</TableHead>
              <TableHead className="bg-muted/50 text-right">使用時數</TableHead>
              <TableHead className="bg-muted/50 text-right">使用天數</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data?.leave_summary ?? []).map((item) => (
              <TableRow key={item.leave_type}>
                <TableCell>{leaveTypeLabels[item.leave_type] ?? item.leave_type}</TableCell>
                <TableCell className="text-right font-mono">{item.hours}h</TableCell>
                <TableCell className="text-right font-mono">{item.hours / 8}天</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </AppLayout>
  );
}
```

## 響應式行為

| 斷點 | Stats Grid | Charts Grid |
|------|-----------|------------|
| >= 1024px (lg) | 4 欄 | 2 欄 |
| 640-1023px (sm-lg) | 2 欄 | 1 欄 |
| < 640px | 1 欄 | 1 欄 |
