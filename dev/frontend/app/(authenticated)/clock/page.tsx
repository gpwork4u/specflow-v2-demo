"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout";
import { ClockButton } from "@/components/clock-button";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageSquare } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import api from "@/lib/api";

interface TodayStatus {
  id: string;
  clock_in: string | null;
  clock_out: string | null;
  status: string;
  date: string;
}

export default function ClockPage() {
  const [showNote, setShowNote] = useState(false);
  const [note, setNote] = useState("");
  const queryClient = useQueryClient();

  const { data: todayStatus, isLoading } = useQuery<TodayStatus>({
    queryKey: ["clock", "today"],
    queryFn: async () => {
      const res = await api.get("/clock/today");
      return res.data;
    },
  });

  const clockInMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post("/clock/in", {
        note: note || undefined,
      });
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["clock", "today"] });
      toast.success("上班打卡成功", {
        description: `打卡時間 ${format(new Date(data.clock_in), "HH:mm:ss")}`,
      });
      setNote("");
      setShowNote(false);
    },
    onError: (err: any) => {
      const code = err?.response?.data?.code;
      const messages: Record<string, string> = {
        ALREADY_CLOCKED_IN: "今日已打過上班卡",
      };
      toast.error("打卡失敗", {
        description: messages[code] || "請稍後再試",
      });
    },
  });

  const clockOutMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post("/clock/out", {
        note: note || undefined,
      });
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["clock", "today"] });
      toast.success("下班打卡成功", {
        description: `打卡時間 ${format(new Date(data.clock_out), "HH:mm:ss")}`,
      });
      setNote("");
      setShowNote(false);
    },
    onError: (err: any) => {
      const code = err?.response?.data?.code;
      const messages: Record<string, string> = {
        NOT_CLOCKED_IN: "請先打上班卡",
        ALREADY_CLOCKED_OUT: "今日已打過下班卡",
      };
      toast.error("打卡失敗", {
        description: messages[code] || "請稍後再試",
      });
    },
  });

  const status = !todayStatus?.clock_in
    ? "idle"
    : !todayStatus?.clock_out
      ? "clocked_in"
      : "clocked_out";

  return (
    <AppLayout
      breadcrumbs={[
        { label: "Dashboard", href: "/" },
        { label: "打卡" },
      ]}
    >
      <div className="flex min-h-[60vh] flex-col items-center justify-center">
        {isLoading ? (
          <div className="flex flex-col items-center gap-6">
            <Skeleton className="h-16 w-48" />
            <Skeleton className="h-48 w-48 rounded-full" />
            <Skeleton className="h-24 w-72" />
          </div>
        ) : (
          <ClockButton
            status={status}
            clockInTime={todayStatus?.clock_in ?? null}
            clockOutTime={todayStatus?.clock_out ?? null}
            onClockIn={() => clockInMutation.mutate()}
            onClockOut={() => clockOutMutation.mutate()}
            isLoading={clockInMutation.isPending || clockOutMutation.isPending}
          />
        )}

        {/* 備註區 */}
        {status !== "clocked_out" && !isLoading && (
          <div className="mt-6 w-full max-w-xs px-4 md:px-0">
            {showNote ? (
              <div className="space-y-2">
                <Textarea
                  placeholder="輸入備註（選填，如：外出開會晚到）"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  maxLength={500}
                />
                <p className="text-right text-xs text-muted-foreground">
                  {note.length}/500
                </p>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-muted-foreground"
                onClick={() => setShowNote(true)}
              >
                <MessageSquare className="mr-2 h-4 w-4" />
                加入備註
              </Button>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
