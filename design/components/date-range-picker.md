# DateRangePicker

## 用途

日期範圍選擇器，支援單日和跨日選擇，並可為首日和末日分別設定半天選項（全天/上午/下午）。專為請假申請設計。基於 shadcn/ui 的 `Calendar`、`Popover`、`RadioGroup` 元件組合。

## Props

| Prop | Type | Default | 說明 |
|------|------|---------|------|
| startDate | `Date \| undefined` | - | 開始日期 |
| endDate | `Date \| undefined` | - | 結束日期 |
| onStartDateChange | `(date: Date \| undefined) => void` | - | 開始日期變更回呼 |
| onEndDateChange | `(date: Date \| undefined) => void` | - | 結束日期變更回呼 |
| startHalf | `HalfDay` | `'full'` | 首日半天選項 |
| endHalf | `HalfDay` | `'full'` | 末日半天選項 |
| onStartHalfChange | `(half: HalfDay) => void` | - | 首日半天變更回呼 |
| onEndHalfChange | `(half: HalfDay) => void` | - | 末日半天變更回呼 |
| minDate | `Date` | `today` | 可選的最早日期 |
| maxDate | `Date` | - | 可選的最晚日期 |
| disabledDates | `Date[]` | `[]` | 已有假的日期（不可選） |
| disabled | `boolean` | `false` | 禁用狀態 |

### HalfDay

```ts
type HalfDay = "full" | "morning" | "afternoon";
```

## 子元件

### HalfDaySelector

獨立的半天選擇 RadioGroup，可在 DateRangePicker 內或單獨使用。

| Prop | Type | Default | 說明 |
|------|------|---------|------|
| value | `HalfDay` | `'full'` | 目前選擇 |
| onChange | `(value: HalfDay) => void` | - | 變更回呼 |
| label | `string` | - | 標籤（如 "首日" / "末日"） |
| disabled | `boolean` | `false` | 禁用狀態 |

## Layout

### 單日模式（startDate === endDate）

```
┌─────────────────────────────────────┐
│ 請假日期                            │
│ ┌───────────────────┐               │
│ │ 📅 2026-04-10     │ ← Popover    │
│ └───────────────────┘               │
│                                     │
│ 時段選擇                            │
│ ○ 全天  ○ 上午  ○ 下午              │
└─────────────────────────────────────┘
```

### 跨日模式（startDate !== endDate）

```
┌─────────────────────────────────────┐
│ 開始日期            結束日期        │
│ ┌───────────┐      ┌───────────┐   │
│ │ 📅 04-10  │  →   │ 📅 04-14  │   │
│ └───────────┘      └───────────┘   │
│                                     │
│ 首日時段            末日時段        │
│ ○ 全天              ○ 全天          │
│ ○ 下午              ○ 上午          │
│                     ○ 全天          │
│                                     │
│ 📊 預計請假: 4.5 天 (36 小時)       │
└─────────────────────────────────────┘
```

## 外觀規格

| 部位 | 樣式 |
|------|------|
| 日期觸發按鈕 | `variant="outline" className="w-full pl-3 text-left font-normal"` |
| Calendar | shadcn/ui `Calendar` mode="single" / mode="range" |
| HalfDaySelector | `RadioGroup` 水平排列，`flex gap-3` |
| Radio 選項 | `flex items-center gap-1.5`，Label `text-sm` |
| 時數預覽 | `text-sm text-muted-foreground mt-2`，含 `Calculator` icon |
| 已有假日期 | Calendar 中以 `line-through opacity-50` 顯示 |
| 容器 | `space-y-4` |

## 計算邏輯

```ts
function calculateLeaveHours(
  startDate: Date,
  endDate: Date,
  startHalf: HalfDay,
  endHalf: HalfDay
): number {
  const days = differenceInCalendarDays(endDate, startDate) + 1;

  if (days === 1) {
    // 單日
    return startHalf === "full" ? 8 : 4;
  }

  // 跨日：中間天 * 8 + 首日 + 末日
  const middleDays = days - 2;
  const startHours = startHalf === "full" ? 8 : 4;
  const endHours = endHalf === "full" ? 8 : 4;

  return middleDays * 8 + startHours + endHours;
}
```

## 範例程式碼

```tsx
import { useState } from "react";
import { format, differenceInCalendarDays } from "date-fns";
import { zhTW } from "date-fns/locale";
import { CalendarIcon, Calculator } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type HalfDay = "full" | "morning" | "afternoon";

// --- HalfDaySelector 子元件 ---
interface HalfDaySelectorProps {
  value: HalfDay;
  onChange: (value: HalfDay) => void;
  label: string;
  disabled?: boolean;
  /** 首日只能選 full 或 afternoon；末日只能選 full 或 morning */
  options?: HalfDay[];
}

function HalfDaySelector({
  value,
  onChange,
  label,
  disabled = false,
  options = ["full", "morning", "afternoon"],
}: HalfDaySelectorProps) {
  const labels: Record<HalfDay, string> = {
    full: "全天",
    morning: "上午",
    afternoon: "下午",
  };

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      <RadioGroup
        value={value}
        onValueChange={(v) => onChange(v as HalfDay)}
        disabled={disabled}
        className="flex gap-3"
      >
        {options.map((option) => (
          <div key={option} className="flex items-center gap-1.5">
            <RadioGroupItem value={option} id={`${label}-${option}`} />
            <Label htmlFor={`${label}-${option}`} className="text-sm cursor-pointer">
              {labels[option]}
            </Label>
          </div>
        ))}
      </RadioGroup>
    </div>
  );
}

// --- DateRangePicker 主元件 ---
interface DateRangePickerProps {
  startDate: Date | undefined;
  endDate: Date | undefined;
  onStartDateChange: (date: Date | undefined) => void;
  onEndDateChange: (date: Date | undefined) => void;
  startHalf: HalfDay;
  endHalf: HalfDay;
  onStartHalfChange: (half: HalfDay) => void;
  onEndHalfChange: (half: HalfDay) => void;
  minDate?: Date;
  disabledDates?: Date[];
  disabled?: boolean;
}

export function DateRangePicker({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  startHalf,
  endHalf,
  onStartHalfChange,
  onEndHalfChange,
  minDate = new Date(),
  disabledDates = [],
  disabled = false,
}: DateRangePickerProps) {
  const isSameDay =
    startDate && endDate && differenceInCalendarDays(endDate, startDate) === 0;

  const hours =
    startDate && endDate
      ? calculateLeaveHours(startDate, endDate, startHalf, endHalf)
      : 0;

  return (
    <div className="space-y-4">
      {/* 日期選擇 */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* 開始日期 */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">開始日期</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                disabled={disabled}
                className={cn(
                  "w-full pl-3 text-left font-normal",
                  !startDate && "text-muted-foreground"
                )}
              >
                {startDate ? format(startDate, "yyyy-MM-dd") : "請選擇日期"}
                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={startDate}
                onSelect={onStartDateChange}
                disabled={(date) =>
                  date < minDate ||
                  disabledDates.some(
                    (d) => d.toDateString() === date.toDateString()
                  )
                }
                locale={zhTW}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* 結束日期 */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">結束日期</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                disabled={disabled || !startDate}
                className={cn(
                  "w-full pl-3 text-left font-normal",
                  !endDate && "text-muted-foreground"
                )}
              >
                {endDate ? format(endDate, "yyyy-MM-dd") : "請選擇日期"}
                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={endDate}
                onSelect={onEndDateChange}
                disabled={(date) =>
                  (startDate ? date < startDate : true) ||
                  disabledDates.some(
                    (d) => d.toDateString() === date.toDateString()
                  )
                }
                locale={zhTW}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* 半天選擇 */}
      {startDate && endDate && (
        <div className={cn("grid gap-4", !isSameDay && "sm:grid-cols-2")}>
          {isSameDay ? (
            <HalfDaySelector
              value={startHalf}
              onChange={(v) => {
                onStartHalfChange(v);
                onEndHalfChange(v);
              }}
              label="時段選擇"
              disabled={disabled}
            />
          ) : (
            <>
              <HalfDaySelector
                value={startHalf}
                onChange={onStartHalfChange}
                label="首日時段"
                options={["full", "afternoon"]}
                disabled={disabled}
              />
              <HalfDaySelector
                value={endHalf}
                onChange={onEndHalfChange}
                label="末日時段"
                options={["full", "morning"]}
                disabled={disabled}
              />
            </>
          )}
        </div>
      )}

      {/* 時數預覽 */}
      {hours > 0 && (
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Calculator className="h-4 w-4" />
          <span>
            預計請假: {hours / 8} 天 ({hours} 小時)
          </span>
        </div>
      )}
    </div>
  );
}
```

## 使用範例

```tsx
// 在 LeaveForm 中使用
<DateRangePicker
  startDate={form.watch("start_date")}
  endDate={form.watch("end_date")}
  onStartDateChange={(d) => form.setValue("start_date", d)}
  onEndDateChange={(d) => form.setValue("end_date", d)}
  startHalf={form.watch("start_half")}
  endHalf={form.watch("end_half")}
  onStartHalfChange={(v) => form.setValue("start_half", v)}
  onEndHalfChange={(v) => form.setValue("end_half", v)}
  minDate={new Date()} // 不可選過去日期
  disabledDates={existingLeaveDates} // 已有假的日期
/>
```

## 互動規則

1. 開始日期選擇後，結束日期的 Calendar 自動限制 >= 開始日期
2. 若開始日期晚於結束日期，自動清空結束日期
3. 單日模式：只顯示一組半天選項（全天/上午/下午）
4. 跨日首日：只可選 full 或 afternoon（不能只請上午然後隔天繼續）
5. 跨日末日：只可選 full 或 morning
6. 選擇假別為 sick 時，minDate 允許 today - 3
7. disabledDates 在 Calendar 中以刪除線 + 半透明顯示
8. 時數預覽即時更新

## Accessibility

- Calendar 支援鍵盤操作（方向鍵、Enter、Escape）
- RadioGroup 支援方向鍵切換
- 所有日期按鈕有 `aria-label`（含完整日期文字）
- 禁用日期有 `aria-disabled="true"`
- 已有假的日期提供 tooltip 說明
- Label 透過 `htmlFor` 關聯控制項

## 使用的 shadcn/ui 元件

- `Calendar`
- `Popover`（PopoverTrigger, PopoverContent）
- `RadioGroup`（RadioGroupItem）
- `Button`
- `Label`
