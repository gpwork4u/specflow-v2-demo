# 額度管理（Admin）

## 對應 Feature

#16 F-009: 假別額度管理

## Layout

```
┌──────────────────────────────────────────────────────────┐
│ Header: [≡] 額度管理                      [Avatar ▼]      │
├────────────┬─────────────────────────────────────────────┤
│ Sidebar    │ Main Content                                │
│            │                                             │
│            │ ┌── PageHeader ──────────────────────────┐  │
│            │ │ 假別額度管理         [批次設定額度]     │  │
│            │ │ 管理員工年度假別額度  [年度: 2026 ▼]   │  │
│            │ └────────────────────────────────────────┘  │
│            │                                             │
│            │ ┌── 搜尋列 ─────────────────────────────┐  │
│            │ │ [🔍 搜尋員工（姓名或編號）]            │  │
│            │ └────────────────────────────────────────┘  │
│            │                                             │
│            │ ┌── Employee DataTable ──────────────────┐  │
│            │ │ |員工    |特休|事假|病假|婚假|...|操作| │  │
│            │ │ |--------|----|----|----|----|---|----| │  │
│            │ │ |王小明  |8/10|0/7 |1/30|0/8 |...|[編]│  │
│            │ │ |EMP001  |    |    |    |    |   |    │  │
│            │ │ |--------|----|----|----|----|---|----│ │  │
│            │ │ |李小華  |3/7 |2/7 |0/30|0/8 |...|[編]│  │
│            │ │ |EMP002  |    |    |    |    |   |    │  │
│            │ │                                        │  │
│            │ │ [< 1 2 3 >]                           │  │
│            │ └────────────────────────────────────────┘  │
│            │                                             │
│            │ (點擊 [編輯] 展開 inline QuotaEditor)        │
└────────────┴─────────────────────────────────────────────┘

  展開 inline 編輯模式：

│ |王小明  |                                   [收合] │  │
│ |EMP001  |                                          │  │
│ |┌── QuotaEditor (inline) ─────────────────────┐|  │  │
│ || 假別   | 總額(天) | 已用(天) | 剩餘(天) | 操作 ||  │  │
│ || [特休] | [12___]  | 2        | 10       | [v][x]||  │  │
│ || [事假] | 7        | 0        | 7        | [編] ||  │  │
│ || ...    |          |          |          |      ||  │  │
│ |└─────────────────────────────────────────────┘|  │  │
│ |                              [取消] [儲存變更] |  │  │
```

## 頁面規格

| 項目 | 說明 |
|------|------|
| 路由 | `/admin/quotas` |
| 認證 | 需要（role: admin） |
| Layout | `AppLayout` |
| Breadcrumb | `[管理] > [額度管理]` |

## API 呼叫

| 時機 | API | 用途 |
|------|-----|------|
| 頁面載入 | `GET /api/v1/employees?page=1&limit=20` | 取得員工列表 |
| 搜尋 | 同上 + `search` param | 搜尋員工 |
| 展開員工 | `GET /api/v1/leave-quotas/employees/:userId?year={year}` | 取得該員工額度 |
| 儲存 | `PUT /api/v1/leave-quotas/employees/:userId` | 更新額度 |
| 批次設定 | `POST /api/v1/leave-quotas/batch` | 批次更新 |

## Employee DataTable 欄位

| 欄位 | 寬度 | 內容 |
|------|------|------|
| 員工 | 180px | Avatar + Name + Employee ID + Department |
| 特休 | 80px | `used/total` 天數，接近用完時紅色 |
| 事假 | 80px | 同上 |
| 病假 | 80px | 同上 |
| 婚假 | 80px | 同上 |
| 操作 | 80px | [編輯] 按鈕 |

### 額度 Cell 顯示規則

```tsx
function QuotaCell({ used, total }: { used: number; total: number }) {
  const percentage = total > 0 ? (used / total) * 100 : 0;
  return (
    <span
      className={cn(
        "text-sm font-mono",
        percentage >= 90 ? "text-destructive font-medium" :
        percentage >= 70 ? "text-amber-600" :
        "text-muted-foreground"
      )}
    >
      {used / 8}/{total / 8}
    </span>
  );
}
```

## 互動行為

1. 頁面載入 -> 顯示員工列表（含各假別額度摘要）
2. 搜尋框輸入 -> debounce 300ms -> 重新載入列表
3. 點擊 [編輯] -> 展開該員工的 `QuotaEditor`（inline 模式）
4. 編輯額度 -> 驗證 -> 點擊 [儲存變更] -> 呼叫 API
5. 成功：Toast "已更新額度" + 收合
6. 失敗：顯示錯誤（QUOTA_BELOW_USED 等）
7. 點擊 [批次設定額度] -> 開啟批次設定 Modal

## 範例程式碼

```tsx
import { useState } from "react";
import { AppLayout } from "@/components/layout";
import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { QuotaEditor } from "@/components/quota-editor";
import { SearchFilter } from "@/components/search-filter";
import { LoadingState } from "@/components/loading-state";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Settings, ChevronDown, Loader2 } from "lucide-react";
import Link from "next/link";

export default function QuotaAdminPage() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [search, setSearch] = useState("");
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

  return (
    <AppLayout breadcrumbs={[{ label: "管理" }, { label: "額度管理" }]}>
      <PageHeader
        title="假別額度管理"
        description="管理員工年度假別額度"
        actions={
          <div className="flex items-center gap-2">
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={String(currentYear)}>{currentYear} 年</SelectItem>
                <SelectItem value={String(currentYear - 1)}>{currentYear - 1} 年</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => setShowBatchModal(true)}>
              <Settings className="mr-2 h-4 w-4" />
              批次設定額度
            </Button>
          </div>
        }
      />

      {/* 搜尋 */}
      <SearchFilter
        value={search}
        onChange={setSearch}
        placeholder="搜尋員工（姓名或編號）"
        className="mb-4 max-w-sm"
      />

      {/* 員工額度表格 */}
      <DataTable
        columns={columns}
        data={employees}
        pagination={meta}
        onPageChange={setPage}
        expandable={{
          expandedRowId: expandedUserId,
          renderExpanded: (employee) => (
            <ExpandedQuotaEditor
              userId={employee.id}
              year={year}
              onSaved={() => setExpandedUserId(null)}
            />
          ),
        }}
      />
    </AppLayout>
  );
}

// 展開的 QuotaEditor
function ExpandedQuotaEditor({
  userId,
  year,
  onSaved,
}: {
  userId: string;
  year: number;
  onSaved: () => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["leave-quotas", userId, year],
    queryFn: () =>
      fetch(`/api/v1/leave-quotas/employees/${userId}?year=${year}`)
        .then((r) => r.json()),
  });

  const [editableQuotas, setEditableQuotas] = useState(data?.quotas || []);

  const updateMutation = useMutation({
    mutationFn: (quotas: any[]) =>
      fetch(`/api/v1/leave-quotas/employees/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, quotas }),
      }).then((r) => r.json()),
    onSuccess: () => {
      toast({ title: "已更新額度" });
      onSaved();
    },
  });

  if (isLoading) return <LoadingState />;

  return (
    <div className="border-t bg-muted/30 p-4 space-y-4">
      <QuotaEditor
        quotas={editableQuotas}
        onChange={setEditableQuotas}
        mode="inline"
      />
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onSaved}>
          取消
        </Button>
        <Button
          onClick={() => updateMutation.mutate(editableQuotas)}
          disabled={updateMutation.isPending}
        >
          {updateMutation.isPending && (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          )}
          儲存變更
        </Button>
      </div>
    </div>
  );
}
```

## 響應式行為

| 斷點 | 變化 |
|------|------|
| >= 1280px (xl) | 完整表格（顯示所有假別欄） |
| 1024-1279px (lg) | 顯示主要假別（特休、事假、病假） |
| < 1024px | 只顯示員工欄 + [編輯] 按鈕，點擊展開完整額度 |

## 使用的元件

| 元件 | 來源 |
|------|------|
| AppLayout, PageHeader | `components/layout` |
| DataTable | `components/data-table` |
| QuotaEditor | `components/quota-editor` |
| SearchFilter | `components/search-filter` |
| LoadingState | `components/loading-state` |
| Avatar | shadcn/ui |
| Select | shadcn/ui |
| Button | shadcn/ui |
| Collapsible | shadcn/ui |
