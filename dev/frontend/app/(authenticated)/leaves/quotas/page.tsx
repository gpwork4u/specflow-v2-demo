"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { AppLayout, PageHeader } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { QuotaProgressBar } from "@/components/quota-progress-bar";
import { useAuthStore } from "@/lib/auth-store";
import api from "@/lib/api";
import { LEAVE_TYPES, type LeaveQuota, type LeaveType } from "@/lib/leave-types";

interface EmployeeQuotaData {
  user_id: string;
  year: number;
  quotas: LeaveQuota[];
}

export default function LeaveQuotasPage() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isAdmin = user?.role === "admin";
  const currentYear = new Date().getFullYear();

  const [searchUserId, setSearchUserId] = useState("");
  const [activeUserId, setActiveUserId] = useState<string | null>(null);
  const [editQuota, setEditQuota] = useState<LeaveQuota | null>(null);
  const [editValue, setEditValue] = useState("");

  // 個人額度
  const { data: myQuotas, isLoading: myLoading } = useQuery({
    queryKey: ["leave-quotas", "me", currentYear],
    queryFn: async () => {
      const { data } = await api.get<EmployeeQuotaData>(
        "/leave-quotas/me",
        { params: { year: currentYear } }
      );
      return data;
    },
  });

  // Admin: 查詢指定員工的額度
  const { data: employeeQuotas, isLoading: empLoading } = useQuery({
    queryKey: ["leave-quotas", "employee", activeUserId, currentYear],
    queryFn: async () => {
      if (!activeUserId) return null;
      const { data } = await api.get<EmployeeQuotaData>(
        `/leave-quotas/employees/${activeUserId}`,
        { params: { year: currentYear } }
      );
      return data;
    },
    enabled: !!activeUserId && isAdmin,
  });

  const updateQuota = useMutation({
    mutationFn: async ({
      userId,
      leaveType,
      totalHours,
    }: {
      userId: string;
      leaveType: string;
      totalHours: number;
    }) => {
      const { data } = await api.put(
        `/leave-quotas/employees/${userId}`,
        {
          year: currentYear,
          quotas: [{ leave_type: leaveType, total_hours: totalHours }],
        }
      );
      return data;
    },
    onSuccess: () => {
      toast.success("額度已更新");
      queryClient.invalidateQueries({ queryKey: ["leave-quotas"] });
      setEditQuota(null);
    },
    onError: (err: any) => {
      const code = err?.response?.data?.code;
      if (code === "QUOTA_BELOW_USED") {
        toast.error("額度不可低於已使用時數");
      } else {
        toast.error("更新失敗");
      }
    },
  });

  const handleSearch = () => {
    if (searchUserId.trim()) {
      setActiveUserId(searchUserId.trim());
    }
  };

  const openEdit = (quota: LeaveQuota) => {
    setEditQuota(quota);
    setEditValue(String(quota.total_hours));
  };

  const submitEdit = () => {
    if (!editQuota || !activeUserId) return;
    const totalHours = parseFloat(editValue);
    if (isNaN(totalHours) || totalHours < 0) {
      toast.error("請輸入有效的數字");
      return;
    }
    updateQuota.mutate({
      userId: activeUserId,
      leaveType: editQuota.leave_type,
      totalHours,
    });
  };

  return (
    <AppLayout
      breadcrumbs={[
        { label: "請假管理" },
        { label: "假別額度" },
      ]}
    >
      <PageHeader
        title="假別額度"
        description={isAdmin ? "管理員工假別額度" : "查看個人假別額度"}
      />

      {/* 個人額度 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>
            我的 {currentYear} 年度額度
          </CardTitle>
        </CardHeader>
        <CardContent>
          {myLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : !myQuotas?.quotas?.length ? (
            <p className="text-muted-foreground">尚無額度資料</p>
          ) : (
            <div className="space-y-4">
              {myQuotas.quotas.map((q) => (
                <QuotaProgressBar key={q.id} quota={q} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Admin: 員工額度管理 */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>員工額度管理</CardTitle>
          </CardHeader>
          <CardContent>
            {/* 搜尋欄 */}
            <div className="mb-4 flex gap-2">
              <Input
                placeholder="輸入員工 ID"
                value={searchUserId}
                onChange={(e) => setSearchUserId(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="max-w-xs"
              />
              <Button onClick={handleSearch}>查詢</Button>
            </div>

            {empLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : activeUserId && !employeeQuotas?.quotas?.length ? (
              <p className="text-muted-foreground">
                找不到此員工的額度資料
              </p>
            ) : employeeQuotas?.quotas ? (
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>假別</TableHead>
                      <TableHead className="text-right">
                        總額度 (小時)
                      </TableHead>
                      <TableHead className="text-right">
                        已使用 (小時)
                      </TableHead>
                      <TableHead className="text-right">
                        剩餘 (小時)
                      </TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {employeeQuotas.quotas.map((q) => (
                      <TableRow key={q.id}>
                        <TableCell className="font-medium">
                          {q.leave_type_label ||
                            LEAVE_TYPES[q.leave_type as LeaveType] ||
                            q.leave_type}
                        </TableCell>
                        <TableCell className="text-right">
                          {q.total_hours}
                        </TableCell>
                        <TableCell className="text-right">
                          {q.used_hours}
                        </TableCell>
                        <TableCell className="text-right">
                          {q.remaining_hours}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEdit(q)}
                          >
                            調整
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}

      {/* 編輯 Dialog */}
      <Dialog
        open={!!editQuota}
        onOpenChange={(open) => !open && setEditQuota(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>調整額度</DialogTitle>
            <DialogDescription>
              調整{" "}
              {editQuota
                ? editQuota.leave_type_label ||
                  LEAVE_TYPES[editQuota.leave_type as LeaveType]
                : ""}{" "}
              的年度總額度（小時）。已使用：{editQuota?.used_hours ?? 0} 小時
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="quota-hours">總額度（小時）</Label>
            <Input
              id="quota-hours"
              type="number"
              step="0.5"
              min="0"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditQuota(null)}
              disabled={updateQuota.isPending}
            >
              取消
            </Button>
            <Button
              onClick={submitEdit}
              disabled={updateQuota.isPending}
            >
              {updateQuota.isPending ? "儲存中..." : "儲存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
