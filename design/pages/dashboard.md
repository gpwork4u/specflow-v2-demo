# Dashboard

## 對應 Feature

#8 F-001: 打卡 + #6 F-000: 認證系統

## Layout

```
┌──────────────────────────────────────────────────┐
│ Header: [≡] Dashboard              [Avatar ▼]    │
├────────────┬─────────────────────────────────────┤
│ Sidebar    │ Main Content                        │
│            │                                     │
│ Dashboard  │ ┌── PageHeader ──────────────────┐  │
│ > 打卡     │ │ Dashboard                      │  │
│   打卡紀錄 │ │ 歡迎回來，王小明               │  │
│   ─────    │ └────────────────────────────────┘  │
│   員工管理 │                                     │
│   部門管理 │ ┌── Stats Cards (grid-cols-4) ───┐  │
│            │ │ [今日打卡] [準時率] [遲到] [...] │  │
│            │ └────────────────────────────────┘  │
│            │                                     │
│            │ ┌── Quick Actions ────────────────┐ │
│            │ │ [前往打卡]  [查看紀錄]          │ │
│            │ └────────────────────────────────┘  │
│            │                                     │
│            │ ┌── 今日打卡狀態 ─────────────────┐ │
│            │ │ 上班: 09:00:15  下班: --:--:-- │  │
│            │ └────────────────────────────────┘  │
└────────────┴─────────────────────────────────────┘
```

## 頁面規格

| 項目 | 說明 |
|------|------|
| 路由 | `/` |
| 認證 | 需要 |
| Layout | `AppLayout` |
| Breadcrumb | `[Dashboard]` |

## 內容區塊（依角色）

### 員工（employee）

1. **歡迎訊息**：PageHeader "Dashboard"，描述 "歡迎回來，{name}"
2. **今日打卡狀態卡片**：上班時間 / 下班時間 / 今日狀態
3. **快速操作**：前往打卡、查看紀錄

### 主管（manager）

同員工 + 額外：
4. **團隊出勤摘要**：今日出勤人數、遲到人數

### Admin

同主管 + 額外：
5. **全公司統計**：總員工數、今日出勤率、本月遲到率

## 使用的元件

| 元件 | 來源 | 用途 |
|------|------|------|
| AppLayout | `components/layout` | 頁面框架 |
| PageHeader | `components/layout` | 頁面標題 |
| CardStats | `components/card-stats` | 統計卡片 |
| StatusBadge | `components/status-badge` | 打卡狀態標示 |
| Button | shadcn/ui | 快速操作按鈕 |
| Card | shadcn/ui | 今日狀態卡片 |

## 互動行為

1. 頁面載入時呼叫 `GET /api/v1/clock/today` 取得今日打卡狀態
2. Admin 額外呼叫統計 API
3. 卡片數據每 60 秒自動刷新（使用 react-query refetchInterval）
4. 快速操作按鈕導向對應頁面

## 範例程式碼

```tsx
import { AppLayout } from "@/components/layout";
import { PageHeader } from "@/components/page-header";
import { CardStats } from "@/components/card-stats";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Clock,
  CalendarDays,
  Users,
  CheckCircle2,
  AlertTriangle,
  LogIn,
  LogOut,
} from "lucide-react";
import Link from "next/link";

export default function DashboardPage() {
  // const { data: todayStatus } = useQuery(...)
  // const { data: stats } = useQuery(...)

  return (
    <AppLayout breadcrumbs={[{ label: "Dashboard" }]}>
      <PageHeader
        title="Dashboard"
        description={`歡迎回來，${user.name}`}
      />

      {/* 統計卡片 — Admin 看到全部，員工看到個人 */}
      {user.role === "admin" && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <CardStats title="今日出勤" value={42} icon={Users} />
          <CardStats title="準時率" value="95%" icon={CheckCircle2} />
          <CardStats title="遲到人數" value={2} icon={AlertTriangle} />
          <CardStats title="總員工數" value={50} icon={Users} />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* 今日打卡狀態 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">今日打卡狀態</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <LogIn className="h-4 w-4 text-muted-foreground" />
                <span>上班打卡</span>
              </div>
              <span className="font-medium">
                {todayStatus?.clock_in
                  ? format(new Date(todayStatus.clock_in), "HH:mm:ss")
                  : "--:--:--"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <LogOut className="h-4 w-4 text-muted-foreground" />
                <span>下班打卡</span>
              </div>
              <span className="font-medium">
                {todayStatus?.clock_out
                  ? format(new Date(todayStatus.clock_out), "HH:mm:ss")
                  : "--:--:--"}
              </span>
            </div>
            {todayStatus?.status && (
              <div className="flex items-center justify-between">
                <span className="text-sm">狀態</span>
                <StatusBadge type="attendance" value={todayStatus.status} />
              </div>
            )}
          </CardContent>
        </Card>

        {/* 快速操作 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">快速操作</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <Button asChild variant="outline" className="h-auto flex-col gap-2 py-6">
              <Link href="/clock">
                <Clock className="h-8 w-8 text-primary" />
                <span>前往打卡</span>
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-auto flex-col gap-2 py-6">
              <Link href="/clock/records">
                <CalendarDays className="h-8 w-8 text-primary" />
                <span>查看紀錄</span>
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
```

## 響應式行為

| 斷點 | Stats Grid | 內容 Grid |
|------|-----------|----------|
| >= 1024px (lg) | 4 欄 | 2 欄 |
| 640-1023px (sm-lg) | 2 欄 | 1 欄 |
| < 640px | 1 欄 | 1 欄 |
