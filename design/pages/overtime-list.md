# 加班紀錄列表

## 對應 Feature

#30 F-006: 加班申請

## Layout

```
+------------------------------------------------------+
| Header: [=] 加班紀錄                     [Avatar v]    |
+------------+-----------------------------------------+
| Sidebar    | Main Content                            |
|            |                                         |
| Dashboard  | +-- PageHeader ----------------------+  |
| 打卡       | | 我的加班紀錄            [+ 加班申請]|  |
| -----      | | 查看所有加班申請紀錄               |  |
| 請假管理   | +------------------------------------+  |
| -----      |                                         |
| 加班申請   | +-- Filters --------------------------+  |
| > 加班紀錄 | | [狀態 v]  [日期範圍 日曆]            |  |
| -----      | +------------------------------------+  |
| 補打卡管理 |                                         |
| -----      | +-- DataTable ----------------------+  |
| (主管)     | | | 日期    | 時間      | 時數 | 原因 | |  |
| 待審核     | | |---------|-----------|------|------| |  |
| -----      | | | 04/07   | 18:00~21  | 3.0h |趕案  | |  |
| 通知中心   | | | 04/05   | 18:00~20  | 2.0h |會議  | |  |
|            | | | 04/01   | 19:00~22  | 3.0h |部署  | |  |
|            | |                                    |  |
|            | | [< 1 2 3 >]                       |  |
|            | +------------------------------------+  |
|            |                                         |
|            | (空狀態: EmptyState "尚無加班紀錄")      |
+------------+-----------------------------------------+
```

## 頁面規格

| 項目 | 說明 |
|------|------|
| 路由 | `/overtime` |
| 認證 | 需要（任何角色） |
| Layout | `AppLayout` |
| Breadcrumb | `[加班管理] > [加班紀錄]` |

## API 呼叫

| 時機 | API | 用途 |
|------|-----|------|
| 頁面載入 / 篩選變更 | `GET /api/v1/overtime` | 取得加班紀錄 |
| 取消加班 | `PUT /api/v1/overtime/:id/cancel` | 取消加班申請 |

## 篩選器

| 篩選項 | 元件 | 預設值 |
|--------|------|--------|
| 狀態 | `Select` | 全部 |
| 日期範圍 | `DateRangePicker`（簡化版） | 近 3 個月 |

## DataTable 欄位

| 欄位 | 寬度 | 內容 | 排序 |
|------|------|------|------|
| 日期 | 120px | `yyyy/MM/dd` | 是（預設降序） |
| 時間 | 150px | `start_time ~ end_time` | 否 |
| 時數 | 80px | `{hours}h`，`font-mono text-primary` | 是 |
| 原因 | flex | `line-clamp-1 text-muted-foreground` | 否 |
| 狀態 | 100px | `StatusBadge` | 是 |
| 申請時間 | 130px | `yyyy/MM/dd HH:mm` | 是 |
| 操作 | 80px | 取消/查看按鈕 | 否 |

## 狀態 Badge 定義

| Status | 標籤 | 顏色 |
|--------|------|------|
| `pending` | 待審核 | Amber |
| `approved` | 已核准 | Green |
| `rejected` | 已駁回 | Red |
| `cancelled` | 已取消 | Gray |

## 操作欄邏輯

| 狀態 | 操作 |
|------|------|
| `pending` | [取消] 按鈕 + [查看] 連結 |
| `approved` | [查看] 連結 |
| `rejected` | [查看] 連結 |
| `cancelled` | [查看] 連結 |

取消按鈕點擊後出現 ConfirmDialog：「確定要取消這筆加班申請嗎？」

## 範例程式碼

```tsx
import { useState } from "react";
import { AppLayout } from "@/components/layout";
import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Eye, XCircle } from "lucide-react";
import { format, parseISO } from "date-fns";
import Link from "next/link";
import { ColumnDef } from "@tanstack/react-table";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/use-toast";

const overtimeStatusConfig = {
  pending: {
    label: "待審核",
    className: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  },
  approved: {
    label: "已核准",
    className: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400",
  },
  rejected: {
    label: "已駁回",
    className: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
  },
  cancelled: {
    label: "已取消",
    className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
  },
} as const;

interface OvertimeRecord {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  hours: number;
  reason: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  created_at: string;
}

const columns: ColumnDef<OvertimeRecord>[] = [
  {
    accessorKey: "date",
    header: "日期",
    cell: ({ row }) => (
      <span className="text-sm font-medium">
        {format(parseISO(row.original.date), "yyyy/MM/dd")}
      </span>
    ),
  },
  {
    id: "time_range",
    header: "時間",
    cell: ({ row }) => (
      <span className="text-sm">
        {row.original.start_time} ~ {row.original.end_time}
      </span>
    ),
  },
  {
    accessorKey: "hours",
    header: "時數",
    cell: ({ row }) => (
      <span className="font-mono text-sm text-primary">
        {row.original.hours}h
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
    cell: ({ row }) => {
      const config = overtimeStatusConfig[row.original.status];
      return (
        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${config.className}`}>
          {config.label}
        </span>
      );
    },
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
      const { id, status } = row.original;
      return (
        <div className="flex gap-1">
          {status === "pending" && (
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
            <Link href={`/overtime/${id}`}>
              <Eye className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      );
    },
  },
];

export default function OvertimeListPage() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: overtimeData, isLoading } = useQuery({
    queryKey: ["overtime", statusFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      return fetch(`/api/v1/overtime?${params}`).then((r) => r.json());
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/v1/overtime/${id}/cancel`, { method: "PUT" }).then((r) => {
        if (!r.ok) throw r;
        return r.json();
      }),
    onSuccess: () => {
      toast({ title: "已取消加班申請" });
      queryClient.invalidateQueries({ queryKey: ["overtime"] });
    },
    onError: () => {
      toast({ title: "取消失敗", description: "請稍後再試", variant: "destructive" });
    },
  });

  return (
    <AppLayout breadcrumbs={[{ label: "加班管理" }, { label: "加班紀錄" }]}>
      <PageHeader
        title="我的加班紀錄"
        description="查看所有加班申請紀錄"
        actions={
          <Button asChild>
            <Link href="/overtime/new">
              <Plus className="mr-2 h-4 w-4" />
              加班申請
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
      </div>

      {/* 表格 */}
      <DataTable
        columns={columns}
        data={overtimeData?.data || []}
        pagination={overtimeData?.meta}
        emptyState={
          <EmptyState
            icon="clock"
            title="尚無加班紀錄"
            description="點擊右上角按鈕申請加班"
          />
        }
      />

      {/* 取消確認 Dialog */}
      <ConfirmDialog
        open={!!cancelTarget}
        onOpenChange={(open) => !open && setCancelTarget(null)}
        title="取消加班申請"
        description="確定要取消這筆加班申請嗎？"
        confirmLabel="確定取消"
        variant="destructive"
        onConfirm={async () => {
          if (cancelTarget) await cancelMutation.mutateAsync(cancelTarget);
          setCancelTarget(null);
        }}
        isLoading={cancelMutation.isPending}
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
| < 768px | 改為 Card 列表模式 |

### Mobile Card 模式

```
+------------------------------+
| 2026/04/07        [待審核]   |
| 18:00 ~ 21:00    3.0h       |
| 趕專案 deadline              |
| 2026/04/07 10:00    [取消]   |
+------------------------------+
```

## 使用的元件

| 元件 | 來源 |
|------|------|
| AppLayout, PageHeader | `components/layout` |
| DataTable | `components/data-table` |
| ConfirmDialog | `components/confirm-dialog` |
| EmptyState | `components/empty-state` |
| Select | shadcn/ui |
| Button | shadcn/ui |
