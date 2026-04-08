# ApprovalCard

## 用途

主管待審核列表中的單張請假卡片元件，顯示員工資訊、假別、日期、時數等摘要，並提供快速核准/駁回操作按鈕。基於 shadcn/ui 的 `Card` 元件。

## Props

| Prop | Type | Default | 說明 |
|------|------|---------|------|
| leave | `PendingLeave` | - | 待審核請假資料 |
| onApprove | `(id: string) => void` | - | 核准回呼（開啟 ReviewModal） |
| onReject | `(id: string) => void` | - | 駁回回呼（開啟 ReviewModal） |
| isProcessing | `boolean` | `false` | 是否正在處理中 |

### PendingLeave Type

```ts
interface PendingLeave {
  id: string;
  user: {
    id: string;
    name: string;
    employee_id: string;
    department: { id: string; name: string };
  };
  leave_type: LeaveType;
  start_date: string; // ISO date
  end_date: string;
  start_half: HalfDay;
  end_half: HalfDay;
  hours: number;
  reason: string;
  created_at: string; // ISO datetime
}
```

## Layout

```
┌──────────────────────────────────────────────┐
│ ┌───┐  王小明 (EMP001)          [待] 待審核  │
│ │ 👤│  工程部                                │
│ └───┘                                        │
│ ────────────────────────────────────────────  │
│ [特休]  2026/04/10 ~ 04/14   16 小時 (2天)   │
│                                              │
│ 原因：家庭旅遊                                │
│                                              │
│ 申請時間：2026/04/07 10:00                    │
│ ────────────────────────────────────────────  │
│                         [駁回]  [核准]        │
└──────────────────────────────────────────────┘
```

## 外觀規格

| 部位 | 樣式 |
|------|------|
| 容器 | `Card` + `p-4 hover:shadow-md transition-shadow` |
| 員工頭像 | `Avatar` h-10 w-10，顯示姓名首字 |
| 員工名稱 | `text-sm font-medium` |
| 員工編號 | `text-xs text-muted-foreground font-mono` |
| 部門名稱 | `text-xs text-muted-foreground` |
| 分隔線 | `Separator` |
| 假別 Badge | `LeaveTypeBadge` |
| 日期範圍 | `text-sm`，含半天標記（如 "04/10 (下午) ~ 04/14"） |
| 時數 | `text-sm font-medium` |
| 原因 | `text-sm text-muted-foreground line-clamp-2` |
| 申請時間 | `text-xs text-muted-foreground` |
| 核准按鈕 | `Button variant="default" size="sm"` + `CheckCircle2` icon |
| 駁回按鈕 | `Button variant="outline" size="sm"` + `XCircle` icon，hover 時 border-destructive |

## 範例程式碼

```tsx
import { format, parseISO } from "date-fns";
import { CheckCircle2, XCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { LeaveTypeBadge } from "@/components/leave-type-badge";
import { LeaveStatusBadge } from "@/components/leave-status-badge";

interface ApprovalCardProps {
  leave: PendingLeave;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  isProcessing?: boolean;
}

export function ApprovalCard({
  leave,
  onApprove,
  onReject,
  isProcessing = false,
}: ApprovalCardProps) {
  const formatDateRange = () => {
    const start = format(parseISO(leave.start_date), "yyyy/MM/dd");
    const end = format(parseISO(leave.end_date), "MM/dd");
    const halfLabel = (half: string) =>
      half === "morning" ? " (上午)" : half === "afternoon" ? " (下午)" : "";

    if (leave.start_date === leave.end_date) {
      return `${start}${halfLabel(leave.start_half)}`;
    }
    return `${start}${halfLabel(leave.start_half)} ~ ${end}${halfLabel(leave.end_half)}`;
  };

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="p-4 space-y-3">
        {/* 員工資訊 */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="text-sm">
                {leave.user.name.slice(0, 1)}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{leave.user.name}</span>
                <span className="text-xs text-muted-foreground font-mono">
                  {leave.user.employee_id}
                </span>
              </div>
              <span className="text-xs text-muted-foreground">
                {leave.user.department.name}
              </span>
            </div>
          </div>
          <LeaveStatusBadge status="pending" />
        </div>

        <Separator />

        {/* 請假資訊 */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <LeaveTypeBadge leaveType={leave.leave_type} />
            <span className="text-sm">{formatDateRange()}</span>
            <span className="text-sm font-medium">
              {leave.hours} 小時 ({leave.hours / 8} 天)
            </span>
          </div>

          <p className="text-sm text-muted-foreground line-clamp-2">
            原因：{leave.reason}
          </p>

          <p className="text-xs text-muted-foreground">
            申請時間：{format(parseISO(leave.created_at), "yyyy/MM/dd HH:mm")}
          </p>
        </div>

        <Separator />

        {/* 操作按鈕 */}
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onReject(leave.id)}
            disabled={isProcessing}
            className="hover:border-destructive hover:text-destructive"
          >
            <XCircle className="mr-1.5 h-4 w-4" />
            駁回
          </Button>
          <Button
            size="sm"
            onClick={() => onApprove(leave.id)}
            disabled={isProcessing}
          >
            <CheckCircle2 className="mr-1.5 h-4 w-4" />
            核准
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
```

## 使用範例

```tsx
// 在待審核列表中使用
{pendingLeaves.map((leave) => (
  <ApprovalCard
    key={leave.id}
    leave={leave}
    onApprove={(id) => openReviewModal(id, "approve")}
    onReject={(id) => openReviewModal(id, "reject")}
    isProcessing={processingId === leave.id}
  />
))}
```

## 響應式行為

| 斷點 | Layout |
|------|--------|
| >= 768px (md) | Card 寬度由外層 grid 決定 |
| < 768px | Card 全寬，內容堆疊 |

## Accessibility

- Card 使用語意化 HTML
- 按鈕有明確的文字標籤 + icon
- 操作按鈕有 `disabled` 狀態
- 原因文字使用 `line-clamp-2`，完整內容可在詳情頁查看
- 駁回按鈕 hover 時紅色 border 提供視覺提示
- Avatar fallback 顯示姓名首字，有足夠的辨識度

## 使用的 shadcn/ui 元件

- `Card`（CardContent）
- `Avatar`（AvatarFallback）
- `Button`
- `Separator`
- `LeaveTypeBadge`（自訂）
- `LeaveStatusBadge`（自訂）
