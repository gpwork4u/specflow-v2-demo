# 團隊報表

## 對應 Feature

#22 F-005: 出席報表/統計

## Layout

```
┌──────────────────────────────────────────────────┐
│ Header: [=] 報表 > 團隊報表          [Avatar v]   │
├────────────┬─────────────────────────────────────┤
│ Sidebar    │ Main Content                        │
│            │                                     │
│ Dashboard  │ ┌── PageHeader ──────────────────┐  │
│ 打卡       │ │ 團隊報表           [部門選擇 v]│  │
│ 打卡紀錄   │ │ 查看團隊的月出勤統計           │  │
│ ─────      │ └────────────────────────────────┘  │
│ 行事曆     │                                     │
│ ─────      │ ┌── MonthPicker ─────────────────┐  │
│ 報表       │ │ [<]  2026 年 4 月  [>]         │  │
│   個人     │ └────────────────────────────────┘  │
│ > 團隊     │                                     │
│   全公司   │ ┌── StatsCards (grid-cols-4) ─────┐ │
│            │ │ [平均出勤率] [總人數] [遲到] [請假]│ │
│            │ │   95.5%       10     5次   12天  │ │
│            │ └────────────────────────────────┘  │
│            │                                     │
│            │ ┌── ReportTable ──────────────────┐ │
│            │ │ 團隊出勤明細       [匯出 ▼]     │ │
│            │ │ [搜尋員工...]                    │ │
│            │ │────────────────────────────────  │ │
│            │ │ 編號 │ 姓名 │ 出勤 │ 遲到│ 出勤率│ │
│            │ │ ...  │ ...  │ ... │ ... │ ...  │ │
│            │ │────────────────────────────────  │ │
│            │ │ 合計/平均 ...                    │ │
│            │ └────────────────────────────────┘  │
└────────────┴─────────────────────────────────────┘
```

## 頁面規格

| 項目 | 說明 |
|------|------|
| 路由 | `/reports/team` |
| 認證 | 需要（manager, admin） |
| 權限 | employee 導向 403 |
| Layout | `AppLayout` |
| Breadcrumb | `[報表, 團隊報表]` |

## API 呼叫

| API | 時機 | 說明 |
|-----|------|------|
| `GET /api/v1/reports/team?year={y}&month={m}&department_id={id}` | 頁面載入、月份/部門切換 | 取得團隊報表 |
| `GET /api/v1/reports/export?year={y}&month={m}&scope=team&format={f}` | 點擊匯出 | 下載報表檔案 |
| `GET /api/v1/departments` | 頁面載入（Admin） | 部門列表 |

## 使用的元件

| 元件 | 來源 | 用途 |
|------|------|------|
| AppLayout | `components/layout` | 頁面框架 |
| PageHeader | `components/layout` | 頁面標題 + 部門選擇 |
| MonthPicker | `components/month-picker` | 月份切換 |
| StatsCard | `components/stats-card` | 團隊摘要統計卡片 |
| ReportTable | `components/report-table` | 成員出勤明細表 |
| Select | shadcn/ui | 部門切換（Admin） |

## 內容區塊

### 1. 統計卡片區

| 卡片 | 主值 | 來源 | 進度環 |
|------|------|------|--------|
| 平均出勤率 | avg_attendance_rate | team_summary | 有 |
| 總人數 | total_members | team_summary | 無 |
| 遲到人次 | total_late_count | team_summary | 無 |
| 請假天數 | total_leave_days | team_summary | 無 |

### 2. 報表表格

使用 `ReportTable` 搭配 `teamReportColumns` 欄位定義。

欄位：員工編號、姓名、出勤天數、缺席、遲到、早退、請假、加班(h)、出勤率

功能：
- 可依姓名搜尋
- 可依出勤率、遲到等欄位排序
- 摘要行顯示合計/平均
- 匯出 CSV / XLSX

## 範例程式碼

```tsx
"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout";
import { PageHeader } from "@/components/page-header";
import { MonthPicker } from "@/components/month-picker";
import { StatsCard } from "@/components/stats-card";
import { ReportTable } from "@/components/report-table";
import { teamReportColumns } from "@/components/columns/team-report-columns";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  CalendarCheck, Users, AlertTriangle, CalendarX,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { fetchTeamReport, exportReport } from "@/lib/api/reports";
import { fetchDepartments } from "@/lib/api/departments";

export default function TeamReportPage() {
  const { user } = useAuth();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [departmentId, setDepartmentId] = useState<string | undefined>(
    user.role === "admin" ? undefined : user.department_id
  );

  const { data: departments } = useQuery({
    queryKey: ["departments"],
    queryFn: fetchDepartments,
    enabled: user.role === "admin",
  });

  const { data, isLoading } = useQuery({
    queryKey: ["reports", "team", year, month, departmentId],
    queryFn: () => fetchTeamReport(year, month, departmentId),
    enabled: !!departmentId || user.role === "manager",
  });

  const exportMutation = useMutation({
    mutationFn: (format: "csv" | "xlsx") =>
      exportReport({ year, month, scope: "team", department_id: departmentId, format }),
  });

  const summary = data?.team_summary;

  return (
    <AppLayout breadcrumbs={[{ label: "報表", href: "/reports" }, { label: "團隊報表" }]}>
      <PageHeader
        title="團隊報表"
        description="查看團隊的月出勤統計"
        actions={
          user.role === "admin" && departments ? (
            <Select value={departmentId} onValueChange={setDepartmentId}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="選擇部門" />
              </SelectTrigger>
              <SelectContent>
                {departments.map((dept) => (
                  <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : undefined
        }
      />

      <div className="mb-6">
        <MonthPicker year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m); }} />
      </div>

      {/* 統計卡片 */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="平均出勤率"
          value={summary?.avg_attendance_rate ?? 0}
          unit="%"
          icon={CalendarCheck}
          variant={!summary ? "default" : summary.avg_attendance_rate >= 95 ? "success" : summary.avg_attendance_rate >= 90 ? "warning" : "danger"}
          progress={summary?.avg_attendance_rate}
        />
        <StatsCard title="總人數" value={summary?.total_members ?? 0} unit="人" icon={Users} />
        <StatsCard
          title="遲到人次"
          value={summary?.total_late_count ?? 0}
          unit="次"
          icon={AlertTriangle}
          variant={summary?.total_late_count ? "warning" : "default"}
        />
        <StatsCard title="請假天數" value={summary?.total_leave_days ?? 0} unit="天" icon={CalendarX} />
      </div>

      {/* 報表表格 */}
      <ReportTable
        title="團隊出勤明細"
        description={`${year} 年 ${month} 月 — ${data?.department?.name ?? ""}`}
        columns={teamReportColumns}
        data={data?.members ?? []}
        isLoading={isLoading}
        searchKey="name"
        searchPlaceholder="搜尋員工..."
        onExport={(format) => exportMutation.mutate(format)}
        exportLoading={exportMutation.isPending}
        summaryRow={summary ? {
          employee_id: "合計/平均",
          name: `${summary.total_members} 人`,
          present_days: "-",
          absent_days: "-",
          late_days: summary.total_late_count,
          early_leave_days: "-",
          leave_days: summary.total_leave_days,
          overtime_hours: "-",
          attendance_rate: `${summary.avg_attendance_rate}%`,
        } : undefined}
      />
    </AppLayout>
  );
}
```

## 響應式行為

| 斷點 | Stats Grid | ReportTable |
|------|-----------|------------|
| >= 1024px (lg) | 4 欄 | 完整欄位 |
| 640-1023px (sm-lg) | 2 欄 | 橫向可捲 |
| < 640px | 1 欄 | 橫向可捲 |
