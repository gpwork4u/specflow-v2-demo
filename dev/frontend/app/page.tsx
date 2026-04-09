"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/layout/page-header";
import { CardStats } from "@/components/card-stats";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Clock,
  CalendarDays,
  Users,
  CheckCircle2,
  AlertTriangle,
  LogIn,
  LogOut,
} from "lucide-react";
import Link from "next/link";
import { useAuthStore } from "@/lib/auth-store";
import api from "@/lib/api";

interface TodayStatus {
  clock_in: string | null;
  clock_out: string | null;
  status: string | null;
  date: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated || !user) {
      router.replace("/login");
    }
  }, [isAuthenticated, user, router]);

  const { data: todayStatus, isLoading } = useQuery<TodayStatus>({
    queryKey: ["clock", "today"],
    queryFn: async () => {
      const res = await api.get("/clock/today");
      return res.data;
    },
    refetchInterval: 60 * 1000,
    enabled: !!user,
  });

  if (!user) return null;

  return (
    <AppLayout breadcrumbs={[{ label: "Dashboard" }]}>
      <PageHeader
        title="Dashboard"
        description={`歡迎回來，${user.name}`}
      />

      {/* Admin stats cards */}
      {user.role === "admin" && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <CardStats title="今日出勤" value="--" icon={Users} description="載入中" />
          <CardStats title="準時率" value="--" icon={CheckCircle2} description="載入中" />
          <CardStats title="遲到人數" value="--" icon={AlertTriangle} description="今日" />
          <CardStats title="總員工數" value="--" icon={Users} description="載入中" />
        </div>
      )}

      {/* Manager team summary */}
      {user.role === "manager" && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <CardStats title="團隊出勤" value="--" icon={Users} description="今日" />
          <CardStats title="遲到人數" value="--" icon={AlertTriangle} description="今日" />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Today's clock status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">今日打卡狀態</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <LogIn className="h-4 w-4 text-muted-foreground" />
                    <span>上班打卡</span>
                  </div>
                  <span className="font-medium">
                    {todayStatus?.clock_in
                      ? format(new Date(todayStatus.clock_in), "HH:mm:ss")
                      : "--:--:--"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <LogOut className="h-4 w-4 text-muted-foreground" />
                    <span>下班打卡</span>
                  </div>
                  <span className="font-medium">
                    {todayStatus?.clock_out
                      ? format(new Date(todayStatus.clock_out), "HH:mm:ss")
                      : "--:--:--"}
                  </span>
                </div>
                {todayStatus?.status && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm">狀態</span>
                    <StatusBadge type="attendance" value={todayStatus.status} />
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Quick actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">快速操作</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <Button
              asChild
              variant="outline"
              className="h-auto flex-col gap-2 py-6"
            >
              <Link href="/clock">
                <Clock className="h-8 w-8 text-primary" />
                <span>前往打卡</span>
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="h-auto flex-col gap-2 py-6"
            >
              <Link href="/clock/records">
                <CalendarDays className="h-8 w-8 text-primary" />
                <span>查看紀錄</span>
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
