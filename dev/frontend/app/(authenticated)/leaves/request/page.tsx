"use client";

import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout";
import { PageHeader } from "@/components/layout";
import { LeaveForm } from "@/components/leave-form";
import { Skeleton } from "@/components/ui/skeleton";
import api from "@/lib/api";
import type { LeaveQuota, LeaveRecord, PaginatedResponse } from "@/lib/leave-types";

export default function LeaveRequestPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: quotaData, isLoading: quotasLoading } = useQuery({
    queryKey: ["leave-quotas", "me"],
    queryFn: async () => {
      const { data } = await api.get<{ quotas: LeaveQuota[] }>(
        "/leave-quotas/me"
      );
      return data;
    },
  });

  const { data: existingLeaves, isLoading: leavesLoading } = useQuery({
    queryKey: ["leaves", "existing"],
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<LeaveRecord>>(
        "/leaves",
        { params: { status: "pending,approved", limit: 50 } }
      );
      return data;
    },
  });

  const createLeave = useMutation({
    mutationFn: async (body: {
      leave_type: string;
      start_date: string;
      end_date: string;
      start_half: string;
      end_half: string;
      reason: string;
    }) => {
      const { data } = await api.post("/leaves", body);
      return data;
    },
    onSuccess: () => {
      toast.success("請假申請已送出，等待主管審核");
      queryClient.invalidateQueries({ queryKey: ["leaves"] });
      queryClient.invalidateQueries({ queryKey: ["leave-quotas"] });
      router.push("/leaves");
    },
    onError: (err: any) => {
      const code = err?.response?.data?.code;
      const messages: Record<string, string> = {
        DATE_CONFLICT: "該日期已有請假紀錄",
        INSUFFICIENT_QUOTA: "假別額度不足",
        PAST_DATE: "不可申請過去日期的假",
        INVALID_INPUT: "輸入資料格式不正確",
      };
      toast.error(messages[code] || "申請失敗，請稍後再試");
    },
  });

  const isLoading = quotasLoading || leavesLoading;

  // 從已有假紀錄中提取不可選日期
  const disabledDates = (existingLeaves?.data ?? []).flatMap((leave) => {
    const dates: Date[] = [];
    const d = new Date(leave.start_date);
    const end = new Date(leave.end_date);
    while (d <= end) {
      dates.push(new Date(d));
      d.setDate(d.getDate() + 1);
    }
    return dates;
  });

  return (
    <AppLayout
      breadcrumbs={[
        { label: "請假管理", href: "/leaves" },
        { label: "請假申請" },
      ]}
    >
      <PageHeader
        title="請假申請"
        description="填寫請假資料並提交申請"
      />

      {isLoading ? (
        <div className="max-w-2xl space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
          <Skeleton className="h-24 w-full" />
        </div>
      ) : (
        <div className="max-w-2xl">
          <LeaveForm
            onSubmit={(data) => createLeave.mutateAsync(data)}
            isSubmitting={createLeave.isPending}
            quotas={quotaData?.quotas ?? []}
            disabledDates={disabledDates}
          />
        </div>
      )}
    </AppLayout>
  );
}
