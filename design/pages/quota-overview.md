# 個人額度總覽

## 對應 Feature

#16 F-009: 假別額度管理

## Layout

```
┌──────────────────────────────────────────────────────┐
│ Header: [≡] 額度總覽                  [Avatar ▼]      │
├────────────┬─────────────────────────────────────────┤
│ Sidebar    │ Main Content                            │
│            │                                         │
│            │ ┌── PageHeader ──────────────────────┐  │
│            │ │ 假別額度總覽        [年度: 2026 ▼] │  │
│            │ │ 查看各假別的使用狀況               │  │
│            │ └────────────────────────────────────┘  │
│            │                                         │
│            │ ┌── Summary Cards (grid-cols-3) ─────┐  │
│            │ │ [總假天數] [已使用]  [剩餘]        │  │
│            │ │   45 天     5 天     40 天          │  │
│            │ └────────────────────────────────────┘  │
│            │                                         │
│            │ ┌── Quota List ──────────────────────┐  │
│            │ │                                    │  │
│            │ │ [棕] 特休                 剩餘 8 天 │  │
│            │ │ ████████░░░░░░░░░░░░░░░░░░░░░░░░  │  │
│            │ │ 已用 2 天 / 總計 10 天              │  │
│            │ │                                    │  │
│            │ │ [箱] 事假                 剩餘 7 天 │  │
│            │ │ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │  │
│            │ │ 已用 0 天 / 總計 7 天               │  │
│            │ │                                    │  │
│            │ │ [溫] 病假                剩餘 29 天 │  │
│            │ │ █░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │  │
│            │ │ 已用 1 天 / 總計 30 天              │  │
│            │ │                                    │  │
│            │ │ ... 其他假別                        │  │
│            │ └────────────────────────────────────┘  │
│            │                                         │
│            │              [前往請假申請]               │
└────────────┴─────────────────────────────────────────┘
```

## 頁面規格

| 項目 | 說明 |
|------|------|
| 路由 | `/leaves/quota` |
| 認證 | 需要（任何角色） |
| Layout | `AppLayout` |
| Breadcrumb | `[請假管理] > [額度總覽]` |

## API 呼叫

| 時機 | API | 用途 |
|------|-----|------|
| 頁面載入 / 年度切換 | `GET /api/v1/leave-quotas/me?year={year}` | 取得額度 |

## 內容區塊

### 1. 年度選擇器

- 位於 PageHeader 右側
- `Select` 元件，選項：當年 + 前一年
- 切換時重新載入額度資料

### 2. Summary Cards

三張 `CardStats` 統計卡：

| 卡片 | 值 | Icon | 說明 |
|------|---|------|------|
| 總假天數 | sum(total_hours) / 8 | `Calendar` | 排除公假 |
| 已使用 | sum(used_hours) / 8 | `CalendarCheck` | |
| 剩餘 | sum(remaining_hours) / 8 | `CalendarClock` | |

### 3. Quota List

使用 `QuotaProgressBar` 元件列表顯示每個假別。

- size="lg"
- 排序：有額度的在前，公假（無上限）在最後
- 公假特殊處理：不顯示進度條，顯示 "無上限"

## 範例程式碼

```tsx
import { useState } from "react";
import { AppLayout } from "@/components/layout";
import { PageHeader } from "@/components/page-header";
import { CardStats } from "@/components/card-stats";
import { QuotaProgressBar } from "@/components/quota-progress-bar";
import { LoadingState } from "@/components/loading-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Calendar, CalendarCheck, CalendarClock, Plus, Infinity,
} from "lucide-react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

export default function QuotaOverviewPage() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);

  const { data, isLoading } = useQuery({
    queryKey: ["leave-quotas", "me", year],
    queryFn: () =>
      fetch(`/api/v1/leave-quotas/me?year=${year}`).then((r) => r.json()),
  });

  if (isLoading) {
    return (
      <AppLayout breadcrumbs={[{ label: "請假管理" }, { label: "額度總覽" }]}>
        <LoadingState />
      </AppLayout>
    );
  }

  const quotas = data?.quotas || [];
  const regularQuotas = quotas.filter((q: any) => q.leave_type !== "official");
  const totalDays = regularQuotas.reduce((s: number, q: any) => s + q.total_hours, 0) / 8;
  const usedDays = regularQuotas.reduce((s: number, q: any) => s + q.used_hours, 0) / 8;
  const remainDays = totalDays - usedDays;

  return (
    <AppLayout breadcrumbs={[{ label: "請假管理" }, { label: "額度總覽" }]}>
      <PageHeader
        title="假別額度總覽"
        description="查看各假別的使用狀況"
        actions={
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={String(currentYear)}>{currentYear} 年</SelectItem>
              <SelectItem value={String(currentYear - 1)}>{currentYear - 1} 年</SelectItem>
            </SelectContent>
          </Select>
        }
      />

      {/* Summary Cards */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <CardStats title="總假天數" value={`${totalDays} 天`} icon={Calendar} />
        <CardStats title="已使用" value={`${usedDays} 天`} icon={CalendarCheck} />
        <CardStats title="剩餘" value={`${remainDays} 天`} icon={CalendarClock} />
      </div>

      {/* Quota List */}
      <Card>
        <CardContent className="divide-y p-6">
          {quotas.map((quota: any) =>
            quota.leave_type === "official" ? (
              <div key="official" className="flex items-center justify-between py-4">
                <LeaveTypeBadge leaveType="official" />
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Infinity className="h-4 w-4" />
                  <span>無上限</span>
                </div>
              </div>
            ) : (
              <div key={quota.leave_type} className="py-4">
                <QuotaProgressBar
                  leaveType={quota.leave_type}
                  totalHours={quota.total_hours}
                  usedHours={quota.used_hours}
                  size="lg"
                />
              </div>
            )
          )}
        </CardContent>
      </Card>

      {/* 快速操作 */}
      <div className="mt-6 flex justify-center">
        <Button asChild>
          <Link href="/leaves/new">
            <Plus className="mr-2 h-4 w-4" />
            前往請假申請
          </Link>
        </Button>
      </div>
    </AppLayout>
  );
}
```

## 響應式行為

| 斷點 | Summary Grid | Quota List |
|------|-------------|------------|
| >= 640px (sm) | 3 欄 | 正常 |
| < 640px | 1 欄（堆疊） | 正常（全寬） |

## 使用的元件

| 元件 | 來源 |
|------|------|
| AppLayout, PageHeader | `components/layout` |
| CardStats | `components/card-stats` |
| QuotaProgressBar | `components/quota-progress-bar` |
| LeaveTypeBadge | `components/leave-type-badge` |
| Card | shadcn/ui |
| Select | shadcn/ui |
| Button | shadcn/ui |
| LoadingState | `components/loading-state` |
