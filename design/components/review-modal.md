# ReviewModal

## 用途

主管審核請假單的 Modal 對話框。支援核准（comment 選填）和駁回（comment 必填）兩種模式。顯示請假單摘要資訊，並提供備註輸入。基於 shadcn/ui 的 `Dialog` 元件。

## Props

| Prop | Type | Default | 說明 |
|------|------|---------|------|
| open | `boolean` | - | 是否開啟 |
| onOpenChange | `(open: boolean) => void` | - | 開關狀態變更 |
| mode | `'approve' \| 'reject'` | - | 審核模式 |
| leave | `PendingLeave` | - | 待審核的請假資料 |
| onSubmit | `(comment: string) => Promise<void>` | - | 提交回呼 |
| isSubmitting | `boolean` | `false` | 是否正在提交 |

## Layout

### 核准模式（mode="approve"）

```
┌──────────────────────────────────────┐
│ [勾] 核准請假                         │
│                                      │
│ ┌── 請假摘要 ──────────────────────┐  │
│ │ 員工：王小明 (EMP001)           │  │
│ │ 假別：[特休]                    │  │
│ │ 日期：2026/04/10 ~ 04/14       │  │
│ │ 時數：36 小時 (4.5 天)          │  │
│ │ 原因：出國旅遊                  │  │
│ └──────────────────────────────────┘  │
│                                      │
│ 審核備註（選填）                      │
│ ┌──────────────────────────────────┐  │
│ │                                  │  │
│ └──────────────────────────────────┘  │
│                                      │
│                  [取消]  [確認核准]    │
└──────────────────────────────────────┘
```

### 駁回模式（mode="reject"）

```
┌──────────────────────────────────────┐
│ [叉] 駁回請假                         │
│                                      │
│ ┌── 請假摘要 ──────────────────────┐  │
│ │ （同上）                        │  │
│ └──────────────────────────────────┘  │
│                                      │
│ ⚠ 駁回請假需填寫原因                  │
│                                      │
│ 駁回原因 *                            │
│ ┌──────────────────────────────────┐  │
│ │                                  │  │
│ │                                  │  │
│ └──────────────────────────────────┘  │
│                           0 / 500 字  │
│                                      │
│                  [取消]  [確認駁回]    │
└──────────────────────────────────────┘
```

## 外觀規格

| 部位 | 樣式 |
|------|------|
| Dialog | `max-w-md` |
| 標題 Icon | 核准: `CheckCircle2 text-green-600`；駁回: `XCircle text-destructive` |
| 摘要區 | `bg-muted rounded-lg p-4 space-y-2` |
| 摘要 Label | `text-xs text-muted-foreground` |
| 摘要 Value | `text-sm` |
| 警告文字 | `text-sm text-amber-600` + `AlertTriangle` icon（僅駁回） |
| Textarea | `min-h-[80px]`（核准）/ `min-h-[100px]`（駁回） |
| 確認按鈕 | 核准: `variant="default"`；駁回: `variant="destructive"` |

## 範例程式碼

```tsx
import { useState } from "react";
import { format, parseISO } from "date-fns";
import {
  CheckCircle2, XCircle, AlertTriangle, Loader2,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { LeaveTypeBadge } from "@/components/leave-type-badge";

interface ReviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "approve" | "reject";
  leave: PendingLeave;
  onSubmit: (comment: string) => Promise<void>;
  isSubmitting?: boolean;
}

export function ReviewModal({
  open,
  onOpenChange,
  mode,
  leave,
  onSubmit,
  isSubmitting = false,
}: ReviewModalProps) {
  const [comment, setComment] = useState("");
  const isReject = mode === "reject";
  const canSubmit = isReject ? comment.trim().length > 0 : true;

  const handleSubmit = async () => {
    if (isReject && !comment.trim()) return;
    await onSubmit(comment);
    setComment("");
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) setComment("");
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isReject ? (
              <XCircle className="h-5 w-5 text-destructive" />
            ) : (
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            )}
            {isReject ? "駁回請假" : "核准請假"}
          </DialogTitle>
        </DialogHeader>

        {/* 請假摘要 */}
        <div className="space-y-2 rounded-lg bg-muted p-4">
          <div className="flex justify-between">
            <span className="text-xs text-muted-foreground">員工</span>
            <span className="text-sm">
              {leave.user.name}
              <span className="ml-1 text-xs text-muted-foreground font-mono">
                ({leave.user.employee_id})
              </span>
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground">假別</span>
            <LeaveTypeBadge leaveType={leave.leave_type} />
          </div>
          <div className="flex justify-between">
            <span className="text-xs text-muted-foreground">日期</span>
            <span className="text-sm">
              {format(parseISO(leave.start_date), "yyyy/MM/dd")}
              {leave.start_date !== leave.end_date &&
                ` ~ ${format(parseISO(leave.end_date), "MM/dd")}`}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-xs text-muted-foreground">時數</span>
            <span className="text-sm font-medium">
              {leave.hours} 小時 ({leave.hours / 8} 天)
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-xs text-muted-foreground">原因</span>
            <span className="text-sm max-w-[200px] text-right">{leave.reason}</span>
          </div>
        </div>

        {/* 駁回警告 */}
        {isReject && (
          <div className="flex items-center gap-2 text-sm text-amber-600">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>駁回請假需填寫原因</span>
          </div>
        )}

        {/* 備註輸入 */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">
            {isReject ? "駁回原因 *" : "審核備註（選填）"}
          </Label>
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={
              isReject ? "請輸入駁回原因..." : "可輸入備註..."
            }
            className={isReject ? "min-h-[100px]" : "min-h-[80px]"}
            maxLength={500}
          />
          {isReject && (
            <div className="text-right text-xs text-muted-foreground">
              {comment.length} / 500 字
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isSubmitting}
          >
            取消
          </Button>
          <Button
            variant={isReject ? "destructive" : "default"}
            onClick={handleSubmit}
            disabled={!canSubmit || isSubmitting}
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isReject ? "確認駁回" : "確認核准"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

## 使用範例

```tsx
// 在待審核列表頁使用
const [reviewModal, setReviewModal] = useState<{
  open: boolean;
  mode: "approve" | "reject";
  leave: PendingLeave | null;
}>({ open: false, mode: "approve", leave: null });

// 開啟核准 Modal
<ApprovalCard
  leave={leave}
  onApprove={(id) =>
    setReviewModal({ open: true, mode: "approve", leave })
  }
  onReject={(id) =>
    setReviewModal({ open: true, mode: "reject", leave })
  }
/>

// Modal
{reviewModal.leave && (
  <ReviewModal
    open={reviewModal.open}
    onOpenChange={(open) => setReviewModal((s) => ({ ...s, open }))}
    mode={reviewModal.mode}
    leave={reviewModal.leave}
    onSubmit={async (comment) => {
      if (reviewModal.mode === "approve") {
        await approveLeave(reviewModal.leave!.id, comment);
      } else {
        await rejectLeave(reviewModal.leave!.id, comment);
      }
      setReviewModal({ open: false, mode: "approve", leave: null });
    }}
    isSubmitting={isProcessing}
  />
)}
```

## Accessibility

- Dialog 自動 trap focus
- 按 Escape 關閉
- 駁回模式下，comment 為空時 disable 確認按鈕
- 必填欄位標示 `*`
- 標題含 icon + 文字雙重提示
- 確認按鈕的 variant 提供視覺區分（核准 = primary，駁回 = destructive）

## 使用的 shadcn/ui 元件

- `Dialog`（DialogContent, DialogHeader, DialogTitle, DialogFooter）
- `Textarea`
- `Button`
- `Label`
- `LeaveTypeBadge`（自訂）
