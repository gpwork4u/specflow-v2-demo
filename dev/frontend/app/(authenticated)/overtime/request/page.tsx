"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import api from "@/lib/api";

const overtimeFormSchema = z
  .object({
    date: z.string().min(1, "請選擇日期"),
    start_time: z.string().min(1, "請選擇開始時間"),
    end_time: z.string().min(1, "請選擇結束時間"),
    reason: z
      .string()
      .min(1, "請輸入加班原因")
      .max(500, "原因不可超過 500 字"),
  })
  .refine(
    (data) => {
      if (!data.start_time || !data.end_time) return true;
      return data.end_time > data.start_time;
    },
    {
      message: "結束時間必須晚於開始時間",
      path: ["end_time"],
    }
  );

type OvertimeFormValues = z.infer<typeof overtimeFormSchema>;

function calculateHours(start: string, end: string): number {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const diff = (eh * 60 + em - (sh * 60 + sm)) / 60;
  if (diff <= 0) return 0;
  return Math.ceil(diff * 2) / 2; // Round up to 0.5h
}

export default function OvertimeRequestPage() {
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);

  const form = useForm<OvertimeFormValues>({
    resolver: zodResolver(overtimeFormSchema),
    defaultValues: {
      date: "",
      start_time: "",
      end_time: "",
      reason: "",
    },
  });

  const watchStartTime = form.watch("start_time");
  const watchEndTime = form.watch("end_time");
  const watchReason = form.watch("reason");
  const estimatedHours = calculateHours(watchStartTime, watchEndTime);

  const createOvertime = useMutation({
    mutationFn: async (data: OvertimeFormValues) => {
      const res = await api.post("/overtime", {
        date: data.date,
        start_time: data.start_time,
        end_time: data.end_time,
        reason: data.reason,
      });
      return res.data;
    },
    onSuccess: () => {
      toast.success("加班申請已送出，等待主管審核");
      router.push("/overtime");
    },
    onError: (err: any) => {
      const code = err?.response?.data?.code;
      const messages: Record<string, string> = {
        DATE_CONFLICT: "該日期已有加班申請",
        INVALID_TIME_RANGE: "時間範圍不正確或超過上限",
        MONTHLY_LIMIT_EXCEEDED: "本月加班時數已達上限",
        PAST_DATE: "超過 7 天前，不可補申請",
      };
      toast.error(messages[code] || "申請失敗，請稍後再試");
      setShowConfirm(false);
    },
  });

  const onSubmit = () => {
    setShowConfirm(true);
  };

  const handleConfirm = async () => {
    const values = form.getValues();
    await createOvertime.mutateAsync(values);
    setShowConfirm(false);
  };

  return (
    <AppLayout
      breadcrumbs={[{ label: "加班管理" }, { label: "加班申請" }]}
    >
      <PageHeader
        title="加班申請"
        description="填寫加班資料並提交申請"
      />

      <div className="max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">加班資料</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-6"
              >
                <FormField
                  control={form.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>加班日期 *</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="start_time"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>開始時間 *</FormLabel>
                        <FormControl>
                          <Input type="time" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="end_time"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>結束時間 *</FormLabel>
                        <FormControl>
                          <Input type="time" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {estimatedHours > 0 && (
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="text-sm">
                      預估加班時數：
                      <span className="font-mono font-semibold text-primary">
                        {estimatedHours} 小時
                      </span>
                    </p>
                    {estimatedHours > 12 && (
                      <p className="mt-1 text-xs text-destructive">
                        單次加班不可超過 12 小時
                      </p>
                    )}
                  </div>
                )}

                <FormField
                  control={form.control}
                  name="reason"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>加班原因 *</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="請輸入加班原因"
                          className="min-h-[100px]"
                          {...field}
                        />
                      </FormControl>
                      <div className="flex justify-between">
                        <FormMessage />
                        <span className="text-xs text-muted-foreground">
                          {watchReason?.length || 0}/500 字
                        </span>
                      </div>
                    </FormItem>
                  )}
                />

                <div className="flex justify-end gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.push("/overtime")}
                  >
                    取消
                  </Button>
                  <Button
                    type="submit"
                    disabled={
                      createOvertime.isPending || estimatedHours > 12
                    }
                  >
                    提交加班申請
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>

      {/* Confirmation dialog */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>確認提交</DialogTitle>
            <DialogDescription>
              確定要提交此加班申請嗎？提交後將通知主管審核。
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg bg-muted/50 p-3 text-sm">
            <p>
              日期：{form.getValues("date")}
            </p>
            <p>
              時間：{form.getValues("start_time")} ~{" "}
              {form.getValues("end_time")}
            </p>
            <p>
              預估時數：
              <span className="font-mono font-semibold">{estimatedHours}h</span>
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirm(false)}>
              返回修改
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={createOvertime.isPending}
            >
              {createOvertime.isPending ? "提交中..." : "確認提交"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
