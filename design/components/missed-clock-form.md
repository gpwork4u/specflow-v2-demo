# MissedClockForm

## 用途

補打卡申請表單元件，封裝完整的補打卡流程：日期選擇（限 7 天內）、上班/下班類型切換、時間選擇、原因輸入。使用 `react-hook-form` + `zod` 驗證。

## Props

| Prop | Type | Default | 說明 |
|------|------|---------|------|
| onSubmit | `(data: MissedClockFormValues) => Promise<void>` | - | 提交回呼 |
| isSubmitting | `boolean` | `false` | 是否正在提交 |
| disabledEntries | `DisabledEntry[]` | `[]` | 已有補打卡或已打卡的日期/類型組合（不可選） |

### Types

```ts
type ClockType = "clock_in" | "clock_out";

interface MissedClockFormValues {
  date: Date;
  clock_type: ClockType;
  requested_time: string; // HH:mm
  reason: string;
}

interface DisabledEntry {
  date: string; // ISO date
  clock_type: ClockType;
  reason: "already_clocked" | "pending_request";
}
```

## Zod Schema

```ts
import { z } from "zod";

export const missedClockFormSchema = z.object({
  date: z.date({ required_error: "請選擇日期" }),
  clock_type: z.enum(["clock_in", "clock_out"], {
    required_error: "請選擇打卡類型",
  }),
  requested_time: z
    .string({ required_error: "請選擇時間" })
    .regex(/^\d{2}:\d{2}$/, "時間格式不正確"),
  reason: z
    .string()
    .min(1, "請輸入補打卡原因")
    .max(500, "原因最長 500 字元"),
});
```

## Layout

```
+-------------------------------------------------+
| 補打卡申請                                       |
|                                                  |
| +-- 提示 ------------------------------------+   |
| | (i) 補打卡僅適用於忘記打卡的情況，         |   |
| |     申請後需由主管審核。限 7 天內。          |   |
| +--------------------------------------------+   |
|                                                  |
| 補打卡日期 *                                     |
| +-------------------------------+                |
| | 日曆 2026-04-06               |                |
| +-------------------------------+                |
| 可選範圍：過去 7 天 ~ 今天                       |
|                                                  |
| 打卡類型 *                                       |
| +--------------------+--------------------+      |
| |  (x) 上班打卡      |  ( ) 下班打卡      |      |
| +--------------------+--------------------+      |
| [若該日期+類型已有紀錄，顯示警告]                  |
|                                                  |
| 補打卡時間 *                                     |
| +--------------+                                 |
| | 09:00        |                                 |
| +--------------+                                 |
|                                                  |
| 補打卡原因 *                                     |
| +-------------------------------+                |
| | 忘記打卡，當日 9:00 已到辦公室  |                |
| |                               |                |
| +-------------------------------+                |
|                              28 / 500 字         |
|                                                  |
|                    [取消]  [提交補打卡申請]        |
+-------------------------------------------------+

       下 點擊提交後出現確認 Dialog

+-------------------------------------+
| 確認送出補打卡申請                   |
|                                     |
| 日期：2026/04/06                    |
| 類型：上班打卡                      |
| 時間：09:00                         |
| 原因：忘記打卡，當日 9:00 已到辦公室  |
|                                     |
|              [取消]  [確認送出]       |
+-------------------------------------+
```

## 互動流程

1. 頁面載入時顯示使用提示（info 框）
2. 使用者選擇日期（限過去 7 天 ~ 今天）
3. 選擇打卡類型（上班/下班），若選定的日期+類型組合在 disabledEntries 中：
   - reason = "already_clocked"：顯示「該日已有上班打卡紀錄，無需補打卡」
   - reason = "pending_request"：顯示「該日已有待審核的補上班打卡申請」
4. 選擇補打卡時間
5. 輸入原因，即時字數統計
6. 點擊提交 -> 跳出確認 Dialog
7. 確認後呼叫 API，成功後跳轉至補打卡紀錄列表

## 外觀規格

| 部位 | 樣式 |
|------|------|
| 表單容器 | `Card` 包裹，`p-6 space-y-6` |
| 標題 | `text-xl font-semibold` |
| 提示框 | `bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4` + `Info` icon |
| 日期選擇 | shadcn/ui `Popover` + `Calendar`，minDate = today - 7, maxDate = today |
| 打卡類型 | shadcn/ui `ToggleGroup` variant="outline"，選中時 `bg-primary text-primary-foreground` |
| 類型衝突警告 | `bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 text-sm p-3 rounded-md` + `AlertTriangle` icon |
| 時間選擇 | shadcn/ui `Select`，以 15 分鐘為間隔（上班類型 07:00~12:00，下班類型 12:00~23:00） |
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  AlertTriangle, CalendarIcon, Clock, Info, Loader2, LogIn, LogOut, Send,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { missedClockFormSchema, type MissedClockFormValues } from "@/lib/schemas/missed-clock";

// 產生時間選項（15 分鐘間隔）
function generateTimeOptions(clockType: "clock_in" | "clock_out") {
  const start = clockType === "clock_in" ? 7 * 4 : 12 * 4; // 07:00 or 12:00
  const end = clockType === "clock_in" ? 12 * 4 : 23 * 4;  // 12:00 or 23:00
  return Array.from({ length: end - start + 1 }, (_, i) => {
    const total = start + i;
    const h = String(Math.floor(total / 4)).padStart(2, "0");
    const m = String((total % 4) * 15).padStart(2, "0");
    return `${h}:${m}`;
  });
}

const clockTypeLabels = {
  clock_in: "上班打卡",
  clock_out: "下班打卡",
} as const;

interface MissedClockFormProps {
  onSubmit: (data: MissedClockFormValues) => Promise<void>;
  isSubmitting?: boolean;
  disabledEntries?: DisabledEntry[];
}

export function MissedClockForm({
  onSubmit,
  isSubmitting = false,
  disabledEntries = [],
}: MissedClockFormProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const form = useForm<MissedClockFormValues>({
    resolver: zodResolver(missedClockFormSchema),
    defaultValues: {
      clock_type: "clock_in",
      reason: "",
    },
  });

  const selectedDate = form.watch("date");
  const clockType = form.watch("clock_type");
  const reason = form.watch("reason") || "";

  // 檢查是否有衝突
  const conflict = useMemo(() => {
    if (!selectedDate || !clockType) return null;
    const dateStr = format(selectedDate, "yyyy-MM-dd");
    return disabledEntries.find(
      (e) => e.date === dateStr && e.clock_type === clockType
    ) || null;
  }, [selectedDate, clockType, disabledEntries]);

  const timeOptions = useMemo(
    () => generateTimeOptions(clockType || "clock_in"),
    [clockType]
  );

  const handleFormSubmit = () => setShowConfirm(true);

  const handleConfirm = async () => {
    setShowConfirm(false);
    await onSubmit(form.getValues());
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>補打卡申請</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6">
            {/* 使用提示 */}
            <div className="flex gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950/30">
              <Info className="h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />
              <p className="text-sm text-blue-700 dark:text-blue-300">
                補打卡僅適用於忘記打卡的情況，申請後需由主管審核。僅可申請 7 天內的補打卡。
              </p>
            </div>

            {/* 補打卡日期 */}
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>補打卡日期 *</FormLabel>
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
                          date > new Date() || date < subDays(new Date(), 7)
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

            {/* 打卡類型 */}
            <FormField
              control={form.control}
              name="clock_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>打卡類型 *</FormLabel>
                  <FormControl>
                    <ToggleGroup
                      type="single"
                      value={field.value}
                      onValueChange={(v) => {
                        if (v) {
                          field.onChange(v);
                          form.setValue("requested_time", ""); // 切換類型時重置時間
                        }
                      }}
                      className="justify-start"
                    >
                      <ToggleGroupItem
                        value="clock_in"
                        className="flex-1 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                        aria-label="上班打卡"
                      >
                        <LogIn className="mr-2 h-4 w-4" />
                        上班打卡
                      </ToggleGroupItem>
                      <ToggleGroupItem
                        value="clock_out"
                        className="flex-1 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                        aria-label="下班打卡"
                      >
                        <LogOut className="mr-2 h-4 w-4" />
                        下班打卡
                      </ToggleGroupItem>
                    </ToggleGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 類型衝突警告 */}
            {conflict && (
              <div className="flex items-center gap-2 rounded-md bg-amber-50 p-3 text-sm text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>
                  {conflict.reason === "already_clocked"
                    ? `該日已有${clockTypeLabels[clockType]}紀錄，無需補打卡。`
                    : `該日已有待審核的補${clockTypeLabels[clockType]}申請。`}
                </span>
              </div>
            )}

            {/* 補打卡時間 */}
            <FormField
              control={form.control}
              name="requested_time"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>補打卡時間 *</FormLabel>
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

            {/* 補打卡原因 */}
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>補打卡原因 *</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="請輸入補打卡原因（例如：忘記打卡，當日 9:00 已到辦公室）"
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
                disabled={isSubmitting || !!conflict}
              >
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Send className="mr-2 h-4 w-4" />
                提交補打卡申請
              </Button>
            </div>
          </form>
        </Form>

        {/* 確認 Dialog */}
        <ConfirmDialog
          open={showConfirm}
          onOpenChange={setShowConfirm}
          title="確認送出補打卡申請"
          description={`日期：${selectedDate ? format(selectedDate, "yyyy/MM/dd") : ""}\n類型：${clockTypeLabels[clockType] || ""}\n時間：${form.getValues("requested_time")}\n確定要送出嗎？`}
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
- ToggleGroup 支援鍵盤操作（Arrow keys 切換，Enter/Space 選擇）
- 每個 ToggleGroupItem 有 `aria-label`
- Calendar 支援鍵盤導航
- 衝突警告使用 `role="alert"` 確保 screen reader 讀取
- Textarea 有 maxLength 限制 + 即時字數回饋
- 確認 Dialog trap focus + Escape 關閉

## 使用的元件

| 元件 | 來源 |
|------|------|
| Form, FormField, FormItem, FormLabel, FormControl, FormMessage | shadcn/ui |
| Select, SelectContent, SelectItem, SelectTrigger, SelectValue | shadcn/ui |
| Popover, PopoverContent, PopoverTrigger | shadcn/ui |
| Calendar | shadcn/ui |
| ToggleGroup, ToggleGroupItem | shadcn/ui |
| Textarea | shadcn/ui |
| Button | shadcn/ui |
| Card, CardContent, CardHeader, CardTitle | shadcn/ui |
| ConfirmDialog | `design/components/confirm-dialog` |
