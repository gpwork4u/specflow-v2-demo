"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { AppLayout, PageHeader } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { LeaveTypeBadge } from "@/components/leave-type-badge";
import { LeaveStatusBadge } from "@/components/leave-status-badge";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { LeaveApprovalModal } from "@/components/leave-approval-modal";
import { useAuthStore } from "@/lib/auth-store";
import api from "@/lib/api";
import {
  HALF_DAY_OPTIONS,
  type LeaveRecord,
} from "@/lib/leave-types";
import { useState } from "react";

function getHalfLabel(half: string) {
  return HALF_DAY_OPTIONS.find((o) => o.value === half)?.label ?? half;
}

export default function LeaveDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  const [showCancel, setShowCancel] = useState(false);
  const [approvalAction, setApprovalAction] = useState<
    "approve" | "reject" | null
  >(null);

  const { data: leave, isLoading } = useQuery({
    queryKey: ["leaves", id],
    queryFn: async () => {
      const { data } = await api.get<LeaveRecord>(`/leaves/${id}`);
      return data;
    },
  });

  const cancelLeave = useMutation({
    mutationFn: async () => {
      const { data } = await api.put(`/leaves/${id}/cancel`);
      return data;
    },
    onSuccess: () => {
      toast.success("請假申請已取消");
      queryClient.invalidateQueries({ queryKey: ["leaves"] });
      queryClient.invalidateQueries({ queryKey: ["leave-quotas"] });
      setShowCancel(false);
    },
    onError: (err: any) => {
      const code = err?.response?.data?.code;
      const messages: Record<string, string> = {
        CANNOT_CANCEL: "此請假單無法取消",
        LEAVE_STARTED: "請假日期已開始，無法取消",
      };
      toast.error(messages[code] || "取消失敗");
      setShowCancel(false);
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (comment: string) => {
      const { data } = await api.put(`/leaves/${id}/approve`, {
        ...(comment && { comment }),
      });
      return data;
    },
    onSuccess: () => {
      toast.success("已核准");
      queryClient.invalidateQueries({ queryKey: ["leaves"] });
      setApprovalAction(null);
    },
    onError: () => {
      toast.error("核准失敗");
      setApprovalAction(null);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (comment: string) => {
      const { data } = await api.put(`/leaves/${id}/reject`, { comment });
      return data;
    },
    onSuccess: () => {
      toast.success("已駁回");
      queryClient.invalidateQueries({ queryKey: ["leaves"] });
      setApprovalAction(null);
    },
    onError: () => {
      toast.error("駁回失敗");
      setApprovalAction(null);
    },
  });

  const isOwner = leave && user && leave.user_id === user.id;
  const canCancel =
    isOwner && (leave?.status === "pending" || leave?.status === "approved");
  const isManagerOrAdmin =
    user?.role === "manager" || user?.role === "admin";
  const canReview =
    isManagerOrAdmin && leave?.status === "pending" && !isOwner;

  return (
    <AppLayout
      breadcrumbs={[
        { label: "請假管理", href: "/leaves" },
        { label: "請假紀錄", href: "/leaves" },
        { label: "請假詳情" },
      ]}
    >
      <div className="mb-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
          返回
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-[300px] w-full" />
        </div>
      ) : !leave ? (
        <div className="py-12 text-center text-muted-foreground">
          找不到此請假單
        </div>
      ) : (
        <div className="space-y-6">
          <PageHeader
            title="請假詳情"
            actions={
              <div className="flex gap-2">
                {canReview && (
                  <>
                    <Button
                      variant="destructive"
                      onClick={() => setApprovalAction("reject")}
                    >
                      駁回
                    </Button>
                    <Button onClick={() => setApprovalAction("approve")}>
                      核准
                    </Button>
                  </>
                )}
                {canCancel && (
                  <Button
                    variant="destructive"
                    onClick={() => setShowCancel(true)}
                  >
                    取消申請
                  </Button>
                )}
              </div>
            }
          />

          {/* 基本資訊 */}
          <Card>
            <CardHeader>
              <CardTitle>申請資訊</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {leave.user && (
                  <div>
                    <dt className="text-sm text-muted-foreground">申請人</dt>
                    <dd className="mt-1 font-medium">
                      {leave.user.name}
                      {leave.user.department && (
                        <span className="ml-1 text-sm text-muted-foreground">
                          ({leave.user.department.name})
                        </span>
                      )}
                    </dd>
                  </div>
                )}
                <div>
                  <dt className="text-sm text-muted-foreground">假別</dt>
                  <dd className="mt-1">
                    <LeaveTypeBadge type={leave.leave_type} />
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">請假日期</dt>
                  <dd className="mt-1 font-medium">
                    {format(new Date(leave.start_date), "yyyy/MM/dd")}
                    {leave.start_date !== leave.end_date &&
                      ` ~ ${format(new Date(leave.end_date), "yyyy/MM/dd")}`}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">時段</dt>
                  <dd className="mt-1">
                    {getHalfLabel(leave.start_half)}
                    {leave.start_date !== leave.end_date &&
                      ` ~ ${getHalfLabel(leave.end_half)}`}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">時數</dt>
                  <dd className="mt-1 font-medium">{leave.hours} 小時</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">狀態</dt>
                  <dd className="mt-1">
                    <LeaveStatusBadge status={leave.status} />
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-sm text-muted-foreground">請假原因</dt>
                  <dd className="mt-1 whitespace-pre-wrap">{leave.reason}</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">申請時間</dt>
                  <dd className="mt-1 text-sm">
                    {format(new Date(leave.created_at), "yyyy/MM/dd HH:mm")}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          {/* 審核結果 */}
          {(leave.reviewer || leave.review_comment) && (
            <Card>
              <CardHeader>
                <CardTitle>審核結果</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {leave.reviewer && (
                    <div>
                      <dt className="text-sm text-muted-foreground">審核人</dt>
                      <dd className="mt-1 font-medium">
                        {leave.reviewer.name}
                      </dd>
                    </div>
                  )}
                  {leave.reviewed_at && (
                    <div>
                      <dt className="text-sm text-muted-foreground">
                        審核時間
                      </dt>
                      <dd className="mt-1 text-sm">
                        {format(
                          new Date(leave.reviewed_at),
                          "yyyy/MM/dd HH:mm"
                        )}
                      </dd>
                    </div>
                  )}
                  {leave.review_comment && (
                    <div className="sm:col-span-2">
                      <dt className="text-sm text-muted-foreground">
                        審核備註
                      </dt>
                      <dd className="mt-1 whitespace-pre-wrap">
                        {leave.review_comment}
                      </dd>
                    </div>
                  )}
                </dl>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* 取消確認 */}
      <ConfirmDialog
        open={showCancel}
        onOpenChange={setShowCancel}
        title="取消請假申請"
        description={
          leave?.status === "approved"
            ? "此假單已核准，取消後額度將退還。確定要取消嗎？"
            : "確定要取消此請假申請嗎？"
        }
        confirmLabel="確認取消"
        variant="destructive"
        isLoading={cancelLeave.isPending}
        onConfirm={() => cancelLeave.mutate()}
      />

      {/* 審核 Modal */}
      {approvalAction && leave && (
        <LeaveApprovalModal
          open={!!approvalAction}
          onOpenChange={(open) => !open && setApprovalAction(null)}
          action={approvalAction}
          applicantName={leave.user?.name ?? "申請人"}
          isLoading={
            approvalAction === "approve"
              ? approveMutation.isPending
              : rejectMutation.isPending
          }
          onConfirm={(comment) => {
            if (approvalAction === "approve") {
              approveMutation.mutate(comment);
            } else {
              rejectMutation.mutate(comment);
            }
          }}
        />
      )}
    </AppLayout>
  );
}
