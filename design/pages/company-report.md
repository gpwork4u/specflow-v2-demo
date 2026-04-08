# 全公司報表（Admin）

## 對應 Feature

#22 F-005: 出席報表/統計

## Layout

```
┌──────────────────────────────────────────────────┐
│ Header: [=] 報表 > 全公司報表        [Avatar v]   │
├────────────┬─────────────────────────────────────┤
│ Sidebar    │ Main Content                        │
│            │                                     │
│ Dashboard  │ ┌── PageHeader ──────────────────┐  │
│ 打卡       │ │ 全公司出勤報表                 │  │
│ 打卡紀錄   │ │ 全公司月出勤統計及部門比較     │  │
│ ─────      │ └────────────────────────────────┘  │
│ 行事曆     │                                     │
│ ─────      │ ┌── MonthPicker ─────────────────┐  │
│ 報表       │ │ [<]  2026 年 4 月  [>]         │  │
│   個人     │ └────────────────────────────────┘  │
│   團隊     │                                     │
│ > 全公司   │ ┌── StatsCards (grid-cols-5) ─────┐ │
│            │ │[總員工][出勤率][遲到][請假][加班]│ │
│            │ │ 100   94.2%  35次  80天  120h   │ │
│            │ └────────────────────────────────┘  │
│            │                                     │
│            │ ┌── Charts (grid-cols-2) ─────────┐ │
│            │ │ [部門出勤率]    [出勤分布]       │ │
│            │ │  水平長條圖      圓餅圖          │ │
│            │ └────────────────────────────────┘  │
│            │                                     │
│            │ ┌── ReportTable ──────────────────┐ │
│            │ │ 部門出勤明細       [匯出 ▼]     │ │
│            │ │────────────────────────────────  │ │
│            │ │ 部門 │ 人數 │ 出勤率│ 遲到│ 請假│ │
│            │ │ ...  │ ...  │  ... │ ... │ ... │ │
│            │ │────────────────────────────────  │ │
│            │ │ 全公司合計 ...                   │ │
│            │ └────────────────────────────────┘  │
└────────────┴─────────────────────────────────────┘
```

## 頁面規格

| 項目 | 說明 |
|------|------|
| 路由 | `/reports/company` |
| 認證 | 需要（admin 限定） |
| 權限 | 非 admin 導向 403 |
| Layout | `AppLayout` |
| Breadcrumb | `[報表, 全公司報表]` |

## API 呼叫

| API | 時機 | 說明 |
|-----|------|------|
| `GET /api/v1/reports/company?year={y}&month={m}` | 頁面載入、月份切換 | 取得全公司報表 |
| `GET /api/v1/reports/export?year={y}&month={m}&scope=company&format={f}` | 點擊匯出 | 下載報表檔案 |

## 使用的元件

| 元件 | 來源 | 用途 |
|------|------|------|
| AppLayout | `components/layout` | 頁面框架 |
| PageHeader | `components/layout` | 頁面標題 |
| MonthPicker | `components/month-picker` | 月份切換 |
| StatsCard | `components/stats-card` | 全公司摘要統計卡片 |
| AttendanceBarChart | `components/attendance-chart` | 部門出勤率長條圖 |
| AttendancePieChart | `components/attendance-chart` | 全公司出勤分布圓餅圖 |
| ReportTable | `components/report-table` | 部門出勤明細表 |

## 內容區塊

### 1. 統計卡片區（grid-cols-5 / 響應式 2+3）

| 卡片 | Icon | 主值 | 單位 | 進度環 |
|------|------|------|------|--------|
| 總員工數 | `Users` | total_employees | 人 | 無 |
| 平均出勤率 | `CalendarCheck` | avg_attendance_rate | % | 有 |
| 遲到人次 | `AlertTriangle` | total_late_count | 次 | 無 |
| 請假天數 | `CalendarX` | total_leave_days | 天 | 無 |
| 加班時數 | `Timer` | total_overtime_hours | h | 無 |

### 2. 圖表區（grid-cols-2）

| 圖表 | 類型 | 資料 | 說明 |
|------|------|------|------|
| 部門出勤率比較 | 水平長條圖 | departments[].avg_attendance_rate | 各部門出勤率橫向比較 |
| 全公司出勤分布 | Donut 圓餅圖 | 加總所有部門的各類天數 | 概覽正常/遲到/請假/缺席比例 |

### 3. 部門明細表

使用 `ReportTable`，欄位：

| 欄位 | 來源 | 格式 |
|------|------|------|
| 部門名稱 | department.name | 文字 |
| 人數 | total_members | 數字 |
| 平均出勤率 | avg_attendance_rate | 百分比，條件格式 |
| 遲到人次 | total_late_count | 數字，條件格式 |
| 請假天數 | total_leave_days | 數字 |

摘要行：全公司合計/平均

## 範例程式碼

```tsx
"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout";
import { PageHeader } from "@/components/page-header";
import { MonthPicker } from "@/components/month-picker";
import { StatsCard } from "@/components/stats-card";
import { AttendancePieChart, AttendanceBarChart } from "@/components/attendance-chart";
import { ReportTable } from "@/components/report-table";
import { ColumnDef } from "@tanstack/react-table";
import { SortableHeader } from "@/components/sortable-header";
import {
  Users, CalendarCheck, AlertTriangle, CalendarX, Timer,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchCompanyReport, exportReport } from "@/lib/api/reports";

interface DepartmentReport {
  department: { id: string; name: string };
  total_members: number;
  avg_attendance_rate: number;
  total_late_count: number;
  total_leave_days: number;
}

const deptColumns: ColumnDef<DepartmentReport>[] = [
  {
    accessorKey: "department.name",
    header: ({ column }) => <SortableHeader column={column} title="部門" />,
    cell: ({ row }) => (
      <span className="font-medium">{row.original.department.name}</span>
    ),
  },
  {
    accessorKey: "total_members",
    header: "人數",
    cell: ({ row }) => (
      <span className="text-right font-mono text-sm">{row.original.total_members}</span>
    ),
  },
  {
    accessorKey: "avg_attendance_rate",
    header: ({ column }) => <SortableHeader column={column} title="出勤率" />,
    cell: ({ row }) => {
      const rate = row.original.avg_attendance_rate;
      return (
        <span className={cn(
          "text-right font-mono text-sm",
          rate >= 95 && "text-[hsl(var(--success))] font-medium",
          rate < 90 && "text-destructive font-medium",
          rate >= 90 && rate < 95 && "text-[hsl(var(--warning))] font-medium"
        )}>
          {rate.toFixed(1)}%
        </span>
      );
    },
  },
  {
    accessorKey: "total_late_count",
    header: ({ column }) => <SortableHeader column={column} title="遲到人次" />,
    cell: ({ row }) => {
      const v = row.original.total_late_count;
      return (
        <span className={cn(
          "text-right font-mono text-sm",
          v > 10 && "text-destructive font-medium",
          v > 0 && v <= 10 && "text-[hsl(var(--warning))] font-medium"
        )}>
          {v}
        </span>
      );
    },
  },
  {
    accessorKey: "total_leave_days",
    header: "請假天數",
    cell: ({ row }) => (
      <span className="text-right font-mono text-sm">{row.original.total_leave_days}</span>
    ),
  },
];

export default function CompanyReportPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const { data, isLoading } = useQuery({
    queryKey: ["reports", "company", year, month],
    queryFn: () => fetchCompanyReport(year, month),
  });

  const exportMutation = useMutation({
    mutationFn: (format: "csv" | "xlsx") =>
      exportReport({ year, month, scope: "company", format }),
  });

  const summary = data?.company_summary;
  const departments = data?.departments ?? [];

  return (
    <AppLayout breadcrumbs={[{ label: "報表", href: "/reports" }, { label: "全公司報表" }]}>
      <PageHeader title="全公司出勤報表" description="全公司月出勤統計及部門比較" />

      <div className="mb-6">
        <MonthPicker year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m); }} />
      </div>

      {/* 統計卡片 */}
      <div className="mb-6 grid gap-4 grid-cols-2 lg:grid-cols-5">
        <StatsCard title="總員工數" value={summary?.total_employees ?? 0} unit="人" icon={Users} />
        <StatsCard
          title="平均出勤率"
          value={summary?.avg_attendance_rate ?? 0}
          unit="%"
          icon={CalendarCheck}
          variant={!summary ? "default" : summary.avg_attendance_rate >= 95 ? "success" : summary.avg_attendance_rate >= 90 ? "warning" : "danger"}
          progress={summary?.avg_attendance_rate}
        />
        <StatsCard
          title="遲到人次"
          value={summary?.total_late_count ?? 0}
          unit="次"
          icon={AlertTriangle}
          variant={summary?.total_late_count ? "warning" : "default"}
        />
        <StatsCard title="請假天數" value={summary?.total_leave_days ?? 0} unit="天" icon={CalendarX} />
        <StatsCard title="加班時數" value={summary?.total_overtime_hours ?? 0} unit="h" icon={Timer} />
      </div>

      {/* 圖表 */}
      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <AttendanceBarChart
          title="部門出勤率比較"
          description={`${year} 年 ${month} 月`}
          data={departments.map((d) => ({
            name: d.department.name,
            value: d.avg_attendance_rate,
          }))}
          config={{ value: { label: "出勤率", color: "hsl(var(--primary))" } }}
          layout="vertical"
          unit="%"
        />

        <AttendancePieChart
          title="全公司出勤分布"
          description={`${year} 年 ${month} 月`}
          centerLabel="總員工"
          centerValue={summary?.total_employees ?? 0}
          data={[
            { name: "late", value: summary?.total_late_count ?? 0, color: "--chart-late" },
            { name: "leave", value: summary?.total_leave_days ?? 0, color: "--chart-leave" },
          ].filter((d) => d.value > 0)}
          config={{
            late: { label: "遲到人次", color: "hsl(var(--chart-late))" },
            leave: { label: "請假天數", color: "hsl(var(--chart-leave))" },
          }}
        />
      </div>

      {/* 部門明細 */}
      <ReportTable
        title="部門出勤明細"
        description={`${year} 年 ${month} 月`}
        columns={deptColumns}
        data={departments}
        isLoading={isLoading}
        searchKey="department.name"
        searchPlaceholder="搜尋部門..."
        onExport={(format) => exportMutation.mutate(format)}
        exportLoading={exportMutation.isPending}
        summaryRow={summary ? {
          "department.name": "全公司",
          total_members: summary.total_employees,
          avg_attendance_rate: `${summary.avg_attendance_rate}%`,
          total_late_count: summary.total_late_count,
          total_leave_days: summary.total_leave_days,
        } : undefined}
      />
    </AppLayout>
  );
}
```

## 響應式行為

| 斷點 | Stats Grid | Charts Grid | ReportTable |
|------|-----------|------------|------------|
| >= 1024px (lg) | 5 欄 | 2 欄 | 完整 |
| 640-1023px (sm-lg) | 2 欄 | 1 欄 | 橫向可捲 |
| < 640px | 1 欄 | 1 欄 | 橫向可捲 |
