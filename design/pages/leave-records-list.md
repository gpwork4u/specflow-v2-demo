# 請假紀錄列表

## 對應 Feature

#17 F-002: 請假申請

## Layout

```
┌──────────────────────────────────────────────────────┐
│ Header: [≡] 請假紀錄                   [Avatar ▼]    │
├────────────┬─────────────────────────────────────────┤
│ Sidebar    │ Main Content                            │
│            │                                         │
│ Dashboard  │ ┌── PageHeader ──────────────────────┐  │
│ 打卡       │ │ 我的請假紀錄            [+ 請假]   │  │
│ ─────      │ │ 查看所有請假申請紀錄               │  │
│ 請假申請   │ └────────────────────────────────────┘  │
│ > 請假紀錄 │                                         │
│   額度總覽 │ ┌── Filters ─────────────────────────┐  │
│            │ │ [狀態 ▼] [假別 ▼] [日期範圍 📅]    │  │
│            │ └────────────────────────────────────┘  │
│            │                                         │
│            │ ┌── DataTable ───────────────────────┐  │
│            │ │ | 假別 | 日期     | 時數 | 狀態   | │  │
│            │ │ |------|----------|------|--------|  │  │
│            │ │ |[特休]|04/10~14 |36h  |[待審核]| │  │
│            │ │ |[事假]|04/01    | 4h  |[已核准]| │  │
│            │ │ |[病假]|03/28    | 8h  |[已駁回]| │  │
│            │ │                                    │  │
│            │ │ [< 1 2 3 >]                       │  │
│            │ └────────────────────────────────────┘  │
│            │                                         │
│            │ (空狀態: EmptyState "尚無請假紀錄")      │
└────────────┴─────────────────────────────────────────┘
```

## 頁面規格

| 項目 | 說明 |
|------|------|
| 路由 | `/leaves` |
| 認證 | 需要（任何角色） |
| Layout | `AppLayout` |
| Breadcrumb | `[請假管理] > [請假紀錄]` |

## API 呼叫

| 時機 | API | 用途 |
|------|-----|------|
| 頁面載入 / 篩選變更 | `GET /api/v1/leaves` | 取得請假紀錄 |
| 取消請假 | `PUT /api/v1/leaves/:id/cancel` | 取消請假單 |

## 篩選器

| 篩選項 | 元件 | 預設值 |
|--------|------|--------|
| 狀態 | `Select` multi=false | 全部 |
| 假別 | `Select` multi=false | 全部 |
| 日期範圍 | `DateRangePicker`（簡化版，僅日期） | 近 3 個月 |

## DataTable 欄位

| 欄位 | 寬度 | 內容 | 排序 |
|------|------|------|------|
| 假別 | 100px | `LeaveTypeBadge` | 否 |
| 日期 | 180px | start_date ~ end_date + 半天標記 | 是 (預設降序) |
| 時數 | 80px | `{hours}h ({hours/8}天)` | 是 |
| 原因 | flex | `line-clamp-1` | 否 |
| 狀態 | 100px | `LeaveStatusBadge` | 是 |
| 申請時間 | 130px | `yyyy/MM/dd HH:mm` | 是 |
| 操作 | 80px | 取消按鈕 / 查看按鈕 | 否 |

## 操作欄邏輯

| 狀態 | 操作 |
|------|------|
| `pending` | [取消] 按鈕 + [查看] 連結 |
| `approved` 且 start_date > today | [取消] 按鈕 + [查看] 連結 |
| `approved` 且 start_date <= today | [查看] 連結 |
| `rejected` | [查看] 連結 |
| `cancelled` | [查看] 連結 |

取消按鈕點擊後出現 ConfirmDialog。

## 範例程式碼

```tsx
import { AppLayout } from "@/components/layout";
import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { LeaveTypeBadge } from "@/components/leave-type-badge";
import { LeaveStatusBadge } from "@/components/leave-status-badge";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Eye, XCircle } from "lucide-react";
import { format, parseISO, isAfter } from "date-fns";
import Link from "next/link";
import { ColumnDef } from "@tanstack/react-table";

const columns: ColumnDef<LeaveRecord>[] = [
  {
    accessorKey: "leave_type",
    header: "假別",
    cell: ({ row }) => <LeaveTypeBadge leaveType={row.original.leave_type} />,
  },
  {
    accessorKey: "start_date",
    header: "日期",
    cell: ({ row }) => {
      const { start_date, end_date, start_half, end_half } = row.original;
      const start = format(parseISO(start_date), "MM/dd");
      const end = format(parseISO(end_date), "MM/dd");
      const halfStr = (h: string) =>
        h === "morning" ? "(上午)" : h === "afternoon" ? "(下午)" : "";
      return start_date === end_date
        ? `${start} ${halfStr(start_half)}`
        : `${start} ${halfStr(start_half)} ~ ${end} ${halfStr(end_half)}`;
    },
  },
  {
    accessorKey: "hours",
    header: "時數",
    cell: ({ row }) => (
      <span className="font-mono text-sm">
        {row.original.hours}h ({row.original.hours / 8}天)
      </span>
    ),
  },
  {
    accessorKey: "reason",
    header: "原因",
    cell: ({ row }) => (
      <span className="line-clamp-1 text-sm text-muted-foreground">
        {row.original.reason}
      </span>
    ),
  },
  {
    accessorKey: "status",
    header: "狀態",
    cell: ({ row }) => <LeaveStatusBadge status={row.original.status} />,
  },
  {
    accessorKey: "created_at",
    header: "申請時間",
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {format(parseISO(row.original.created_at), "yyyy/MM/dd HH:mm")}
      </span>
    ),
  },
  {
    id: "actions",
    header: "",
    cell: ({ row }) => {
      const { id, status, start_date } = row.original;
      const canCancel =
        status === "pending" ||
        (status === "approved" && isAfter(parseISO(start_date), new Date()));

      return (
        <div className="flex gap-1">
          {canCancel && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={() => handleCancelClick(id)}
            >
              <XCircle className="h-4 w-4" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
            <Link href={`/leaves/${id}`}>
              <Eye className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      );
    },
  },
];

export default function LeaveRecordsPage() {
  return (
    <AppLayout breadcrumbs={[{ label: "請假管理" }, { label: "請假紀錄" }]}>
      <PageHeader
        title="我的請假紀錄"
        description="查看所有請假申請紀錄"
        actions={
          <Button asChild>
            <Link href="/leaves/new">
              <Plus className="mr-2 h-4 w-4" />
              請假申請
            </Link>
          </Button>
        }
      />

      {/* 篩選器 */}
      <div className="mb-4 flex flex-wrap gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="狀態" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部狀態</SelectItem>
            <SelectItem value="pending">待審核</SelectItem>
            <SelectItem value="approved">已核准</SelectItem>
            <SelectItem value="rejected">已駁回</SelectItem>
            <SelectItem value="cancelled">已取消</SelectItem>
          </SelectContent>
        </Select>

        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="假別" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部假別</SelectItem>
            <SelectItem value="annual">特休</SelectItem>
            <SelectItem value="personal">事假</SelectItem>
            <SelectItem value="sick">病假</SelectItem>
            {/* ... */}
          </SelectContent>
        </Select>
      </div>

      {/* 表格 */}
      <DataTable
        columns={columns}
        data={leaves?.data || []}
        pagination={leaves?.meta}
        onPageChange={setPage}
        emptyState={
          <EmptyState
            icon="calendar"
            title="尚無請假紀錄"
            description="點擊右上角按鈕申請請假"
          />
        }
      />

      {/* 取消確認 Dialog */}
      <ConfirmDialog
        open={showCancelDialog}
        onOpenChange={setShowCancelDialog}
        title="取消請假"
        description="確定要取消這筆請假申請嗎？取消後額度將會退還。"
        confirmLabel="確定取消"
        variant="destructive"
        onConfirm={handleCancel}
        isLoading={isCancelling}
      />
    </AppLayout>
  );
}
```

## 響應式行為

| 斷點 | 變化 |
|------|------|
| >= 1024px (lg) | 完整表格顯示 |
| 768-1023px (md) | 隱藏「原因」和「申請時間」欄 |
| < 768px | 改為 Card 列表模式（每筆一張 Card） |

### Mobile Card 模式

```
┌──────────────────────────────┐
│ [特休]  [待審核]             │
│ 2026/04/10 ~ 04/14  36h     │
│ 出國旅遊                     │
│ 2026/04/07 10:00    [取消]   │
└──────────────────────────────┘
```

## 使用的元件

| 元件 | 來源 |
|------|------|
| AppLayout, PageHeader | `components/layout` |
| DataTable | `components/data-table` |
| LeaveTypeBadge | `components/leave-type-badge` |
| LeaveStatusBadge | `components/leave-status-badge` |
| ConfirmDialog | `components/confirm-dialog` |
| EmptyState | `components/empty-state` |
| Select | shadcn/ui |
| Button | shadcn/ui |
