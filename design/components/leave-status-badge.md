# LeaveStatusBadge

## 用途

顯示請假單狀態的 Badge 元件。擴展 `StatusBadge` 新增 `type="leave"` 類型，或作為獨立元件使用。狀態色定義於 `design/tokens/leave-colors.css`。

## Props

| Prop | Type | Default | 說明 |
|------|------|---------|------|
| status | `LeaveStatus` | - | 請假狀態 |
| showIcon | `boolean` | `true` | 是否顯示前置圖示 |

### LeaveStatus

```ts
type LeaveStatus = "pending" | "approved" | "rejected" | "cancelled";
```

## Variants

| Status | 標籤文字 | 顏色 | Icon |
|--------|---------|------|------|
| `pending` | 待審核 | Amber bg + Dark Amber text | `Clock` |
| `approved` | 已核准 | Green bg + Dark Green text | `CheckCircle2` |
| `rejected` | 已駁回 | Red bg + Dark Red text | `XCircle` |
| `cancelled` | 已取消 | Gray bg + Dark Gray text | `Ban` |

## 外觀規格

| 部位 | 樣式 |
|------|------|
| 容器 | `inline-flex items-center gap-1 rounded-full px-2.5 py-0.5` |
| 文字 | `text-xs font-medium` |
| Icon | `h-3 w-3` |

## 範例程式碼

```tsx
import { CheckCircle2, Clock, XCircle, Ban } from "lucide-react";
import { cn } from "@/lib/utils";

type LeaveStatus = "pending" | "approved" | "rejected" | "cancelled";

interface LeaveStatusBadgeProps {
  status: LeaveStatus;
  showIcon?: boolean;
}

const leaveStatusConfig: Record<
  LeaveStatus,
  { label: string; icon: React.ElementType; className: string }
> = {
  pending: {
    label: "待審核",
    icon: Clock,
    className:
      "bg-[hsl(var(--leave-status-pending-bg))] text-[hsl(var(--leave-status-pending-text))]",
  },
  approved: {
    label: "已核准",
    icon: CheckCircle2,
    className:
      "bg-[hsl(var(--leave-status-approved-bg))] text-[hsl(var(--leave-status-approved-text))]",
  },
  rejected: {
    label: "已駁回",
    icon: XCircle,
    className:
      "bg-[hsl(var(--leave-status-rejected-bg))] text-[hsl(var(--leave-status-rejected-text))]",
  },
  cancelled: {
    label: "已取消",
    icon: Ban,
    className:
      "bg-[hsl(var(--leave-status-cancelled-bg))] text-[hsl(var(--leave-status-cancelled-text))]",
  },
};

export function LeaveStatusBadge({ status, showIcon = true }: LeaveStatusBadgeProps) {
  const config = leaveStatusConfig[status];
  if (!config) return null;

  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        config.className
      )}
    >
      {showIcon && <Icon className="h-3 w-3" />}
      {config.label}
    </span>
  );
}
```

## 使用範例

```tsx
<LeaveStatusBadge status="pending" />     // [時] 待審核
<LeaveStatusBadge status="approved" />    // [勾] 已核准
<LeaveStatusBadge status="rejected" />    // [叉] 已駁回
<LeaveStatusBadge status="cancelled" />   // [禁] 已取消

// 不顯示 icon
<LeaveStatusBadge status="approved" showIcon={false} />

// 在表格中使用
<TableCell>
  <LeaveStatusBadge status={row.status} />
</TableCell>
```

## Accessibility

- 使用 `<span>` 語意為 inline 元素
- Icon 為裝飾性（`aria-hidden="true"`）
- 文字標籤提供足夠語意
- 色彩對比度符合 WCAG 2.1 AA
- Dark mode 下使用深背景 + 亮文字

## 色彩 Token

定義於 `design/tokens/leave-colors.css`。

## 使用的 shadcn/ui 元件

- 無直接依賴
