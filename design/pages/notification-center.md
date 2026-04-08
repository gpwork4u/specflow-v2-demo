# 通知中心頁

## 對應 Feature

#31 F-007: 通知功能

## Layout

```
+------------------------------------------------------+
| Header: [=] 通知中心   [鈴鐺]            [Avatar v]    |
+------------+-----------------------------------------+
| Sidebar    | Main Content                            |
|            |                                         |
| Dashboard  | +-- PageHeader ----------------------+  |
| 打卡       | | 通知中心  [3 未讀]   [全部標為已讀]  |  |
| -----      | | 查看所有系統通知                    |  |
| 請假管理   | +------------------------------------+  |
| -----      |                                         |
| 加班管理   | +-- Tabs --------------------------------+|
| -----      | | [全部] [未讀] [審核結果] [新申請] [提醒]||
| 補打卡管理 | +--------------------------------------+|
| -----      |                                         |
| (主管)     | +-- Notification List -----------------+|
| 待審核     | |                                      ||
| -----      | | [*] [v] 請假已核准          2 小時前  ||
| > 通知中心 | |        您的特休申請（2026/04/10 -    ||
|            | |        2026/04/11）已由 李大華 核准。  ||
|            | | -------------------------------------- ||
|            | | [*] [!] 提醒：尚未打上班卡   今天10:00 ||
|            | |        提醒：您今日尚未打上班卡。      ||
|            | | -------------------------------------- ||
|            | |     [v] 加班已核准            昨天     ||
|            | |        您的加班申請（2026/04/05）     ||
|            | |        已由 李大華 核准。              ||
|            | | -------------------------------------- ||
|            | |     [x] 補打卡被駁回         2 天前   ||
|            | |        您的補打卡申請（2026/04/04）   ||
|            | |        已被 李大華 駁回。              ||
|            | |                                      ||
|            | | [< 1 2 3 >]                         ||
|            | +--------------------------------------+|
|            |                                         |
|            | (空狀態: "目前沒有通知")                  |
+------------+-----------------------------------------+
```

## 頁面規格

| 項目 | 說明 |
|------|------|
| 路由 | `/notifications` |
| 認證 | 需要（任何角色） |
| Layout | `AppLayout` |
| Breadcrumb | `[通知中心]` |

## API 呼叫

| 時機 | API | 用途 |
|------|-----|------|
| 頁面載入 | `GET /api/v1/notifications` | 取得通知列表 |
| 頁面載入 | `GET /api/v1/notifications/unread-count` | 取得未讀數量 |
| 切換 Tab / 分頁 | `GET /api/v1/notifications?is_read=false` | 篩選未讀 |
| 點擊通知 | `PUT /api/v1/notifications/:id/read` | 標記已讀 |
| 全部已讀 | `PUT /api/v1/notifications/read-all` | 全部標記已讀 |

## Tabs 篩選

| Tab | 值 | 篩選邏輯 |
|-----|------|---------|
| 全部 | `all` | 不篩選 |
| 未讀 | `unread` | `is_read=false` |
| 審核結果 | `result` | type 包含 `_approved` 或 `_rejected` |
| 新申請 | `request` | type 包含 `new_` |
| 提醒 | `reminder` | type 包含 `reminder_` |

## 內容區塊

### PageHeader

- 標題旁顯示未讀數量 Badge（`bg-destructive text-destructive-foreground rounded-full px-2 text-xs`）
- 右側 Action：「全部標為已讀」按鈕（僅未讀 > 0 時顯示）

### Tabs

- 使用 shadcn/ui `Tabs` 元件
- 各 Tab 旁可顯示數量 Badge（可選）

### Notification List

- 使用 `NotificationCard` 元件列表渲染
- 按 `created_at` 降序排列
- 分頁：每頁 20 筆

## 範例程式碼

```tsx
import { useState } from "react";
import { AppLayout } from "@/components/layout";
import { PageHeader } from "@/components/page-header";
import { NotificationCard } from "@/components/notification-card";
import { EmptyState } from "@/components/empty-state";
import { LoadingState } from "@/components/loading-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bell, CheckCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/use-toast";

type TabValue = "all" | "unread" | "result" | "request" | "reminder";

const typeCategories: Record<TabValue, (type: string) => boolean> = {
  all: () => true,
  unread: () => true, // 由 API 篩選
  result: (t) => t.includes("_approved") || t.includes("_rejected"),
  request: (t) => t.startsWith("new_"),
  reminder: (t) => t.startsWith("reminder_"),
};

export default function NotificationCenterPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [tab, setTab] = useState<TabValue>("all");
  const [page, setPage] = useState(1);

  const queryParams = new URLSearchParams();
  queryParams.set("page", String(page));
  queryParams.set("limit", "20");
  if (tab === "unread") queryParams.set("is_read", "false");

  const { data: notifications, isLoading } = useQuery({
    queryKey: ["notifications", tab, page],
    queryFn: () =>
      fetch(`/api/v1/notifications?${queryParams}`).then((r) => r.json()),
  });

  const { data: countData } = useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: () =>
      fetch("/api/v1/notifications/unread-count").then((r) => r.json()),
  });

  const markRead = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/v1/notifications/${id}/read`, { method: "PUT" }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const markAllRead = useMutation({
    mutationFn: () =>
      fetch("/api/v1/notifications/read-all", { method: "PUT" }).then((r) => r.json()),
    onSuccess: (data) => {
      toast({ title: `已將 ${data.updated_count} 則通知標為已讀` });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const unreadCount = countData?.count || 0;

  // 前端篩選（result / request / reminder）
  const filteredNotifications =
    tab === "all" || tab === "unread"
      ? notifications?.data || []
      : (notifications?.data || []).filter((n: Notification) =>
          typeCategories[tab](n.type)
        );

  const handleNotificationClick = (id: string) => {
    markRead.mutate(id);
    const n = (notifications?.data || []).find((n: Notification) => n.id === id);
    if (n?.reference_type && n?.reference_id) {
      const routes: Record<string, string> = {
        leave_request: "/leaves",
        overtime_request: "/overtime",
        missed_clock_request: "/missed-clocks",
      };
      const base = routes[n.reference_type];
      if (base) router.push(`${base}/${n.reference_id}`);
    }
  };

  if (isLoading) {
    return (
      <AppLayout breadcrumbs={[{ label: "通知中心" }]}>
        <LoadingState />
      </AppLayout>
    );
  }

  return (
    <AppLayout breadcrumbs={[{ label: "通知中心" }]}>
      <PageHeader
        title={
          <div className="flex items-center gap-2">
            通知中心
            {unreadCount > 0 && (
              <Badge variant="destructive" className="rounded-full px-2 text-xs">
                {unreadCount} 未讀
              </Badge>
            )}
          </div>
        }
        description="查看所有系統通知"
        actions={
          unreadCount > 0 ? (
            <Button
              variant="outline"
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
            >
              <CheckCheck className="mr-2 h-4 w-4" />
              全部標為已讀
            </Button>
          ) : null
        }
      />

      <Tabs value={tab} onValueChange={(v) => { setTab(v as TabValue); setPage(1); }}>
        <TabsList>
          <TabsTrigger value="all">全部</TabsTrigger>
          <TabsTrigger value="unread">
            未讀
            {unreadCount > 0 && (
              <Badge variant="secondary" className="ml-1.5 rounded-full px-1.5 text-xs">
                {unreadCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="result">審核結果</TabsTrigger>
          <TabsTrigger value="request">新申請</TabsTrigger>
          <TabsTrigger value="reminder">提醒</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          {filteredNotifications.length === 0 ? (
            <EmptyState
              icon="bell"
              title={tab === "unread" ? "沒有未讀通知" : "目前沒有通知"}
              description={
                tab === "unread"
                  ? "所有通知都已讀取"
                  : "當有新的通知時，會顯示在這裡"
              }
            />
          ) : (
            <div className="divide-y rounded-lg border">
              {filteredNotifications.map((n: Notification) => (
                <NotificationCard
                  key={n.id}
                  notification={n}
                  onClick={handleNotificationClick}
                />
              ))}
            </div>
          )}

          {/* 分頁 */}
          {notifications?.meta && notifications.meta.totalPages > 1 && (
            <div className="mt-4 flex justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                上一頁
              </Button>
              <span className="flex items-center px-3 text-sm text-muted-foreground">
                {page} / {notifications.meta.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= notifications.meta.totalPages}
                onClick={() => setPage(page + 1)}
              >
                下一頁
              </Button>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}
```

## Sidebar 導航更新

Sprint 4 新增的導航項目：

```
加班管理
+-- 加班申請     (/overtime/new)
+-- 加班紀錄     (/overtime)
-----
補打卡管理
+-- 補打卡申請   (/missed-clocks/new)
+-- 補打卡紀錄   (/missed-clocks)
-----
主管 (role: manager/admin)
+-- 待審核       (/approvals/pending)     <- Badge 顯示數量（含加班+補打卡+請假）
-----
通知中心         (/notifications)          <- Badge 顯示未讀數量
```

## 響應式行為

| 斷點 | 變化 |
|------|------|
| >= 1024px (lg) | Sidebar 固定，通知列表最大寬度 max-w-3xl |
| 768-1023px (md) | Sidebar 可收合，通知列表佔滿 |
| < 768px | Sidebar 隱藏，Tabs 改為可水平滾動，通知列表全寬 |

## Accessibility

- Tabs 支援鍵盤切換（Arrow keys）
- NotificationCard 使用 `<button>` 支援 Enter/Space
- 未讀 Badge 有 `aria-label`
- 空狀態有文字說明
- 分頁按鈕有 `disabled` 狀態
- 「全部標為已讀」有 loading 狀態

## 使用的元件

| 元件 | 來源 |
|------|------|
| AppLayout, PageHeader | `components/layout` |
| NotificationCard | `components/notification-card` |
| EmptyState | `components/empty-state` |
| LoadingState | `components/loading-state` |
| Tabs, TabsContent, TabsList, TabsTrigger | shadcn/ui |
| Badge | shadcn/ui |
| Button | shadcn/ui |
