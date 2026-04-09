"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";

import { AppLayout, PageHeader } from "@/components/layout";
import { Button } from "@/components/ui/button";
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
import { LeaveApprovalModal } from "@/components/leave-approval-modal";
import { Pagination } from "@/components/pagination";
import api from "@/lib/api";
import type { LeaveRecord, PaginatedResponse } from "@/lib/leave-types";

export default function LeavePendingPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<LeaveRecord | null>(null);
  const [action, setAction] = useState<"approve" | "reject" | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["leaves", "pending", page],
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<LeaveRecord>>(
        "/leaves/pending",
        { params: { page, limit: 20 } }
      );
      return data;
    },
  });

  const approveMutation = useMutation({
    mutationFn: async ({
      id,
      comment,
    }: {
      id: string;
      comment: string;
    }) => {
      const { data } = await api.put(`/leaves/${id}/approve`, {
        ...(comment && { comment }),
      });
      return data;
    },
    onSuccess: () => {
      toast.success("已核准");
      queryClient.invalidateQueries({ queryKey: ["leaves"] });
      setSelected(null);
      setAction(null);
    },
    onError: (err: any) => {
      const code = err?.response?.data?.code;
      if (code === "NOT_PENDING") {
        toast.error("此請假單已不是待審核狀態");
      } else {
        toast.error("核准失敗");
      }
      setSelected(null);
      setAction(null);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({
      id,
      comment,
    }: {
      id: string;
      comment: string;
    }) => {
      const { data } = await api.put(`/leaves/${id}/reject`, { comment });
      return data;
    },
    onSuccess: () => {
      toast.success("已駁回");
      queryClient.invalidateQueries({ queryKey: ["leaves"] });
      setSelected(null);
      setAction(null);
    },
    onError: (err: any) => {
      const code = err?.response?.data?.code;
      if (code === "NOT_PENDING") {
        toast.error("此請假單已不是待審核狀態");
      } else {
        toast.error("駁回失敗");
      }
      setSelected(null);
      setAction(null);
    },
  });

  const handleAction = (leave: LeaveRecord, act: "approve" | "reject") => {
    setSelected(leave);
    setAction(act);
  };

  return (
    <AppLayout
      breadcrumbs={[
        { label: "審核管理" },
        { label: "待審核請假" },
      ]}
    >
      <PageHeader
        title="待審核請假"
        description="審核部屬的請假申請"
      />

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : !data?.data?.length ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <p className="text-lg font-medium">目前沒有待審核的請假申請</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>申請人</TableHead>
                  <TableHead>部門</TableHead>
                  <TableHead>假別</TableHead>
                  <TableHead>日期</TableHead>
                  <TableHead className="text-right">時數</TableHead>
                  <TableHead>申請時間</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.map((leave) => (
                  <TableRow key={leave.id}>
                    <TableCell className="font-medium">
                      {leave.user?.name ?? "-"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {leave.user?.department?.name ?? "-"}
                    </TableCell>
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
                    <TableCell className="text-muted-foreground text-sm">
                      {format(new Date(leave.created_at), "MM/dd HH:mm")}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/leaves/${leave.id}`}>查看</Link>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive border-destructive/50 hover:bg-destructive/10"
                          onClick={() => handleAction(leave, "reject")}
                        >
                          駁回
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleAction(leave, "approve")}
                        >
                          核准
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="mt-4">
            <Pagination
              page={data.meta.page}
              totalPages={data.meta.totalPages}
              onPageChange={setPage}
            />
          </div>
        </>
      )}

      {/* 審核 Modal */}
      {action && selected && (
        <LeaveApprovalModal
          open={!!action}
          onOpenChange={(open) => {
            if (!open) {
              setAction(null);
              setSelected(null);
            }
          }}
          action={action}
          applicantName={selected.user?.name ?? "申請人"}
          isLoading={
            action === "approve"
              ? approveMutation.isPending
              : rejectMutation.isPending
          }
          onConfirm={(comment) => {
            if (action === "approve") {
              approveMutation.mutate({ id: selected.id, comment });
            } else {
              rejectMutation.mutate({ id: selected.id, comment });
            }
          }}
        />
      )}
    </AppLayout>
  );
}
