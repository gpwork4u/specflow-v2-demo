"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Info } from "lucide-react";

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
import { Alert, AlertDescription } from "@/components/ui/alert";
import api from "@/lib/api";

const missedClockFormSchema = z.object({
  date: z.string().min(1, "請選擇日期"),
  clock_type: z.enum(["clock_in", "clock_out"], {
    required_error: "請選擇打卡類型",
  }),
  clock_time: z.string().min(1, "請選擇補打卡時間"),
  reason: z
    .string()
    .min(1, "請輸入補打卡原因")
    .max(500, "原因不可超過 500 字"),
});

type MissedClockFormValues = z.infer<typeof missedClockFormSchema>;

export default function MissedClockRequestPage() {
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);

  const form = useForm<MissedClockFormValues>({
    resolver: zodResolver(missedClockFormSchema),
    defaultValues: {
      date: "",
      clock_type: undefined,
      clock_time: "",
      reason: "",
    },
  });

  const watchReason = form.watch("reason");
  const watchClockType = form.watch("clock_type");

  const createMissedClock = useMutation({
    mutationFn: async (data: MissedClockFormValues) => {
      const res = await api.post("/missed-clock", {
        date: data.date,
        clock_type: data.clock_type,
        clock_time: data.clock_time,
        reason: data.reason,
      });
      return res.data;
    },
    onSuccess: () => {
      toast.success("補打卡申請已送出，等待主管審核");
      router.push("/missed-clock");
    },
    onError: (err: any) => {
      const code = err?.response?.data?.code;
      const messages: Record<string, string> = {
        ALREADY_EXISTS: "該日期已有相同類型的補打卡申請",
        ALREADY_CLOCKED: "該日期已有打卡紀錄，無需補打卡",
        PAST_DATE: "超過 7 天前，不可申請",
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
    await createMissedClock.mutateAsync(values);
    setShowConfirm(false);
  };

  const clockTypeLabel =
    watchClockType === "clock_in"
      ? "上班打卡"
      : watchClockType === "clock_out"
        ? "下班打卡"
        : "";

  return (
    <AppLayout
      breadcrumbs={[{ label: "補打卡管理" }, { label: "補打卡申請" }]}
    >
      <PageHeader
        title="補打卡申請"
        description="忘記打卡時可在此申請補登"
      />

      <div className="max-w-2xl">
        <Alert className="mb-6">
          <Info className="h-4 w-4" />
          <AlertDescription>
            補打卡僅適用於忘記打卡的情況，申請後需由主管審核。限 7
            天內的打卡紀錄。
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">補打卡資料</CardTitle>
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
                      <FormLabel>補打卡日期 *</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="clock_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>打卡類型 *</FormLabel>
                      <FormControl>
                        <div className="flex gap-3">
                          <button
                            type="button"
                            className={`flex-1 rounded-lg border-2 px-4 py-3 text-sm font-medium transition-colors ${
                              field.value === "clock_in"
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-input hover:bg-accent"
                            }`}
                            onClick={() => field.onChange("clock_in")}
                          >
                            上班打卡
                          </button>
                          <button
                            type="button"
                            className={`flex-1 rounded-lg border-2 px-4 py-3 text-sm font-medium transition-colors ${
                              field.value === "clock_out"
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-input hover:bg-accent"
                            }`}
                            onClick={() => field.onChange("clock_out")}
                          >
                            下班打卡
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="clock_time"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>補打卡時間 *</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="reason"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>補打卡原因 *</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="請輸入補打卡原因，例如：忘記打卡"
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
                    onClick={() => router.push("/missed-clock")}
                  >
                    取消
                  </Button>
                  <Button
                    type="submit"
                    disabled={createMissedClock.isPending}
                  >
                    提交補打卡申請
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
              確定要提交此補打卡申請嗎？提交後將通知主管審核。
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg bg-muted/50 p-3 text-sm">
            <p>日期：{form.getValues("date")}</p>
            <p>類型：{clockTypeLabel}</p>
            <p>時間：{form.getValues("clock_time")}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirm(false)}>
              返回修改
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={createMissedClock.isPending}
            >
              {createMissedClock.isPending ? "提交中..." : "確認提交"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
