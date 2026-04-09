"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { DatePicker } from "@/components/date-picker";
import { QuotaProgressBar } from "@/components/quota-progress-bar";
import {
  LEAVE_TYPE_OPTIONS,
  HALF_DAY_OPTIONS,
  calculateLeaveHours,
  type LeaveQuota,
  type LeaveType,
  type HalfDay,
} from "@/lib/leave-types";

const leaveFormSchema = z
  .object({
    leave_type: z.string().min(1, "請選擇假別"),
    start_date: z.date({ required_error: "請選擇開始日期" }),
    end_date: z.date({ required_error: "請選擇結束日期" }),
    start_half: z.string(),
    end_half: z.string(),
    reason: z
      .string()
      .min(1, "請輸入請假原因")
      .max(500, "請假原因不可超過 500 字"),
  })
  .refine((data) => data.end_date >= data.start_date, {
    message: "結束日期不可早於開始日期",
    path: ["end_date"],
  });

export type LeaveFormValues = z.infer<typeof leaveFormSchema>;

interface LeaveFormProps {
  onSubmit: (data: {
    leave_type: string;
    start_date: string;
    end_date: string;
    start_half: string;
    end_half: string;
    reason: string;
  }) => Promise<void>;
  isSubmitting: boolean;
  quotas: LeaveQuota[];
  disabledDates?: Date[];
}

export function LeaveForm({
  onSubmit,
  isSubmitting,
  quotas,
  disabledDates,
}: LeaveFormProps) {
  const form = useForm<LeaveFormValues>({
    resolver: zodResolver(leaveFormSchema),
    defaultValues: {
      leave_type: "",
      start_half: "full",
      end_half: "full",
      reason: "",
    },
  });

  const watchLeaveType = form.watch("leave_type");
  const watchStartDate = form.watch("start_date");
  const watchEndDate = form.watch("end_date");
  const watchStartHalf = form.watch("start_half");
  const watchEndHalf = form.watch("end_half");
  const watchReason = form.watch("reason");

  const selectedQuota = quotas.find((q) => q.leave_type === watchLeaveType);

  const estimatedHours =
    watchStartDate && watchEndDate
      ? calculateLeaveHours(
          watchStartDate,
          watchEndDate,
          (watchStartHalf as HalfDay) || "full",
          (watchEndHalf as HalfDay) || "full"
        )
      : 0;

  const estimatedDays = estimatedHours / 8;
  const insufficientQuota =
    selectedQuota && estimatedHours > selectedQuota.remaining_hours;

  // 病假可追溯 3 天，其他假別只能選今天以後
  const isSick = watchLeaveType === "sick";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const minDate = new Date(today);
  if (isSick) {
    minDate.setDate(minDate.getDate() - 3);
  }

  const handleSubmit = async (values: LeaveFormValues) => {
    await onSubmit({
      leave_type: values.leave_type,
      start_date: format(values.start_date, "yyyy-MM-dd"),
      end_date: format(values.end_date, "yyyy-MM-dd"),
      start_half: values.start_half,
      end_half: values.end_half,
      reason: values.reason,
    });
  };

  // 同一天時，start_half 和 end_half 需要一致
  const isSameDay =
    watchStartDate &&
    watchEndDate &&
    format(watchStartDate, "yyyy-MM-dd") === format(watchEndDate, "yyyy-MM-dd");

  return (
    <Card>
      <CardContent>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-6"
          >
            {/* 假別 */}
            <FormField
              control={form.control}
              name="leave_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>假別 *</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="請選擇假別" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {LEAVE_TYPE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 額度顯示 */}
            {selectedQuota && (
              <QuotaProgressBar quota={selectedQuota} />
            )}

            {/* 日期選擇 */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="start_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>開始日期 *</FormLabel>
                    <FormControl>
                      <DatePicker
                        value={field.value}
                        onChange={(date) => {
                          field.onChange(date);
                          // 如果結束日期早於開始日期，自動更新
                          const endDate = form.getValues("end_date");
                          if (date && endDate && endDate < date) {
                            form.setValue("end_date", date);
                          }
                        }}
                        fromDate={minDate}
                        disabledDates={disabledDates}
                        placeholder="選擇開始日期"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="end_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>結束日期 *</FormLabel>
                    <FormControl>
                      <DatePicker
                        value={field.value}
                        onChange={field.onChange}
                        fromDate={watchStartDate || minDate}
                        disabledDates={disabledDates}
                        placeholder="選擇結束日期"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* 時段選擇 */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="start_half"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>開始時段</FormLabel>
                    <Select
                      onValueChange={(v) => {
                        field.onChange(v);
                        if (isSameDay) {
                          form.setValue("end_half", v);
                        }
                      }}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {HALF_DAY_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="end_half"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>結束時段</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={isSameDay ? watchStartHalf : field.value}
                      disabled={!!isSameDay}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {HALF_DAY_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* 預計時數 */}
            {estimatedHours > 0 && (
              <div className="rounded-lg border bg-muted/50 p-3 text-sm">
                <span className="font-medium">預計請假：</span>
                {estimatedDays % 1 === 0
                  ? `${estimatedDays} 天`
                  : `${estimatedDays.toFixed(1)} 天`}
                （{estimatedHours} 小時）
                {insufficientQuota && (
                  <span className="ml-2 text-destructive font-medium">
                    -- 額度不足
                  </span>
                )}
              </div>
            )}

            {/* 請假原因 */}
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>請假原因 *</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="請輸入請假原因"
                      className="min-h-[100px] resize-none"
                      {...field}
                    />
                  </FormControl>
                  <div className="flex justify-between">
                    <FormMessage />
                    <span className="text-xs text-muted-foreground">
                      {watchReason?.length ?? 0}/500 字
                    </span>
                  </div>
                </FormItem>
              )}
            />

            {/* 送出按鈕 */}
            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => window.history.back()}
              >
                取消
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || !!insufficientQuota}
              >
                {isSubmitting ? "送出中..." : "提交請假申請"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
