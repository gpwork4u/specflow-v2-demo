"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { AppLayout, PageHeader } from "@/components/layout";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { LeaveTypeBadge } from "@/components/leave-type-badge";
import { LeaveStatusBadge } from "@/components/leave-status-badge";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Pagination } from "@/components/pagination";
import api from "@/lib/api";
import {
  LEAVE_TYPE_OPTIONS,
  LEAVE_STATUS_OPTIONS,
  type LeaveRecord,
  type PaginatedResponse,
  type LeaveType,
  type LeaveStatus,
} from "@/lib/leave-types";

export default function LeaveRecordsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [cancelTarget, setCancelTarget] = useState<LeaveRecord | null>(null);

  const queryParams = {
    page,
    limit: 20,
    ...(statusFilter !== "all" && { status: statusFilter }),
    ...(typeFilter !== "all" && { leave_type: typeFilter }),
  };

  const { data, isLoading } = useQuery({
    queryKey: ["leaves", queryParams],
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<LeaveRecord>>(
        "/leaves",
        { params: queryParams }
      );
      return data;
    },
  });

  const cancelLeave = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.put(`/leaves/${id}/cancel`);
      return data;
    },
    onSuccess: () => {
      toast.success("請假申請已取消");
      queryClient.invalidateQueries({ queryKey: ["leaves"] });
      queryClient.invalidateQueries({ queryKey: ["leave-quotas"] });
      setCancelTarget(null);
    },
    onError: (err: any) => {
      const code = err?.response?.data?.code;
      const messages: Record<string, string> = {
        CANNOT_CANCEL: "此請假單無法取消",
        LEAVE_STARTED: "請假日期已開始，無法取消",
        FORBIDDEN: "無權取消此請假單",
      };
      toast.error(messages[code] || "取消失敗，請稍後再試");
      setCancelTarget(null);
    },
  });

  const canCancel = (leave: LeaveRecord) =>
    leave.status === "pending" || leave.status === "approved";

  return (
    <AppLayout
      breadcrumbs={[
        { label: "請假管理" },
        { label: "請假紀錄" },
      ]}
    >
      <PageHeader
        title="我的請假紀錄"
        description="查看所有請假申請紀錄"
        actions={
          <Button asChild>
            <Link href="/leaves/request">
              <Plus className="h-4 w-4" />
              請假申請
            </Link>
          </Button>
        }
      />

      {/* 篩選器 */}
      <div className="mb-4 flex flex-wrap gap-3">
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="狀態" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部狀態</SelectItem>
            {LEAVE_STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="假別" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部假別</SelectItem>
            {LEAVE_TYPE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 表格 */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : !data?.data?.length ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <p className="text-lg font-medium">尚無請假紀錄</p>
          <p className="mt-1 text-sm">點擊右上方按鈕新增請假申請</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>假別</TableHead>
                  <TableHead>日期</TableHead>
                  <TableHead className="text-right">時數</TableHead>
                  <TableHead>狀態</TableHead>
                  <TableHead>申請時間</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.map((leave) => (
                  <TableRow key={leave.id}>
                    <TableCell>
                      <LeaveTypeBadge type={leave.leave_type} />
                    </TableCell>
                    <TableCell>
                      {format(new Date(leave.start_date), "MM/dd")}
                      {leave.start_date !== leave.end_date &&
                        ` ~ ${format(new Date(leave.end_date), "MM/dd")}`}
                    </TableCell>
                    <TableCell className="text-right">
                      {leave.hours}h
                    </TableCell>
                    <TableCell>
                      <LeaveStatusBadge status={leave.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {format(new Date(leave.created_at), "yyyy/MM/dd HH:mm")}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/leaves/${leave.id}`}>查看</Link>
                        </Button>
                        {canCancel(leave) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setCancelTarget(leave)}
                          >
                            取消
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* 分頁 */}
          <div className="mt-4">
            <Pagination
              page={data.meta.page}
              totalPages={data.meta.totalPages}
              onPageChange={setPage}
            />
          </div>
        </>
      )}

      {/* 取消確認 Dialog */}
      <ConfirmDialog
        open={!!cancelTarget}
        onOpenChange={(open) => !open && setCancelTarget(null)}
        title="取消請假申請"
        description={
          cancelTarget
            ? `確定要取消這筆${cancelTarget.status === "approved" ? "已核准的" : ""}請假申請嗎？`
            : ""
        }
        confirmLabel="確認取消"
        variant="destructive"
        isLoading={cancelLeave.isPending}
        onConfirm={() => cancelTarget && cancelLeave.mutate(cancelTarget.id)}
      />
    </AppLayout>
  );
}
