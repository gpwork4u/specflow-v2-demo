# 補打卡紀錄列表

## 對應 Feature

#32 F-010: 補打卡申請

## Layout

```
+------------------------------------------------------+
| Header: [=] 補打卡紀錄                   [Avatar v]    |
+------------+-----------------------------------------+
| Sidebar    | Main Content                            |
|            |                                         |
| Dashboard  | +-- PageHeader ----------------------+  |
| 打卡       | | 我的補打卡紀錄        [+ 補打卡申請]|  |
| -----      | | 查看所有補打卡申請紀錄              |  |
| 請假管理   | +------------------------------------+  |
| -----      |                                         |
| 加班管理   | +-- Filters --------------------------+  |
| -----      | | [狀態 v]                             |  |
| 補打卡申請 | +------------------------------------+  |
| > 補打卡紀錄|                                         |
| -----      | +-- DataTable ----------------------+  |
| (主管)     | | | 日期   | 類型   | 時間  | 原因 | |  |
| 待審核     | | |--------|--------|-------|------| |  |
| -----      | | | 04/06  |[上班]  | 09:00 |忘打  | |  |
| 通知中心   | | | 04/05  |[下班]  | 18:00 |忘打  | |  |
|            | |                                    |  |
|            | | [< 1 2 3 >]                       |  |
|            | +------------------------------------+  |
|            |                                         |
|            | (空狀態: EmptyState "尚無補打卡紀錄")    |
+------------+-----------------------------------------+
```

## 頁面規格

| 項目 | 說明 |
|------|------|
| 路由 | `/missed-clocks` |
| 認證 | 需要（任何角色） |
| Layout | `AppLayout` |
| Breadcrumb | `[補打卡管理] > [補打卡紀錄]` |

## API 呼叫

| 時機 | API | 用途 |
|------|-----|------|
| 頁面載入 / 篩選變更 | `GET /api/v1/missed-clocks` | 取得補打卡紀錄 |

## 篩選器

| 篩選項 | 元件 | 預設值 |
|--------|------|--------|
| 狀態 | `Select` | 全部 |

## DataTable 欄位

| 欄位 | 寬度 | 內容 | 排序 |
|------|------|------|------|
| 日期 | 120px | `yyyy/MM/dd` | 是（預設降序） |
| 類型 | 100px | Badge：上班打卡（藍）/ 下班打卡（紫） | 否 |
| 時間 | 80px | `HH:mm`，`font-mono` | 否 |
| 原因 | flex | `line-clamp-1 text-muted-foreground` | 否 |
| 狀態 | 100px | Status Badge | 是 |
| 申請時間 | 130px | `yyyy/MM/dd HH:mm` | 是 |
| 審核結果 | 150px | 審核者 + 備註（已審核時顯示） | 否 |

## 打卡類型 Badge

| Type | 標籤 | 顏色 |
|------|------|------|
| `clock_in` | 上班打卡 | Blue bg + Blue text + `LogIn` icon |
| `clock_out` | 下班打卡 | Purple bg + Purple text + `LogOut` icon |

## 狀態 Badge

| Status | 標籤 | 顏色 |
|--------|------|------|
| `pending` | 待審核 | Amber |
| `approved` | 已核准 | Green |
| `rejected` | 已駁回 | Red |

## 範例程式碼

```tsx
import { useState } from "react";
import { AppLayout } from "@/components/layout";
import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { Plus, LogIn, LogOut, Eye, MessageSquare } from "lucide-react";
import { format, parseISO } from "date-fns";
import Link from "next/link";
import { ColumnDef } from "@tanstack/react-table";
import { useQuery } from "@tanstack/react-query";

const clockTypeBadge = {
  clock_in: {
    label: "上班打卡",
    icon: LogIn,
    className: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
  },
  clock_out: {
    label: "下班打卡",
    icon: LogOut,
    className: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-400",
  },
} as const;

const statusBadge = {
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
} as const;

interface MissedClockRecord {
  id: string;
  date: string;
  clock_type: "clock_in" | "clock_out";
  requested_time: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  reviewer?: { name: string };
  review_comment?: string;
  created_at: string;
}

const columns: ColumnDef<MissedClockRecord>[] = [
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
    accessorKey: "clock_type",
    header: "類型",
    cell: ({ row }) => {
      const config = clockTypeBadge[row.original.clock_type];
      const Icon = config.icon;
      return (
        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${config.className}`}>
          <Icon className="h-3 w-3" />
          {config.label}
        </span>
      );
    },
  },
  {
    id: "time",
    header: "時間",
    cell: ({ row }) => (
      <span className="font-mono text-sm">
        {format(parseISO(row.original.requested_time), "HH:mm")}
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
      const config = statusBadge[row.original.status];
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
    id: "review",
    header: "審核結果",
    cell: ({ row }) => {
      const { status, reviewer, review_comment } = row.original;
      if (status === "pending") return null;
      return (
        <div className="space-y-0.5">
          <span className="text-xs text-muted-foreground">
            {reviewer?.name}
          </span>
          {review_comment && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-[200px] text-sm">{review_comment}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      );
    },
  },
];

export default function MissedClockListPage() {
  const [statusFilter, setStatusFilter] = useState("all");

  const { data, isLoading } = useQuery({
    queryKey: ["missed-clocks", statusFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      return fetch(`/api/v1/missed-clocks?${params}`).then((r) => r.json());
    },
  });

  return (
    <AppLayout breadcrumbs={[{ label: "補打卡管理" }, { label: "補打卡紀錄" }]}>
      <PageHeader
        title="我的補打卡紀錄"
        description="查看所有補打卡申請紀錄"
        actions={
          <Button asChild>
            <Link href="/missed-clocks/new">
              <Plus className="mr-2 h-4 w-4" />
              補打卡申請
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
          </SelectContent>
        </Select>
      </div>

      {/* 表格 */}
      <DataTable
        columns={columns}
        data={data?.data || []}
        pagination={data?.meta}
        emptyState={
          <EmptyState
            icon="fileEdit"
            title="尚無補打卡紀錄"
            description="點擊右上角按鈕申請補打卡"
          />
        }
      />
    </AppLayout>
  );
}
```

## 響應式行為

| 斷點 | 變化 |
|------|------|
| >= 1024px (lg) | 完整表格顯示 |
| 768-1023px (md) | 隱藏「原因」、「申請時間」、「審核結果」欄 |
| < 768px | 改為 Card 列表模式 |

### Mobile Card 模式

```
+------------------------------+
| 2026/04/06        [待審核]   |
| [上班打卡]  09:00            |
| 忘記打卡，當日 9:00 已到辦公室 |
| 2026/04/07 10:00             |
+------------------------------+
```

## 使用的元件

| 元件 | 來源 |
|------|------|
| AppLayout, PageHeader | `components/layout` |
| DataTable | `components/data-table` |
| EmptyState | `components/empty-state` |
| Tooltip | shadcn/ui |
| Select | shadcn/ui |
| Button | shadcn/ui |
