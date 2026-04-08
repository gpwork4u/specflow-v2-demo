# LeaveForm

## 用途

請假申請表單元件，封裝完整的請假流程：假別選擇、日期與半天設定、原因輸入、額度即時顯示、時數預覽。使用 `react-hook-form` + `zod` 驗證。

## Props

| Prop | Type | Default | 說明 |
|------|------|---------|------|
| onSubmit | `(data: LeaveFormValues) => Promise<void>` | - | 提交回呼 |
| isSubmitting | `boolean` | `false` | 是否正在提交 |
| quotas | `QuotaItem[]` | `[]` | 使用者的各假別額度資料 |
| disabledDates | `Date[]` | `[]` | 已有假的日期（不可選） |

### Types

```ts
interface QuotaItem {
  leave_type: string;
  leave_type_label: string;
  total_hours: number;
  used_hours: number;
  remaining_hours: number;
}

interface LeaveFormValues {
  leave_type: LeaveType;
  start_date: Date;
  end_date: Date;
  start_half: HalfDay;
  end_half: HalfDay;
  reason: string;
}
```

## Zod Schema

```ts
import { z } from "zod";

export const leaveFormSchema = z
  .object({
    leave_type: z.enum(
      ["annual", "personal", "sick", "marriage", "bereavement", "maternity", "paternity", "official"],
      { required_error: "請選擇假別" }
    ),
    start_date: z.date({ required_error: "請選擇開始日期" }),
    end_date: z.date({ required_error: "請選擇結束日期" }),
    start_half: z.enum(["full", "morning", "afternoon"]).default("full"),
    end_half: z.enum(["full", "morning", "afternoon"]).default("full"),
    reason: z
      .string()
      .min(1, "請輸入請假原因")
      .max(500, "請假原因最長 500 字元"),
  })
  .refine((data) => data.end_date >= data.start_date, {
    message: "結束日期不可早於開始日期",
    path: ["end_date"],
  });
```

## Layout

```
┌─────────────────────────────────────────────────┐
│ 請假申請                                         │
│                                                  │
│ 假別 *                                           │
│ ┌─────────────────────────────────┐              │
│ │ ▼ 請選擇假別                    │              │
│ └─────────────────────────────────┘              │
│                                                  │
│ ┌── 即時額度提示 ──────────────────┐              │
│ │ [棕] 特休    剩餘 8 天          │  ← 選假別後  │
│ │ ████████░░░░░░░░░░░░░░░░░░░░░  │    才顯示    │
│ └─────────────────────────────────┘              │
│                                                  │
│ 開始日期 *              結束日期 *                │
│ ┌──────────────┐       ┌──────────────┐          │
│ │ 📅 2026-04-10│       │ 📅 2026-04-14│          │
│ └──────────────┘       └──────────────┘          │
│                                                  │
│ 首日時段                末日時段                  │
│ ○ 全天 ○ 下午           ○ 全天 ○ 上午             │
│                                                  │
│ 📊 預計請假: 4.5 天 (36 小時)                     │
│                                                  │
│ 請假原因 *                                        │
│ ┌─────────────────────────────────┐              │
│ │                                 │              │
│ │                                 │              │
│ └─────────────────────────────────┘              │
│                                 12 / 500 字       │
│                                                  │
│                      [取消]  [提交請假申請]        │
└─────────────────────────────────────────────────┘

       ↓ 點擊提交後出現確認 Dialog

┌─────────────────────────────────────┐
│ 確認送出請假申請                     │
│                                     │
│ 假別：特休                          │
│ 日期：2026/04/10 (下午) ~ 04/14    │
│ 時數：36 小時 (4.5 天)              │
│ 原因：出國旅遊                      │
│                                     │
│              [取消]  [確認送出]       │
└─────────────────────────────────────┘
```

## 互動流程

1. 使用者選擇假別 -> 即時載入該假別額度並顯示 QuotaProgressBar
2. 額度不足時顯示警告訊息（紅色文字 + Alert icon）
3. 選擇日期 -> 自動計算時數 -> 即時比對額度
4. 若計算後的時數 > 剩餘額度，disable 提交按鈕並提示
5. 輸入原因 -> 即時字數統計
6. 點擊提交 -> 跳出確認 Dialog（顯示摘要）
7. 確認後呼叫 API，成功後跳轉至請假紀錄列表

## 外觀規格

| 部位 | 樣式 |
|------|------|
| 表單容器 | `Card` 包裹，`p-6 space-y-6` |
| 標題 | `text-xl font-semibold` |
| 假別 Select | shadcn/ui `Select`，選項含 LeaveTypeBadge |
| 額度提示 | `QuotaProgressBar` size="sm" highlightRemaining |
| 額度不足警告 | `bg-destructive/10 text-destructive text-sm p-3 rounded-md` |
| 日期選擇 | `DateRangePicker` 元件 |
| 原因 Textarea | `min-h-[100px]`，`resize-none` |
| 字數計數 | `text-xs text-muted-foreground text-right` |
| Actions | `flex justify-end gap-2 pt-4 border-t` |
| 提交按鈕 | `Button variant="primary"`，loading 時顯示 spinner |

## 範例程式碼

```tsx
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import {
  Form, FormField, FormItem, FormLabel, FormControl, FormMessage,
} from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Loader2, Send } from "lucide-react";
import { DateRangePicker } from "@/components/date-range-picker";
import { QuotaProgressBar } from "@/components/quota-progress-bar";
import { LeaveTypeBadge } from "@/components/leave-type-badge";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { leaveFormSchema, type LeaveFormValues } from "@/lib/schemas/leave";

const leaveTypeOptions = [
  { value: "annual", label: "特休" },
  { value: "personal", label: "事假" },
  { value: "sick", label: "病假" },
  { value: "marriage", label: "婚假" },
  { value: "bereavement", label: "喪假" },
  { value: "maternity", label: "產假" },
  { value: "paternity", label: "陪產假" },
  { value: "official", label: "公假" },
];

interface LeaveFormProps {
  onSubmit: (data: LeaveFormValues) => Promise<void>;
  isSubmitting?: boolean;
  quotas: QuotaItem[];
  disabledDates?: Date[];
}

export function LeaveForm({
  onSubmit,
  isSubmitting = false,
  quotas,
  disabledDates = [],
}: LeaveFormProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const form = useForm<LeaveFormValues>({
    resolver: zodResolver(leaveFormSchema),
    defaultValues: {
      start_half: "full",
      end_half: "full",
      reason: "",
    },
  });

  const selectedType = form.watch("leave_type");
  const reason = form.watch("reason") || "";
  const currentQuota = quotas.find((q) => q.leave_type === selectedType);

  const handleFormSubmit = (data: LeaveFormValues) => {
    setShowConfirm(true);
  };

  const handleConfirm = async () => {
    setShowConfirm(false);
    await onSubmit(form.getValues());
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>請假申請</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6">
            {/* 假別選擇 */}
            <FormField
              control={form.control}
              name="leave_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>假別 *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="請選擇假別" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {leaveTypeOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          <div className="flex items-center gap-2">
                            <LeaveTypeBadge leaveType={opt.value} showIcon={false} />
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 即時額度提示 */}
            {currentQuota && (
              <QuotaProgressBar
                leaveType={selectedType}
                totalHours={currentQuota.total_hours}
                usedHours={currentQuota.used_hours}
                size="sm"
                showDetails={false}
                highlightRemaining
              />
            )}

            {/* 額度不足警告 */}
            {currentQuota && currentQuota.remaining_hours <= 0 && (
              <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>此假別額度已用完，無法提交申請。</span>
              </div>
            )}

            {/* 日期範圍選擇器 */}
            <DateRangePicker
              startDate={form.watch("start_date")}
              endDate={form.watch("end_date")}
              onStartDateChange={(d) => form.setValue("start_date", d!)}
              onEndDateChange={(d) => form.setValue("end_date", d!)}
              startHalf={form.watch("start_half")}
              endHalf={form.watch("end_half")}
              onStartHalfChange={(v) => form.setValue("start_half", v)}
              onEndHalfChange={(v) => form.setValue("end_half", v)}
              minDate={selectedType === "sick" ? subDays(new Date(), 3) : new Date()}
              disabledDates={disabledDates}
            />

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
                      maxLength={500}
                      {...field}
                    />
                  </FormControl>
                  <div className="text-right text-xs text-muted-foreground">
                    {reason.length} / 500 字
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 表單操作 */}
            <div className="flex justify-end gap-2 border-t pt-4">
              <Button type="button" variant="outline">
                取消
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || (currentQuota && currentQuota.remaining_hours <= 0)}
              >
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Send className="mr-2 h-4 w-4" />
                提交請假申請
              </Button>
            </div>
          </form>
        </Form>

        {/* 確認 Dialog */}
        <ConfirmDialog
          open={showConfirm}
          onOpenChange={setShowConfirm}
          title="確認送出請假申請"
          description={`假別：${currentQuota?.leave_type_label}\n日期：...\n確定要送出嗎？`}
          confirmLabel="確認送出"
          onConfirm={handleConfirm}
          isLoading={isSubmitting}
        />
      </CardContent>
    </Card>
  );
}
```

## Accessibility

- 所有必填欄位標示 `*` 並有 `aria-required="true"`
- 表單錯誤時 focus 第一個錯誤欄位
- Select 下拉支援鍵盤操作
- Textarea 有 maxLength 限制 + 即時字數回饋
- 確認 Dialog 使用 AlertDialog（trap focus + Escape 關閉）
- 額度不足時 disable 提交按鈕 + 視覺警告文字

## 使用的元件

| 元件 | 來源 |
|------|------|
| Form, FormField, FormItem, FormLabel, FormControl, FormMessage | shadcn/ui |
| Select, SelectContent, SelectItem, SelectTrigger, SelectValue | shadcn/ui |
| Textarea | shadcn/ui |
| Button | shadcn/ui |
| Card, CardContent, CardHeader, CardTitle | shadcn/ui |
| DateRangePicker | `design/components/date-range-picker` |
| QuotaProgressBar | `design/components/quota-progress-bar` |
| LeaveTypeBadge | `design/components/leave-type-badge` |
| ConfirmDialog | `design/components/confirm-dialog` |
