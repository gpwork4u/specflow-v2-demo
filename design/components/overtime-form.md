# OvertimeForm

## 用途

加班申請表單元件，封裝完整的加班申請流程：日期選擇（含事後補申請限 7 天內）、開始/結束時間選擇、原因輸入、本月累計加班時數即時提示。使用 `react-hook-form` + `zod` 驗證。

## Props

| Prop | Type | Default | 說明 |
|------|------|---------|------|
| onSubmit | `(data: OvertimeFormValues) => Promise<void>` | - | 提交回呼 |
| isSubmitting | `boolean` | `false` | 是否正在提交 |
| monthlyUsedHours | `number` | `0` | 本月已加班時數（approved + pending） |
| disabledDates | `Date[]` | `[]` | 已有加班申請的日期（不可選） |

### Types

```ts
interface OvertimeFormValues {
  date: Date;
  start_time: string; // HH:mm
  end_time: string;   // HH:mm
  reason: string;
}
```

## Zod Schema

```ts
import { z } from "zod";

export const overtimeFormSchema = z
  .object({
    date: z.date({ required_error: "請選擇加班日期" }),
    start_time: z.string({ required_error: "請選擇開始時間" }).regex(/^\d{2}:\d{2}$/, "時間格式不正確"),
    end_time: z.string({ required_error: "請選擇結束時間" }).regex(/^\d{2}:\d{2}$/, "時間格式不正確"),
    reason: z
      .string()
      .min(1, "請輸入加班原因")
      .max(500, "加班原因最長 500 字元"),
  })
  .refine(
    (data) => {
      if (!data.start_time || !data.end_time) return true;
      return data.end_time > data.start_time;
    },
    { message: "結束時間必須晚於開始時間", path: ["end_time"] }
  )
  .refine(
    (data) => {
      if (!data.start_time || !data.end_time) return true;
      const [sh, sm] = data.start_time.split(":").map(Number);
      const [eh, em] = data.end_time.split(":").map(Number);
      const diffMinutes = (eh * 60 + em) - (sh * 60 + sm);
      return diffMinutes <= 720; // 12 小時上限
    },
    { message: "單次加班不可超過 12 小時", path: ["end_time"] }
  );
```

## Layout

```
+-------------------------------------------------+
| 加班申請                                         |
|                                                  |
| +-- 本月加班統計 --------------------------------+|
| | 本月已加班: 20.0 小時 / 上限 46 小時          ||
| | ████████████████░░░░░░░░░░░░░░░░░░░░  43.5%  ||
| +------------------------------------------------+|
|                                                  |
| 加班日期 *                                       |
| +-------------------------------+                |
| | 日曆 2026-04-07               |                |
| +-------------------------------+                |
| 可選範圍：過去 7 天 ~ 今天                       |
|                                                  |
| 開始時間 *            結束時間 *                  |
| +--------------+     +--------------+            |
| | 18:00        |     | 21:00        |            |
| +--------------+     +--------------+            |
|                                                  |
| 預估加班時數: 3.0 小時                            |
| (本月累計將達: 23.0 / 46 小時)                    |
|                                                  |
| 加班原因 *                                       |
| +-------------------------------+                |
| |                               |                |
| |                               |                |
| +-------------------------------+                |
|                              12 / 500 字         |
|                                                  |
|                    [取消]  [提交加班申請]          |
+-------------------------------------------------+

       下 點擊提交後出現確認 Dialog

+-------------------------------------+
| 確認送出加班申請                     |
|                                     |
| 日期：2026/04/07                    |
| 時間：18:00 ~ 21:00                |
| 時數：3.0 小時                      |
| 原因：趕專案 deadline               |
|                                     |
|              [取消]  [確認送出]       |
+-------------------------------------+
```

## 互動流程

1. 頁面載入時顯示本月加班統計 ProgressBar
2. 使用者選擇加班日期（限過去 7 天 ~ 今天，已有加班申請的日期標記為不可選）
3. 選擇開始/結束時間，即時計算加班時數（以 0.5 小時為最小單位，無條件進位）
4. 若計算後本月累計 > 46 小時，顯示紅色警告並 disable 提交按鈕
5. 若單次 > 12 小時，顯示錯誤訊息
6. 輸入原因，即時字數統計
7. 點擊提交 -> 跳出確認 Dialog
8. 確認後呼叫 API，成功後跳轉至加班紀錄列表

## 外觀規格

| 部位 | 樣式 |
|------|------|
| 表單容器 | `Card` 包裹，`p-6 space-y-6` |
| 標題 | `text-xl font-semibold` |
| 月統計區 | `bg-muted rounded-lg p-4`，內含 `Progress` 元件 |
| 月統計文字 | `text-sm text-muted-foreground` |
| 超限警告 | `bg-destructive/10 text-destructive text-sm p-3 rounded-md` + `AlertTriangle` icon |
| 日期選擇 | shadcn/ui `Popover` + `Calendar`，minDate = today - 7, maxDate = today |
| 時間選擇 | shadcn/ui `Select`，以 30 分鐘為間隔（17:00, 17:30, 18:00 ...） |
| 預估時數 | `text-sm font-medium text-primary` |
| 累計提示 | `text-xs text-muted-foreground` |
| 原因 Textarea | `min-h-[100px]`，`resize-none` |
| 字數計數 | `text-xs text-muted-foreground text-right` |
| Actions | `flex justify-end gap-2 pt-4 border-t` |
| 提交按鈕 | `Button variant="default"`，loading 時顯示 spinner |

## 範例程式碼

```tsx
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useMemo } from "react";
import { subDays, format } from "date-fns";
import {
  Form, FormField, FormItem, FormLabel, FormControl, FormMessage,
} from "@/components/ui/form";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { AlertTriangle, CalendarIcon, Clock, Loader2, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { overtimeFormSchema, type OvertimeFormValues } from "@/lib/schemas/overtime";

const MONTHLY_LIMIT = 46;

// 產生時間選項（30 分鐘間隔）
const timeOptions = Array.from({ length: 48 }, (_, i) => {
  const h = String(Math.floor(i / 2)).padStart(2, "0");
  const m = i % 2 === 0 ? "00" : "30";
  return `${h}:${m}`;
}).filter((t) => t >= "06:00"); // 06:00 開始

function calcHours(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const diff = (eh * 60 + em - sh * 60 - sm) / 60;
  return Math.ceil(diff * 2) / 2; // 無條件進位到 0.5
}

interface OvertimeFormProps {
  onSubmit: (data: OvertimeFormValues) => Promise<void>;
  isSubmitting?: boolean;
  monthlyUsedHours?: number;
  disabledDates?: Date[];
}

export function OvertimeForm({
  onSubmit,
  isSubmitting = false,
  monthlyUsedHours = 0,
  disabledDates = [],
}: OvertimeFormProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const form = useForm<OvertimeFormValues>({
    resolver: zodResolver(overtimeFormSchema),
    defaultValues: { reason: "" },
  });

  const startTime = form.watch("start_time");
  const endTime = form.watch("end_time");
  const reason = form.watch("reason") || "";

  const estimatedHours = useMemo(() => {
    if (!startTime || !endTime || endTime <= startTime) return 0;
    return calcHours(startTime, endTime);
  }, [startTime, endTime]);

  const projectedTotal = monthlyUsedHours + estimatedHours;
  const isOverLimit = projectedTotal > MONTHLY_LIMIT;
  const progressPercent = Math.min((monthlyUsedHours / MONTHLY_LIMIT) * 100, 100);

  const handleFormSubmit = () => setShowConfirm(true);

  const handleConfirm = async () => {
    setShowConfirm(false);
    await onSubmit(form.getValues());
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>加班申請</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6">
            {/* 本月加班統計 */}
            <div className="rounded-lg bg-muted p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">本月已加班</span>
                <span className="font-medium">
                  {monthlyUsedHours} 小時 / 上限 {MONTHLY_LIMIT} 小時
                </span>
              </div>
              <Progress value={progressPercent} className="h-2" />
              <p className="text-xs text-muted-foreground text-right">
                {progressPercent.toFixed(1)}%
              </p>
            </div>

            {/* 超限警告 */}
            {isOverLimit && estimatedHours > 0 && (
              <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>
                  本月加班時數將超過法定上限 {MONTHLY_LIMIT} 小時
                  （累計 {projectedTotal} 小時），剩餘可申請 {Math.max(0, MONTHLY_LIMIT - monthlyUsedHours)} 小時。
                </span>
              </div>
            )}

            {/* 加班日期 */}
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>加班日期 *</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {field.value
                            ? format(field.value, "yyyy-MM-dd")
                            : "選擇日期"}
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(date) =>
                          date > new Date() ||
                          date < subDays(new Date(), 7) ||
                          disabledDates.some(
                            (d) => d.toDateString() === date.toDateString()
                          )
                        }
                      />
                    </PopoverContent>
                  </Popover>
                  <p className="text-xs text-muted-foreground">
                    可選範圍：過去 7 天 ~ 今天
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 開始/結束時間 */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="start_time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>開始時間 *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <Clock className="mr-2 h-4 w-4 text-muted-foreground" />
                          <SelectValue placeholder="選擇時間" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {timeOptions.map((t) => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <Clock className="mr-2 h-4 w-4 text-muted-foreground" />
                          <SelectValue placeholder="選擇時間" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {timeOptions
                          .filter((t) => !startTime || t > startTime)
                          .map((t) => (
                            <SelectItem key={t} value={t}>{t}</SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* 預估時數 */}
            {estimatedHours > 0 && (
              <div className="space-y-1">
                <p className="text-sm font-medium text-primary">
                  預估加班時數：{estimatedHours} 小時
                </p>
                <p className="text-xs text-muted-foreground">
                  本月累計將達：{projectedTotal} / {MONTHLY_LIMIT} 小時
                </p>
              </div>
            )}

            {/* 加班原因 */}
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>加班原因 *</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="請輸入加班原因"
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
                disabled={isSubmitting || isOverLimit}
              >
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Send className="mr-2 h-4 w-4" />
                提交加班申請
              </Button>
            </div>
          </form>
        </Form>

        {/* 確認 Dialog */}
        <ConfirmDialog
          open={showConfirm}
          onOpenChange={setShowConfirm}
          title="確認送出加班申請"
          description={`日期：${form.getValues("date") ? format(form.getValues("date"), "yyyy/MM/dd") : ""}\n時間：${startTime} ~ ${endTime}\n時數：${estimatedHours} 小時\n確定要送出嗎？`}
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
- Calendar 支援鍵盤導航（Arrow keys, Enter, Escape）
- Select 下拉支援鍵盤操作
- Textarea 有 maxLength 限制 + 即時字數回饋
- 確認 Dialog 使用 AlertDialog（trap focus + Escape 關閉）
- 超限時 disable 提交按鈕 + 視覺警告文字
- Progress bar 有 `aria-valuenow` / `aria-valuemax`

## 使用的元件

| 元件 | 來源 |
|------|------|
| Form, FormField, FormItem, FormLabel, FormControl, FormMessage | shadcn/ui |
| Select, SelectContent, SelectItem, SelectTrigger, SelectValue | shadcn/ui |
| Popover, PopoverContent, PopoverTrigger | shadcn/ui |
| Calendar | shadcn/ui |
| Textarea | shadcn/ui |
| Button | shadcn/ui |
| Card, CardContent, CardHeader, CardTitle | shadcn/ui |
| Progress | shadcn/ui |
| ConfirmDialog | `design/components/confirm-dialog` |
