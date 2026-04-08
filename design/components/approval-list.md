# ApprovalList

## 用途

通用審核列表元件，供主管審核加班申請和補打卡申請共用。以卡片 Grid 方式呈現待審核項目，每張卡片顯示員工資訊、申請摘要、核准/駁回操作按鈕。搭配 `ReviewModal` 進行審核。與 Sprint 2 的 `ApprovalCard`（請假專用）設計風格一致，但抽象為通用型。

## Props

| Prop | Type | Default | 說明 |
|------|------|---------|------|
| type | `'overtime' \| 'missed_clock'` | - | 審核類型 |
| items | `ApprovalItem[]` | `[]` | 待審核項目列表 |
| onApprove | `(id: string, comment: string) => Promise<void>` | - | 核准回呼 |
| onReject | `(id: string, comment: string) => Promise<void>` | - | 駁回回呼 |
| isProcessing | `string \| null` | `null` | 正在處理的項目 ID |
| emptyMessage | `string` | `"目前沒有待審核的項目"` | 空狀態訊息 |

### Types

```ts
interface ApprovalItem {
  id: string;
  user: {
    id: string;
    name: string;
    employee_id: string;
    department: { id: string; name: string };
  };
  created_at: string; // ISO datetime

  // 加班申請欄位
  date?: string;
  start_time?: string;
  end_time?: string;
  hours?: number;
  reason?: string;

  // 補打卡申請欄位
  clock_type?: "clock_in" | "clock_out";
  requested_time?: string; // ISO datetime
}
```

## Layout

```
+----------------------------------------------------------+
| PageHeader                                                |
| 待審核加班 [3]                          [審核歷史]         |
| 您有 3 筆加班申請待審核                                    |
+----------------------------------------------------------+

+----------------------------------------------------------+
| Grid (md:2 cols, xl:3 cols)                              |
| +------------------------+ +------------------------+     |
| | [頭像] 王小明 (EMP001) | | [頭像] 李小華 (EMP002) |     |
| |        工程部          | |        業務部          |     |
| | ────────────────────── | | ────────────────────── |     |
| | 2026/04/07             | | 2026/04/06             |     |
| | 18:00 ~ 21:00 (3.0h)  | | 18:00 ~ 20:00 (2.0h)  |     |
| | 原因：趕專案 deadline   | | 原因：客戶緊急需求      |     |
| | 申請：04/07 10:00      | | 申請：04/06 19:00      |     |
| | ────────────────────── | | ────────────────────── |     |
| |        [駁回]  [核准]  | |        [駁回]  [核准]  |     |
| +------------------------+ +------------------------+     |
+----------------------------------------------------------+

（空狀態）
+----------------------------------------------------------+
| [inbox icon]                                              |
| 目前沒有待審核的加班申請                                   |
| 當部屬提交加班申請時，會顯示在這裡                          |
+----------------------------------------------------------+
```

### 補打卡卡片 Layout

```
+------------------------+
| [頭像] 張小美 (EMP003) |
|        人資部          |
| ────────────────────── |
| 2026/04/06             |
| [上班打卡]  09:00      |
| 原因：忘記打卡          |
| 申請：04/07 10:00      |
| ────────────────────── |
|        [駁回]  [核准]  |
+------------------------+
```

## 外觀規格

| 部位 | 樣式 |
|------|------|
| Grid 容器 | `grid gap-4 sm:grid-cols-1 md:grid-cols-2 xl:grid-cols-3` |
| 卡片容器 | `Card` + `p-4 hover:shadow-md transition-shadow` |
| 員工頭像 | `Avatar` h-10 w-10，顯示姓名首字 |
| 員工名稱 | `text-sm font-medium` |
| 員工編號 | `text-xs text-muted-foreground font-mono` |
| 部門名稱 | `text-xs text-muted-foreground` |
| 分隔線 | `Separator` |
| 日期 | `text-sm font-medium` |
| 時間範圍（加班） | `text-sm`，含計算時數 `font-medium text-primary` |
| 打卡類型（補打卡） | `StatusBadge`-like badge + 時間 |
| 原因 | `text-sm text-muted-foreground line-clamp-2` |
| 申請時間 | `text-xs text-muted-foreground` |
| 核准按鈕 | `Button variant="default" size="sm"` + `CheckCircle2` icon |
| 駁回按鈕 | `Button variant="outline" size="sm"` + `XCircle` icon，hover 時 border-destructive |

## 範例程式碼

```tsx
import { useState } from "react";
import { format, parseISO } from "date-fns";
import { CheckCircle2, XCircle, Clock, LogIn, LogOut } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ReviewModal } from "@/components/review-modal";
import { EmptyState } from "@/components/empty-state";

const clockTypeConfig = {
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

interface ApprovalListProps {
  type: "overtime" | "missed_clock";
  items: ApprovalItem[];
  onApprove: (id: string, comment: string) => Promise<void>;
  onReject: (id: string, comment: string) => Promise<void>;
  isProcessing?: string | null;
  emptyMessage?: string;
}

export function ApprovalList({
  type,
  items,
  onApprove,
  onReject,
  isProcessing = null,
  emptyMessage,
}: ApprovalListProps) {
  const [reviewModal, setReviewModal] = useState<{
    open: boolean;
    mode: "approve" | "reject";
    item: ApprovalItem | null;
  }>({ open: false, mode: "approve", item: null });

  const typeLabel = type === "overtime" ? "加班" : "補打卡";
  const defaultEmpty = `目前沒有待審核的${typeLabel}申請`;

  if (items.length === 0) {
    return (
      <EmptyState
        icon="inbox"
        title={emptyMessage || defaultEmpty}
        description={`當部屬提交${typeLabel}申請時，會顯示在這裡`}
      />
    );
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <Card key={item.id} className="transition-shadow hover:shadow-md">
            <CardContent className="space-y-3 p-4">
              {/* 員工資訊 */}
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="text-sm">
                    {item.user.name.slice(0, 1)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{item.user.name}</span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {item.user.employee_id}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {item.user.department.name}
                  </span>
                </div>
              </div>

              <Separator />

              {/* 申請資訊 */}
              <div className="space-y-2">
                {type === "overtime" && (
                  <>
                    <p className="text-sm font-medium">
                      {item.date && format(parseISO(item.date), "yyyy/MM/dd")}
                    </p>
                    <p className="text-sm">
                      {item.start_time} ~ {item.end_time}
                      <span className="ml-2 font-medium text-primary">
                        {item.hours} 小時
                      </span>
                    </p>
                  </>
                )}

                {type === "missed_clock" && item.clock_type && (
                  <>
                    <p className="text-sm font-medium">
                      {item.date && format(parseISO(item.date), "yyyy/MM/dd")}
                    </p>
                    <div className="flex items-center gap-2">
                      {(() => {
                        const config = clockTypeConfig[item.clock_type];
                        const ClockIcon = config.icon;
                        return (
                          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${config.className}`}>
                            <ClockIcon className="h-3 w-3" />
                            {config.label}
                          </span>
                        );
                      })()}
                      <span className="text-sm">
                        {item.requested_time &&
                          format(parseISO(item.requested_time), "HH:mm")}
                      </span>
                    </div>
                  </>
                )}

                {item.reason && (
                  <p className="line-clamp-2 text-sm text-muted-foreground">
                    原因：{item.reason}
                  </p>
                )}

                <p className="text-xs text-muted-foreground">
                  申請時間：{format(parseISO(item.created_at), "yyyy/MM/dd HH:mm")}
                </p>
              </div>

              <Separator />

              {/* 操作按鈕 */}
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setReviewModal({ open: true, mode: "reject", item })
                  }
                  disabled={isProcessing === item.id}
                  className="hover:border-destructive hover:text-destructive"
                >
                  <XCircle className="mr-1.5 h-4 w-4" />
                  駁回
                </Button>
                <Button
                  size="sm"
                  onClick={() =>
                    setReviewModal({ open: true, mode: "approve", item })
                  }
                  disabled={isProcessing === item.id}
                >
                  <CheckCircle2 className="mr-1.5 h-4 w-4" />
                  核准
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 審核 Modal */}
      {reviewModal.item && (
        <ReviewModal
          open={reviewModal.open}
          onOpenChange={(open) => setReviewModal((s) => ({ ...s, open }))}
          mode={reviewModal.mode}
          title={
            reviewModal.mode === "approve"
              ? `核准${typeLabel}申請`
              : `駁回${typeLabel}申請`
          }
          summary={
            type === "overtime"
              ? {
                  員工: `${reviewModal.item.user.name} (${reviewModal.item.user.employee_id})`,
                  日期: reviewModal.item.date
                    ? format(parseISO(reviewModal.item.date), "yyyy/MM/dd")
                    : "",
                  時間: `${reviewModal.item.start_time} ~ ${reviewModal.item.end_time}`,
                  時數: `${reviewModal.item.hours} 小時`,
                  原因: reviewModal.item.reason || "",
                }
              : {
                  員工: `${reviewModal.item.user.name} (${reviewModal.item.user.employee_id})`,
                  日期: reviewModal.item.date
                    ? format(parseISO(reviewModal.item.date), "yyyy/MM/dd")
                    : "",
                  類型: reviewModal.item.clock_type === "clock_in" ? "上班打卡" : "下班打卡",
                  時間: reviewModal.item.requested_time
                    ? format(parseISO(reviewModal.item.requested_time), "HH:mm")
                    : "",
                  原因: reviewModal.item.reason || "",
                }
          }
          onSubmit={async (comment) => {
            const id = reviewModal.item!.id;
            if (reviewModal.mode === "approve") {
              await onApprove(id, comment);
            } else {
              await onReject(id, comment);
            }
            setReviewModal({ open: false, mode: "approve", item: null });
          }}
          isSubmitting={isProcessing === reviewModal.item.id}
        />
      )}
    </>
  );
}
```

## ReviewModal 擴展說明

Sprint 2 的 `ReviewModal` 需要擴展以支援通用摘要格式：

```ts
// 新增 Props（擴展 Sprint 2 的 ReviewModal）
interface ReviewModalProps {
  // ... 原有 Props
  title?: string;                    // 自訂標題（覆蓋預設）
  summary?: Record<string, string>;  // 通用 key-value 摘要（覆蓋 leave 專用格式）
}
```

摘要區改為通用 key-value 渲染：

```tsx
{Object.entries(summary).map(([key, value]) => (
  <div key={key} className="flex justify-between">
    <span className="text-xs text-muted-foreground">{key}</span>
    <span className="text-sm max-w-[200px] text-right">{value}</span>
  </div>
))}
```

## 響應式行為

| 斷點 | Grid Columns | 說明 |
|------|-------------|------|
| >= 1280px (xl) | 3 欄 | 桌面最佳 |
| 768-1279px (md-xl) | 2 欄 | 平板/小筆電 |
| < 768px (sm) | 1 欄 | 手機，卡片全寬 |

## Accessibility

- Card 使用語意化 HTML
- 按鈕有明確的文字標籤 + icon
- 操作按鈕有 `disabled` 狀態
- 駁回按鈕 hover 時紅色 border 提供視覺提示
- Avatar fallback 顯示姓名首字
- ReviewModal trap focus + Escape 關閉
- 駁回時 comment 必填，核准時選填
- 空狀態有文字說明

## 使用的元件

| 元件 | 來源 |
|------|------|
| Card, CardContent | shadcn/ui |
| Avatar, AvatarFallback | shadcn/ui |
| Button | shadcn/ui |
| Separator | shadcn/ui |
| ReviewModal | `design/components/review-modal`（擴展版） |
| EmptyState | `design/components/empty-state` |
