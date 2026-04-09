"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCheck } from "lucide-react";
import { toast } from "sonner";

import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/layout/page-header";
import {
  NotificationCard,
  type NotificationItem,
} from "@/components/notification-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import api from "@/lib/api";

type TabValue = "all" | "unread" | "result" | "request" | "reminder";

const typeCategories: Record<TabValue, (type: string) => boolean> = {
  all: () => true,
  unread: () => true,
  result: (t) => t.includes("_approved") || t.includes("_rejected"),
  request: (t) => t.startsWith("new_"),
  reminder: (t) => t.startsWith("reminder_"),
};

interface PaginatedNotifications {
  data: NotificationItem[];
  meta?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export default function NotificationCenterPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<TabValue>("all");
  const [page, setPage] = useState(1);

  const { data: notifications, isLoading } = useQuery<PaginatedNotifications>({
    queryKey: ["notifications", tab, page],
    queryFn: async () => {
      const params: Record<string, string> = {
        page: String(page),
        limit: "20",
      };
      if (tab === "unread") params.is_read = "false";
      const res = await api.get("/notifications", { params });
      return res.data;
    },
  });

  const { data: countData } = useQuery<{ count: number }>({
    queryKey: ["notifications", "unread-count"],
    queryFn: async () => {
      const res = await api.get("/notifications/unread-count");
      return res.data;
    },
  });

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.put(`/notifications/${id}/read`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      const res = await api.put("/notifications/read-all");
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(`已將 ${data.updated_count || 0} 則通知標為已讀`);
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const unreadCount = countData?.count || 0;

  // Client-side filtering for result/request/reminder tabs
  const filteredNotifications =
    tab === "all" || tab === "unread"
      ? notifications?.data || []
      : (notifications?.data || []).filter((n) =>
          typeCategories[tab](n.type)
        );

  const handleNotificationClick = (id: string) => {
    markRead.mutate(id);
    const n = (notifications?.data || []).find((item) => item.id === id);
    if (n?.reference_type && n?.reference_id) {
      const routes: Record<string, string> = {
        leave_request: "/leave/my",
        overtime_request: "/overtime",
        missed_clock_request: "/missed-clock",
      };
      const base = routes[n.reference_type];
      if (base) router.push(base);
    }
  };

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
          ) : undefined
        }
      />

      <Tabs
        value={tab}
        onValueChange={(v) => {
          setTab(v as TabValue);
          setPage(1);
        }}
      >
        <TabsList className="overflow-x-auto">
          <TabsTrigger value="all">全部</TabsTrigger>
          <TabsTrigger value="unread">
            未讀
            {unreadCount > 0 && (
              <Badge
                variant="secondary"
                className="ml-1.5 rounded-full px-1.5 text-xs"
              >
                {unreadCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="result">審核結果</TabsTrigger>
          <TabsTrigger value="request">新申請</TabsTrigger>
          <TabsTrigger value="reminder">提醒</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : filteredNotifications.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <p className="text-lg font-medium text-muted-foreground">
                  {tab === "unread" ? "沒有未讀通知" : "目前沒有通知"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {tab === "unread"
                    ? "所有通知都已讀取"
                    : "當有新的通知時，會顯示在這裡"}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="max-w-3xl">
              <div className="divide-y rounded-lg border">
                {filteredNotifications.map((n) => (
                  <NotificationCard
                    key={n.id}
                    notification={n}
                    onClick={handleNotificationClick}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Pagination */}
          {notifications?.meta &&
            notifications.meta.totalPages > 1 && (
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
