# EmptyState

## 用途

無資料時的提示畫面。當列表為空、搜尋無結果時顯示。提供 icon、標題、描述和可選的操作按鈕。

## Props

| Prop | Type | Default | 說明 |
|------|------|---------|------|
| icon | `LucideIcon` | `Inbox` | 圖示 |
| title | `string` | `"沒有資料"` | 標題 |
| description | `string` | - | 描述文字 |
| action | `ReactNode` | - | 操作按鈕（選填） |

## 外觀規格

| 部位 | 樣式 |
|------|------|
| 容器 | `flex flex-col items-center justify-center py-12` |
| Icon | `h-12 w-12 text-muted-foreground/50` |
| Title | `mt-4 text-lg font-medium` |
| Description | `mt-1 text-sm text-muted-foreground text-center max-w-sm` |
| Action | `mt-4` |

## 範例程式碼

```tsx
import { LucideIcon, Inbox } from "lucide-react";

interface EmptyStateProps {
  icon?: LucideIcon;
  title?: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({
  icon: Icon = Inbox,
  title = "沒有資料",
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <Icon className="h-12 w-12 text-muted-foreground/50" />
      <h3 className="mt-4 text-lg font-medium">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-center text-sm text-muted-foreground">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
```

## 使用範例

```tsx
import { Users, Search, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

// 員工列表為空
<EmptyState
  icon={Users}
  title="尚無員工"
  description="開始新增員工來管理您的團隊"
  action={
    <Button>
      <Plus className="mr-2 h-4 w-4" />
      新增員工
    </Button>
  }
/>

// 搜尋無結果
<EmptyState
  icon={Search}
  title="找不到結果"
  description="嘗試調整搜尋條件或篩選器"
/>

// 部門列表為空
<EmptyState
  icon={Building2}
  title="尚無部門"
  description="建立部門來組織您的團隊結構"
  action={
    <Button>
      <Plus className="mr-2 h-4 w-4" />
      新增部門
    </Button>
  }
/>

// 打卡紀錄為空
<EmptyState
  icon={CalendarDays}
  title="這個月沒有打卡紀錄"
  description="選擇其他月份查看"
/>
```

## Accessibility

- Icon 為裝飾性（`aria-hidden`）
- 標題使用 `<h3>` 保持語意結構
- Action 按鈕可 focus，提供明確的操作路徑
