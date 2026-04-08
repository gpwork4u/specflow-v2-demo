# 團隊行事曆頁

## 對應 Feature

#21 F-004: 行事曆檢視

## Layout

```
┌──────────────────────────────────────────────────┐
│ Header: [=] 行事曆 > 團隊行事曆     [Avatar v]   │
├────────────┬─────────────────────────────────────┤
│ Sidebar    │ Main Content                        │
│            │                                     │
│ Dashboard  │ ┌── PageHeader ──────────────────┐  │
│ 打卡       │ │ 團隊行事曆         [部門選擇 v]│  │
│ 打卡紀錄   │ │ 查看團隊成員的月出勤狀況       │  │
│ ─────      │ └────────────────────────────────┘  │
│ 行事曆     │                                     │
│   個人     │ ┌── MonthPicker ─────────────────┐  │
│ > 團隊     │ │ [<]  2026 年 4 月  [>]         │  │
│ ─────      │ └────────────────────────────────┘  │
│ 報表       │                                     │
│            │ ┌── TeamCalendarGrid ─────────────┐ │
│            │ │ 成員     │ 1 │ 2 │ 3 │...│30│31│ │
│            │ │          │ 三│ 四│ 五│   │  │  │ │
│            │ │──────────┼───┼───┼───┼   ┼──┼──│ │
│            │ │ EMP001   │ ■ │ ■ │ ■ │...│  │  │ │
│            │ │ 王小明   │   │   │   │   │  │  │ │
│            │ │ EMP002   │ ■ │ ■ │ ■ │...│  │  │ │
│            │ │ 李小華   │   │   │   │   │  │  │ │
│            │ │──────────────────────────────── │ │
│            │ │ ■正常 ■遲到 ■請假 ■缺席 ■加班  │ │
│            │ └────────────────────────────────┘  │
└────────────┴─────────────────────────────────────┘
```

## 頁面規格

| 項目 | 說明 |
|------|------|
| 路由 | `/calendar/team` |
| 認證 | 需要（manager, admin） |
| 權限 | employee 會導向 403 |
| Layout | `AppLayout` |
| Breadcrumb | `[行事曆, 團隊行事曆]` |

## API 呼叫

| API | 時機 | 說明 |
|-----|------|------|
| `GET /api/v1/calendar/team?year={y}&month={m}&department_id={id}` | 頁面載入、月份/部門切換 | 取得團隊出勤資料 |
| `GET /api/v1/departments` | 頁面載入（Admin 用） | 取得部門列表（部門選擇器） |

## 使用的元件

| 元件 | 來源 | 用途 |
|------|------|------|
| AppLayout | `components/layout` | 頁面框架 |
| PageHeader | `components/layout` | 頁面標題 + 部門選擇 |
| MonthPicker | `components/month-picker` | 月份切換 |
| TeamCalendarGrid | `components/team-calendar-grid` | 團隊出勤表格 |
| Select | shadcn/ui | 部門切換（Admin 限定） |

## 互動行為

1. 頁面載入時以當前年月呼叫 API
2. Manager：自動帶入自己部門，無部門切換
3. Admin：顯示部門選擇 Select，可切換查看不同部門
4. 使用 MonthPicker 切換月份
5. 點擊成員名稱可導向該成員的個人報表（Admin 功能）
6. 點擊狀態方塊顯示 Tooltip 詳情
7. 表格日期欄可橫向捲動，成員欄 sticky
8. Loading 狀態：TeamCalendarGrid 顯示 Skeleton

## 範例程式碼

```tsx
"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout";
import { PageHeader } from "@/components/page-header";
import { MonthPicker } from "@/components/month-picker";
import { TeamCalendarGrid } from "@/components/team-calendar-grid";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { fetchTeamCalendar } from "@/lib/api/calendar";
import { fetchDepartments } from "@/lib/api/departments";

export default function TeamCalendarPage() {
  const { user } = useAuth();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [departmentId, setDepartmentId] = useState<string | undefined>(
    user.role === "admin" ? undefined : user.department_id
  );

  // Admin: 取得部門列表
  const { data: departments } = useQuery({
    queryKey: ["departments"],
    queryFn: fetchDepartments,
    enabled: user.role === "admin",
  });

  // 取得團隊行事曆
  const { data, isLoading } = useQuery({
    queryKey: ["calendar", "team", year, month, departmentId],
    queryFn: () => fetchTeamCalendar(year, month, departmentId),
    enabled: !!departmentId || user.role === "manager",
  });

  return (
    <AppLayout breadcrumbs={[{ label: "行事曆", href: "/calendar" }, { label: "團隊行事曆" }]}>
      <PageHeader
        title="團隊行事曆"
        description="查看團隊成員的月出勤狀況"
        actions={
          user.role === "admin" && departments ? (
            <Select
              value={departmentId}
              onValueChange={setDepartmentId}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="選擇部門" />
              </SelectTrigger>
              <SelectContent>
                {departments.map((dept) => (
                  <SelectItem key={dept.id} value={dept.id}>
                    {dept.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : undefined
        }
      />

      {/* 月份選擇 */}
      <div className="mb-4">
        <MonthPicker
          year={year}
          month={month}
          onChange={(y, m) => {
            setYear(y);
            setMonth(m);
          }}
        />
      </div>

      {/* 團隊行事曆 */}
      <TeamCalendarGrid
        year={year}
        month={month}
        department={data?.department ?? { id: "", name: "" }}
        members={data?.members ?? []}
        isLoading={isLoading}
        onMemberClick={(member) => {
          // Admin 可查看成員個人報表
          if (user.role === "admin") {
            window.location.href = `/reports/personal?user_id=${member.user.id}&year=${year}&month=${month}`;
          }
        }}
      />
    </AppLayout>
  );
}
```

## 響應式行為

| 斷點 | 行為 |
|------|------|
| >= 1280px (xl) | 完整表格可見 |
| 768-1279px | 成員欄 sticky，日期欄橫向捲動 |
| < 768px | 同上，頁面底部提示「橫向滑動查看更多日期」 |
