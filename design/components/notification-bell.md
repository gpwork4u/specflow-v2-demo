# NotificationBell

## 用途

Header 右上角的通知鈴鐺按鈕，顯示未讀通知數量 Badge。點擊可展開通知預覽下拉面板或跳轉到通知中心頁。使用 polling（每 30 秒）或 WebSocket 即時更新未讀數量。

## Props

| Prop | Type | Default | 說明 |
|------|------|---------|------|
| unreadCount | `number` | `0` | 未讀通知數量 |
| notifications | `Notification[]` | `[]` | 最近通知列表（最多 5 筆，用於預覽面板） |
| onNotificationClick | `(id: string) => void` | - | 點擊單則通知回呼 |
| onMarkAllRead | `() => void` | - | 全部已讀回呼 |
| onViewAll | `() => void` | - | 查看全部回呼（跳轉通知中心） |

## Layout

### 鈴鐺按鈕

```
+------+
| [鈴] |
| [3]  |  <- 紅色 Badge（未讀 > 0 時顯示）
+------+
```

### 預覽下拉面板

```
+-------------------------------------------+
| 通知                     [全部標為已讀]     |
+--------------------------------------------|
| [*] [v] 請假已核准              2 小時前    |
|         您的特休申請...                     |
+--------------------------------------------|
| [*] [!] 提醒：尚未打上班卡       今天 10:00 |
|         提醒：您今日尚未打上班卡。           |
+--------------------------------------------|
|     [v] 加班已核准              昨天        |
|         您的加班申請...                     |
+--------------------------------------------|
|              查看所有通知 ->                 |
+-------------------------------------------+
```

## 外觀規格

| 部位 | 樣式 |
|------|------|
| 鈴鐺按鈕 | `Button variant="ghost" size="icon" className="relative"` |
| 鈴鐺 Icon | `Bell` h-5 w-5 |
| Badge | `absolute -top-1 -right-1 h-5 min-w-5 rounded-full bg-destructive px-1 text-xs font-medium text-destructive-foreground flex items-center justify-center` |
| Badge（> 99） | 顯示 "99+" |
| 下拉面板 | shadcn/ui `Popover`，`w-[380px] p-0` |
| 面板 Header | `flex items-center justify-between px-4 py-3 border-b` |
| 面板標題 | `text-sm font-semibold` |
| 全部已讀按鈕 | `Button variant="ghost" size="sm" text-xs text-primary` |
| 通知列表 | `max-h-[400px] overflow-y-auto divide-y` |
| 每則通知 | `NotificationCard`（精簡版，padding 較小） |
| 查看全部 | `block w-full border-t px-4 py-3 text-center text-sm text-primary hover:bg-muted` |

## 範例程式碼

```tsx
import { Bell } from "lucide-react";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { NotificationCard } from "@/components/notification-card";
import { cn } from "@/lib/utils";

interface NotificationBellProps {
  unreadCount: number;
  notifications: Notification[];
  onNotificationClick: (id: string) => void;
  onMarkAllRead: () => void;
  onViewAll: () => void;
}

export function NotificationBell({
  unreadCount,
  notifications,
  onNotificationClick,
  onMarkAllRead,
  onViewAll,
}: NotificationBellProps) {
  const displayCount = unreadCount > 99 ? "99+" : unreadCount;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={`通知${unreadCount > 0 ? `，${unreadCount} 則未讀` : ""}`}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span
              className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-xs font-medium text-destructive-foreground"
              aria-hidden="true"
            >
              {displayCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[380px] p-0" align="end" sideOffset={8}>
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="text-sm font-semibold">通知</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-primary"
              onClick={onMarkAllRead}
            >
              全部標為已讀
            </Button>
          )}
        </div>

        {/* 通知列表 */}
        <div className="max-h-[400px] divide-y overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Bell className="mb-2 h-8 w-8 opacity-30" />
              <p className="text-sm">目前沒有通知</p>
            </div>
          ) : (
            notifications.map((n) => (
              <NotificationCard
                key={n.id}
                notification={n}
                onClick={onNotificationClick}
              />
            ))
          )}
        </div>

        {/* 查看全部 */}
        {notifications.length > 0 && (
          <button
            type="button"
            className="block w-full border-t px-4 py-3 text-center text-sm text-primary transition-colors hover:bg-muted"
            onClick={onViewAll}
          >
            查看所有通知
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}
```

## 使用範例

```tsx
// 在 Header / Navbar 中使用
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

function HeaderNotification() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: countData } = useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: () => fetch("/api/v1/notifications/unread-count").then((r) => r.json()),
    refetchInterval: 30000, // 每 30 秒 polling
  });

  const { data: recentData } = useQuery({
    queryKey: ["notifications", "recent"],
    queryFn: () => fetch("/api/v1/notifications?limit=5").then((r) => r.json()),
  });

  const markAllRead = useMutation({
    mutationFn: () =>
      fetch("/api/v1/notifications/read-all", { method: "PUT" }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const markRead = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/v1/notifications/${id}/read`, { method: "PUT" }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  return (
    <NotificationBell
      unreadCount={countData?.count || 0}
      notifications={recentData?.data || []}
      onNotificationClick={(id) => {
        markRead.mutate(id);
        const n = recentData?.data?.find((n: Notification) => n.id === id);
        if (n?.reference_type && n?.reference_id) {
          const routes: Record<string, string> = {
            leave_request: "/leaves",
            overtime_request: "/overtime",
            missed_clock_request: "/missed-clocks",
          };
          router.push(`${routes[n.reference_type]}/${n.reference_id}`);
        }
      }}
      onMarkAllRead={() => markAllRead.mutate()}
      onViewAll={() => router.push("/notifications")}
    />
  );
}
```

## 即時更新策略

| 策略 | 實作 | 優點 | 缺點 |
|------|------|------|------|
| Polling | `refetchInterval: 30000` | 實作簡單 | 延遲最多 30 秒 |
| WebSocket | 後端推送 event | 即時 | 需要 WebSocket 基礎建設 |

Sprint 4 先使用 Polling（30 秒），未來可升級為 WebSocket。

## Accessibility

- 鈴鐺按鈕有動態 `aria-label`（含未讀數量）
- Badge 設為 `aria-hidden="true"`（資訊已在 aria-label 中）
- Popover 自動 trap focus
- 通知列表可用 Tab 鍵逐一瀏覽
- 空狀態有文字說明
- 「全部標為已讀」按鈕僅在有未讀時顯示
- 「查看所有通知」按鈕為 `<button>` 支援鍵盤操作

## 使用的元件

| 元件 | 來源 |
|------|------|
| Popover, PopoverContent, PopoverTrigger | shadcn/ui |
| Button | shadcn/ui |
| NotificationCard | `design/components/notification-card` |
