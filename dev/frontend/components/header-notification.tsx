"use client";

import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { NotificationBell } from "@/components/notification-bell";
import type { NotificationItem } from "@/components/notification-card";
import api from "@/lib/api";

export function HeaderNotification() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: countData } = useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: async () => {
      const res = await api.get("/notifications/unread-count");
      return res.data;
    },
    refetchInterval: 30000,
  });

  const { data: recentData } = useQuery({
    queryKey: ["notifications", "recent"],
    queryFn: async () => {
      const res = await api.get("/notifications", { params: { limit: 5 } });
      return res.data;
    },
    refetchInterval: 30000,
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      const res = await api.put("/notifications/read-all");
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
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

  const handleNotificationClick = (id: string) => {
    markRead.mutate(id);
    const notifications: NotificationItem[] = recentData?.data || [];
    const n = notifications.find((item) => item.id === id);
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
    <NotificationBell
      unreadCount={countData?.count || 0}
      notifications={recentData?.data || []}
      onNotificationClick={handleNotificationClick}
      onMarkAllRead={() => markAllRead.mutate()}
      onViewAll={() => router.push("/notifications")}
    />
  );
}
