"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { Plus, XCircle, Eye, CheckCircle, X } from "lucide-react";
import { toast } from "sonner";

import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useAuthStore } from "@/lib/auth-store";
import api from "@/lib/api";

const overtimeStatusConfig = {
  pending: {
    label: "待審核",
    className:
      "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  },
  approved: {
    label: "已核准",
    className:
      "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400",
  },
  rejected: {
    label: "已駁回",
    className: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
  },
  cancelled: {
    label: "已取消",
    className:
      "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
  },
} as const;

interface OvertimeRecord {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  hours: number;
  reason: string;
  status: keyof typeof overtimeStatusConfig;
  employee?: { id: string; name: string };
  created_at: string;
}

interface PaginatedResponse {
  data: OvertimeRecord[];
  meta?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export default function OvertimeListPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"my" | "pending">("my");
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [rejectComment, setRejectComment] = useState("");

  const isManagerOrAdmin =
    user?.role === "manager" || user?.role === "admin";

  // My overtime records
  const { data: myData, isLoading: myLoading } = useQuery<PaginatedResponse>({
    queryKey: ["overtime", "my", statusFilter, page],
    queryFn: async () => {
      const params: Record<string, string> = {
        page: String(page),
        limit: "20",
      };
      if (statusFilter !== "all") params.status = statusFilter;
      const res = await api.get("/overtime", { params });
      return res.data;
    },
    enabled: activeTab === "my",
  });

  // Pending approval list (manager/admin only)
  const { data: pendingData, isLoading: pendingLoading } =
    useQuery<PaginatedResponse>({
      queryKey: ["overtime", "pending"],
      queryFn: async () => {
        const res = await api.get("/overtime/pending");
        return res.data;
      },
      enabled: activeTab === "pending" && isManagerOrAdmin,
    });

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.put(`/overtime/${id}/cancel`);
      return res.data;
    },
    onSuccess: () => {
      toast.success("已取消加班申請");
      queryClient.invalidateQueries({ queryKey: ["overtime"] });
    },
    onError: () => {
      toast.error("取消失敗，請稍後再試");
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.put(`/overtime/${id}/approve`);
      return res.data;
    },
    onSuccess: () => {
      toast.success("已核准加班申請");
      queryClient.invalidateQueries({ queryKey: ["overtime"] });
    },
    onError: () => {
      toast.error("核准失敗，請稍後再試");
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, comment }: { id: string; comment: string }) => {
      const res = await api.put(`/overtime/${id}/reject`, { comment });
      return res.data;
    },
    onSuccess: () => {
      toast.success("已駁回加班申請");
      setRejectTarget(null);
      setRejectComment("");
      queryClient.invalidateQueries({ queryKey: ["overtime"] });
    },
    onError: () => {
      toast.error("駁回失敗，請稍後再試");
    },
  });

  const currentData = activeTab === "my" ? myData : pendingData;
  const isLoading = activeTab === "my" ? myLoading : pendingLoading;
  const records = currentData?.data || [];

  return (
    <AppLayout
      breadcrumbs={[{ label: "加班管理" }, { label: "加班紀錄" }]}
    >
      <PageHeader
        title="加班管理"
        description="查看所有加班申請紀錄"
        actions={
          <Button asChild>
            <Link href="/overtime/request">
              <Plus className="mr-2 h-4 w-4" />
              加班申請
            </Link>
          </Button>
        }
      />

      {/* Tab buttons for my / pending */}
      {isManagerOrAdmin && (
        <div className="mb-4 flex gap-2">
          <Button
            variant={activeTab === "my" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("my")}
          >
            我的加班
          </Button>
          <Button
            variant={activeTab === "pending" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("pending")}
          >
            待審核
          </Button>
        </div>
      )}

      {/* Filters (only for my tab) */}
      {activeTab === "my" && (
        <div className="mb-4 flex flex-wrap gap-3">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="狀態" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部狀態</SelectItem>
              <SelectItem value="pending">待審核</SelectItem>
              <SelectItem value="approved">已核准</SelectItem>
              <SelectItem value="rejected">已駁回</SelectItem>
              <SelectItem value="cancelled">已取消</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : records.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-lg font-medium text-muted-foreground">
              {activeTab === "pending" ? "沒有待審核的加班申請" : "尚無加班紀錄"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {activeTab === "pending"
                ? "目前沒有需要審核的加班申請"
                : "點擊右上角按鈕申請加班"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden rounded-lg border md:block">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left text-sm font-medium">
                    日期
                  </th>
                  {activeTab === "pending" && (
                    <th className="px-4 py-3 text-left text-sm font-medium">
                      申請人
                    </th>
                  )}
                  <th className="px-4 py-3 text-left text-sm font-medium">
                    時間
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium">
                    時數
                  </th>
                  <th className="hidden px-4 py-3 text-left text-sm font-medium lg:table-cell">
                    原因
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium">
                    狀態
                  </th>
                  <th className="hidden px-4 py-3 text-left text-sm font-medium lg:table-cell">
                    申請時間
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-medium">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => {
                  const statusCfg = overtimeStatusConfig[record.status];
                  return (
                    <tr
                      key={record.id}
                      className="border-b last:border-0"
                    >
                      <td className="px-4 py-3 text-sm font-medium">
                        {format(parseISO(record.date), "yyyy/MM/dd")}
                      </td>
                      {activeTab === "pending" && (
                        <td className="px-4 py-3 text-sm">
                          {record.employee?.name || "-"}
                        </td>
                      )}
                      <td className="px-4 py-3 text-sm">
                        {record.start_time} ~ {record.end_time}
                      </td>
                      <td className="px-4 py-3 font-mono text-sm text-primary">
                        {record.hours}h
                      </td>
                      <td className="hidden px-4 py-3 text-sm text-muted-foreground lg:table-cell">
                        <span className="line-clamp-1">{record.reason}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusCfg.className}`}
                        >
                          {statusCfg.label}
                        </span>
                      </td>
                      <td className="hidden px-4 py-3 text-sm text-muted-foreground lg:table-cell">
                        {format(
                          parseISO(record.created_at),
                          "yyyy/MM/dd HH:mm"
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          {activeTab === "my" &&
                            record.status === "pending" && (
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                className="text-muted-foreground hover:text-destructive"
                                onClick={() => setCancelTarget(record.id)}
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            )}
                          {activeTab === "pending" && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                className="text-green-600 hover:text-green-700"
                                onClick={() =>
                                  approveMutation.mutate(record.id)
                                }
                                disabled={approveMutation.isPending}
                              >
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                className="text-red-600 hover:text-red-700"
                                onClick={() => setRejectTarget(record.id)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {records.map((record) => {
              const statusCfg = overtimeStatusConfig[record.status];
              return (
                <Card key={record.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">
                        {format(parseISO(record.date), "yyyy/MM/dd")}
                      </span>
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusCfg.className}`}
                      >
                        {statusCfg.label}
                      </span>
                    </div>
                    {activeTab === "pending" && record.employee && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        申請人：{record.employee.name}
                      </p>
                    )}
                    <div className="mt-1 flex items-center gap-2 text-sm">
                      <span>
                        {record.start_time} ~ {record.end_time}
                      </span>
                      <span className="font-mono text-primary">
                        {record.hours}h
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">
                      {record.reason}
                    </p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {format(
                          parseISO(record.created_at),
                          "yyyy/MM/dd HH:mm"
                        )}
                      </span>
                      <div className="flex gap-1">
                        {activeTab === "my" &&
                          record.status === "pending" && (
                            <Button
                              variant="ghost"
                              size="xs"
                              className="text-destructive"
                              onClick={() => setCancelTarget(record.id)}
                            >
                              取消
                            </Button>
                          )}
                        {activeTab === "pending" && (
                          <>
                            <Button
                              variant="ghost"
                              size="xs"
                              className="text-green-600"
                              onClick={() =>
                                approveMutation.mutate(record.id)
                              }
                            >
                              核准
                            </Button>
                            <Button
                              variant="ghost"
                              size="xs"
                              className="text-red-600"
                              onClick={() => setRejectTarget(record.id)}
                            >
                              駁回
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Pagination */}
          {currentData?.meta && currentData.meta.totalPages > 1 && (
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
                {page} / {currentData.meta.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= currentData.meta.totalPages}
                onClick={() => setPage(page + 1)}
              >
                下一頁
              </Button>
            </div>
          )}
        </>
      )}

      {/* Cancel confirmation dialog */}
      <Dialog
        open={!!cancelTarget}
        onOpenChange={(open) => !open && setCancelTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>取消加班申請</DialogTitle>
            <DialogDescription>
              確定要取消這筆加班申請嗎？此操作無法復原。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelTarget(null)}>
              返回
            </Button>
            <Button
              variant="destructive"
              disabled={cancelMutation.isPending}
              onClick={async () => {
                if (cancelTarget) {
                  await cancelMutation.mutateAsync(cancelTarget);
                  setCancelTarget(null);
                }
              }}
            >
              {cancelMutation.isPending ? "取消中..." : "確定取消"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject dialog */}
      <Dialog
        open={!!rejectTarget}
        onOpenChange={(open) => {
          if (!open) {
            setRejectTarget(null);
            setRejectComment("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>駁回加班申請</DialogTitle>
            <DialogDescription>
              請輸入駁回原因。
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="駁回原因（選填）"
            value={rejectComment}
            onChange={(e) => setRejectComment(e.target.value)}
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRejectTarget(null);
                setRejectComment("");
              }}
            >
              返回
            </Button>
            <Button
              variant="destructive"
              disabled={rejectMutation.isPending}
              onClick={() => {
                if (rejectTarget) {
                  rejectMutation.mutate({
                    id: rejectTarget,
                    comment: rejectComment,
                  });
                }
              }}
            >
              {rejectMutation.isPending ? "駁回中..." : "確定駁回"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
