# NotificationCard

## 用途

通知中心的單則通知卡片元件，顯示通知類型圖示、標題、內容摘要、時間、已讀/未讀狀態。點擊可跳轉到對應的申請詳情頁並標記為已讀。

## Props

| Prop | Type | Default | 說明 |
|------|------|---------|------|
| notification | `Notification` | - | 通知資料 |
| onClick | `(id: string) => void` | - | 點擊回呼（標記已讀 + 跳轉） |

### Types

```ts
type NotificationType =
  | "leave_approved"
  | "leave_rejected"
  | "overtime_approved"
  | "overtime_rejected"
  | "missed_clock_approved"
  | "missed_clock_rejected"
  | "new_leave_request"
  | "new_overtime_request"
  | "new_missed_clock_request"
  | "reminder_clock_in"
  | "reminder_leave_expiry";

interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  content: string;
  reference_type: string | null;
  reference_id: string | null;
  is_read: boolean;
  created_at: string; // ISO datetime
}
```

## Layout

```
未讀狀態:
+-------------------------------------------------+
| [*] [圖示]  請假已核准                   2 小時前 |
|             您的特休申請（2026/04/10 -    [未讀] |
|             2026/04/11）已由 李大華 核准。         |
+-------------------------------------------------+

已讀狀態:
+-------------------------------------------------+
|     [圖示]  請假已核准                   2 小時前 |
|             您的特休申請（2026/04/10 -           |
|             2026/04/11）已由 李大華 核准。         |
+-------------------------------------------------+
```

## 通知類型圖示與顏色

| Type | 圖示 | 顏色 | 分類 |
|------|------|------|------|
| `leave_approved` | `CheckCircle2` | `text-green-600` | 審核結果 |
| `leave_rejected` | `XCircle` | `text-destructive` | 審核結果 |
| `overtime_approved` | `CheckCircle2` | `text-green-600` | 審核結果 |
| `overtime_rejected` | `XCircle` | `text-destructive` | 審核結果 |
| `missed_clock_approved` | `CheckCircle2` | `text-green-600` | 審核結果 |
| `missed_clock_rejected` | `XCircle` | `text-destructive` | 審核結果 |
| `new_leave_request` | `FileText` | `text-blue-600` | 新申請 |
| `new_overtime_request` | `Clock` | `text-blue-600` | 新申請 |
| `new_missed_clock_request` | `FileEdit` | `text-blue-600` | 新申請 |
| `reminder_clock_in` | `AlertCircle` | `text-amber-600` | 提醒 |
| `reminder_leave_expiry` | `AlertTriangle` | `text-amber-600` | 提醒 |

## 外觀規格

| 部位 | 樣式 |
|------|------|
| 容器（未讀） | `flex gap-3 p-4 rounded-lg bg-primary/5 border border-primary/10 cursor-pointer hover:bg-primary/10 transition-colors` |
| 容器（已讀） | `flex gap-3 p-4 rounded-lg bg-transparent cursor-pointer hover:bg-muted transition-colors` |
| 未讀指示圓點 | `h-2 w-2 rounded-full bg-primary shrink-0 mt-2` |
| 類型圖示 | `h-5 w-5 shrink-0 mt-0.5` + 對應顏色 |
| 標題 | 未讀: `text-sm font-semibold`；已讀: `text-sm font-medium text-muted-foreground` |
| 內容 | `text-sm text-muted-foreground line-clamp-2` |
| 時間 | `text-xs text-muted-foreground whitespace-nowrap` |

## 範例程式碼

```tsx
import { formatDistanceToNow, parseISO } from "date-fns";
import { zhTW } from "date-fns/locale";
import {
  CheckCircle2, XCircle, FileText, Clock, FileEdit,
  AlertCircle, AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

const notificationConfig: Record<
  NotificationType,
  { icon: React.ElementType; iconClass: string }
> = {
  leave_approved: { icon: CheckCircle2, iconClass: "text-green-600" },
  leave_rejected: { icon: XCircle, iconClass: "text-destructive" },
  overtime_approved: { icon: CheckCircle2, iconClass: "text-green-600" },
  overtime_rejected: { icon: XCircle, iconClass: "text-destructive" },
  missed_clock_approved: { icon: CheckCircle2, iconClass: "text-green-600" },
  missed_clock_rejected: { icon: XCircle, iconClass: "text-destructive" },
  new_leave_request: { icon: FileText, iconClass: "text-blue-600" },
  new_overtime_request: { icon: Clock, iconClass: "text-blue-600" },
  new_missed_clock_request: { icon: FileEdit, iconClass: "text-blue-600" },
  reminder_clock_in: { icon: AlertCircle, iconClass: "text-amber-600" },
  reminder_leave_expiry: { icon: AlertTriangle, iconClass: "text-amber-600" },
};

interface NotificationCardProps {
  notification: Notification;
  onClick: (id: string) => void;
}

export function NotificationCard({ notification, onClick }: NotificationCardProps) {
  const { type, title, content, is_read, created_at, id } = notification;
  const config = notificationConfig[type];
  const Icon = config?.icon || AlertCircle;
  const iconClass = config?.iconClass || "text-muted-foreground";

  const timeAgo = formatDistanceToNow(parseISO(created_at), {
    addSuffix: true,
    locale: zhTW,
  });

  return (
    <button
      type="button"
      onClick={() => onClick(id)}
      className={cn(
        "flex w-full gap-3 rounded-lg p-4 text-left transition-colors",
        is_read
          ? "bg-transparent hover:bg-muted"
          : "border border-primary/10 bg-primary/5 hover:bg-primary/10"
      )}
    >
      {/* 未讀指示圓點 */}
      <div className="flex shrink-0 items-start pt-1.5">
        {!is_read && (
          <span className="h-2 w-2 rounded-full bg-primary" aria-label="未讀" />
        )}
        {is_read && <span className="h-2 w-2" />}
      </div>

      {/* 類型圖示 */}
      <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", iconClass)} aria-hidden="true" />

      {/* 內容 */}
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <p
            className={cn(
              "text-sm",
              is_read ? "font-medium text-muted-foreground" : "font-semibold"
            )}
          >
            {title}
          </p>
          <span className="shrink-0 text-xs text-muted-foreground">
            {timeAgo}
          </span>
        </div>
        <p className="line-clamp-2 text-sm text-muted-foreground">{content}</p>
      </div>
    </button>
  );
}
```

## 使用範例

```tsx
// 在通知列表中使用
{notifications.map((n) => (
  <NotificationCard
    key={n.id}
    notification={n}
    onClick={(id) => {
      markAsRead(id);
      navigateToReference(n.reference_type, n.reference_id);
    }}
  />
))}
```

## 跳轉規則

| reference_type | 跳轉路由 |
|---------------|---------|
| `leave_request` | `/leaves/{reference_id}` |
| `overtime_request` | `/overtime/{reference_id}` |
| `missed_clock_request` | `/missed-clocks/{reference_id}` |
| `null`（提醒類） | 不跳轉，僅標記已讀 |

## 響應式行為

| 斷點 | Layout |
|------|--------|
| >= 768px (md) | 標準寬度，內容單行或兩行 |
| < 768px | 全寬，content 最多顯示 2 行 |

## Accessibility

- 使用 `<button>` 包裹整張卡片，支援鍵盤 Enter/Space 觸發
- 未讀圓點有 `aria-label="未讀"` 供 screen reader 讀取
- Icon 設為 `aria-hidden="true"`（裝飾性）
- `line-clamp-2` 截斷內容，完整內容可在詳情頁查看
- 時間使用相對格式（「2 小時前」），提升可讀性
- hover 狀態有背景色變化提供視覺回饋
- focus-visible 有 outline ring

## 使用的 shadcn/ui 元件

- 無直接使用 shadcn/ui 元件（純自訂元件）
- 依賴 `cn` utility（來自 shadcn/ui 設定）
- 依賴 `date-fns` + `zhTW` locale
- 依賴 `lucide-react` icons
