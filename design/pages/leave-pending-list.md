# 待審核列表（主管）

## 對應 Feature

#18 F-003: 主管審核請假

## Layout

```
┌──────────────────────────────────────────────────────────┐
│ Header: [≡] 待審核請假                    [Avatar ▼]      │
├────────────┬─────────────────────────────────────────────┤
│ Sidebar    │ Main Content                                │
│            │                                             │
│ Dashboard  │ ┌── PageHeader ──────────────────────────┐  │
│ 打卡       │ │ 待審核請假  [3] badge     [審核歷史]   │  │
│ ─────      │ │ 您有 3 筆請假待審核                    │  │
│ 請假申請   │ └────────────────────────────────────────┘  │
│ 請假紀錄   │                                             │
│ 額度總覽   │ ┌── ApprovalCard Grid ──────────────────┐  │
│ ─────      │ │ ┌──────────────┐ ┌──────────────┐    │  │
│ > 待審核   │ │ │ 王小明       │ │ 李小華       │    │  │
│   審核歷史 │ │ │ [特休]       │ │ [事假]       │    │  │
│ ─────      │ │ │ 04/10~14     │ │ 04/08        │    │  │
│ (Admin)    │ │ │ 36h          │ │ 4h           │    │  │
│ 額度管理   │ │ │ [駁回][核准] │ │ [駁回][核准] │    │  │
│            │ │ └──────────────┘ └──────────────┘    │  │
│            │ │                                       │  │
│            │ │ ┌──────────────┐                      │  │
│            │ │ │ 張小美       │                      │  │
│            │ │ │ [病假]       │                      │  │
│            │ │ │ 04/07        │                      │  │
│            │ │ │ 8h           │                      │  │
│            │ │ │ [駁回][核准] │                      │  │
│            │ │ └──────────────┘                      │  │
│            │ └───────────────────────────────────────┘  │
│            │                                             │
│            │ (空狀態: EmptyState "目前沒有待審核的請假")   │
└────────────┴─────────────────────────────────────────────┘
```

## 頁面規格

| 項目 | 說明 |
|------|------|
| 路由 | `/leaves/pending` |
| 認證 | 需要（role: manager 或 admin） |
| Layout | `AppLayout` |
| Breadcrumb | `[請假管理] > [待審核]` |

## API 呼叫

| 時機 | API | 用途 |
|------|-----|------|
| 頁面載入 | `GET /api/v1/leaves/pending` | 取得待審核列表 |
| 核准 | `PUT /api/v1/leaves/:id/approve` | 核准請假 |
| 駁回 | `PUT /api/v1/leaves/:id/reject` | 駁回請假 |

## 內容區塊

### PageHeader

- 標題旁顯示待審核數量 Badge（`bg-destructive text-destructive-foreground rounded-full px-2 text-xs`）
- 右側 Action：連結到審核歷史頁（`/leaves/history`）

### ApprovalCard Grid

- Grid 排列：`grid gap-4 sm:grid-cols-1 md:grid-cols-2 xl:grid-cols-3`
- 每張卡片使用 `ApprovalCard` 元件
- 按 `created_at` 升序排列（最早申請的排最前）

### ReviewModal

- 點擊核准/駁回按鈕後開啟
- 使用 `ReviewModal` 元件

## 範例程式碼

```tsx
import { useState } from "react";
import { AppLayout } from "@/components/layout";
import { PageHeader } from "@/components/page-header";
import { ApprovalCard } from "@/components/approval-card";
import { ReviewModal } from "@/components/review-modal";
import { EmptyState } from "@/components/empty-state";
import { LoadingState } from "@/components/loading-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { History } from "lucide-react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export default function LeavePendingPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [reviewModal, setReviewModal] = useState<{
    open: boolean;
    mode: "approve" | "reject";
    leave: PendingLeave | null;
  }>({ open: false, mode: "approve", leave: null });

  const { data, isLoading } = useQuery({
    queryKey: ["leaves", "pending"],
    queryFn: () => fetch("/api/v1/leaves/pending").then((r) => r.json()),
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, comment }: { id: string; comment: string }) =>
      fetch(`/api/v1/leaves/${id}/approve`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment }),
      }).then((r) => r.json()),
    onSuccess: () => {
      toast({ title: "已核准" });
      queryClient.invalidateQueries({ queryKey: ["leaves", "pending"] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, comment }: { id: string; comment: string }) =>
      fetch(`/api/v1/leaves/${id}/reject`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment }),
      }).then((r) => r.json()),
    onSuccess: () => {
      toast({ title: "已駁回" });
      queryClient.invalidateQueries({ queryKey: ["leaves", "pending"] });
    },
  });

  const pendingCount = data?.meta?.total || 0;

  if (isLoading) {
    return (
      <AppLayout breadcrumbs={[{ label: "請假管理" }, { label: "待審核" }]}>
        <LoadingState />
      </AppLayout>
    );
  }

  return (
    <AppLayout breadcrumbs={[{ label: "請假管理" }, { label: "待審核" }]}>
      <PageHeader
        title={
          <div className="flex items-center gap-2">
            待審核請假
            {pendingCount > 0 && (
              <Badge variant="destructive" className="rounded-full px-2 text-xs">
                {pendingCount}
              </Badge>
            )}
          </div>
        }
        description={`您有 ${pendingCount} 筆請假待審核`}
        actions={
          <Button variant="outline" asChild>
            <Link href="/leaves/history">
              <History className="mr-2 h-4 w-4" />
              審核歷史
            </Link>
          </Button>
        }
      />

      {pendingCount === 0 ? (
        <EmptyState
          icon="inbox"
          title="目前沒有待審核的請假"
          description="當部屬提交請假申請時，會顯示在這裡"
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
          {data.data.map((leave: PendingLeave) => (
            <ApprovalCard
              key={leave.id}
              leave={leave}
              onApprove={(id) =>
                setReviewModal({ open: true, mode: "approve", leave })
              }
              onReject={(id) =>
                setReviewModal({ open: true, mode: "reject", leave })
              }
            />
          ))}
        </div>
      )}

      {/* Review Modal */}
      {reviewModal.leave && (
        <ReviewModal
          open={reviewModal.open}
          onOpenChange={(open) => setReviewModal((s) => ({ ...s, open }))}
          mode={reviewModal.mode}
          leave={reviewModal.leave}
          onSubmit={async (comment) => {
            const id = reviewModal.leave!.id;
            if (reviewModal.mode === "approve") {
              await approveMutation.mutateAsync({ id, comment });
            } else {
              await rejectMutation.mutateAsync({ id, comment });
            }
            setReviewModal({ open: false, mode: "approve", leave: null });
          }}
          isSubmitting={approveMutation.isPending || rejectMutation.isPending}
        />
      )}
    </AppLayout>
  );
}
```

## 響應式行為

| 斷點 | Grid Columns | 說明 |
|------|-------------|------|
| >= 1280px (xl) | 3 欄 | 桌面最佳 |
| 768-1279px (md-xl) | 2 欄 | 平板/小筆電 |
| < 768px (sm) | 1 欄 | 手機，卡片全寬 |

## Sidebar 導航更新

Sprint 2 新增的導航項目：

```
請假管理
├── 請假申請     (/leaves/new)
├── 請假紀錄     (/leaves)
├── 額度總覽     (/leaves/quota)
─────
主管 (role: manager/admin)
├── 待審核       (/leaves/pending)     ← Badge 顯示數量
├── 審核歷史     (/leaves/history)
─────
Admin (role: admin)
├── 額度管理     (/admin/quotas)
```

## 使用的元件

| 元件 | 來源 |
|------|------|
| AppLayout, PageHeader | `components/layout` |
| ApprovalCard | `components/approval-card` |
| ReviewModal | `components/review-modal` |
| EmptyState | `components/empty-state` |
| LoadingState | `components/loading-state` |
| Badge | shadcn/ui |
| Button | shadcn/ui |
