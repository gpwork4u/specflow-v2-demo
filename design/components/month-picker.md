# MonthPicker

## 用途

月份選擇器，用於行事曆和報表頁面切換年月。支援前後月導航和直接選擇月份。基於 shadcn/ui 的 `Button`、`Popover`、`Select` 元件組合。

## Props

| Prop | Type | Default | 說明 |
|------|------|---------|------|
| year | `number` | - | 目前年份 |
| month | `number` | - | 目前月份（1-12） |
| onChange | `(year: number, month: number) => void` | - | 年月變更回呼 |
| minDate | `{ year: number; month: number }` | `{ year: 2020, month: 1 }` | 可選最早年月 |
| maxDate | `{ year: number; month: number }` | `當月` | 可選最晚年月 |
| disabled | `boolean` | `false` | 禁用狀態 |

## Layout

```
┌──────────────────────────────────┐
│ [<]   2026 年 4 月    [>]        │
└──────────────────────────────────┘

點擊中間文字展開 Popover：
┌──────────────────────────────────┐
│ [<]  2026  [>]                   │
│                                  │
│  1月   2月   3月   4月           │
│  5月   6月   7月   8月           │
│  9月  10月  11月  12月           │
└──────────────────────────────────┘
```

## 外觀規格

| 部位 | 樣式 |
|------|------|
| 容器 | `flex items-center gap-2` |
| 前/後按鈕 | `Button variant="outline" size="icon" className="h-8 w-8"` |
| 年月顯示按鈕 | `Button variant="ghost" className="min-w-[140px] text-sm font-medium"` |
| Popover 容器 | `w-[280px] p-4` |
| 年份切換 | `flex items-center justify-between mb-3`，年份文字 `text-sm font-semibold` |
| 月份格 | `grid grid-cols-4 gap-2` |
| 月份按鈕 | `Button variant="ghost" size="sm" className="h-9"`，選中時 `variant="default"` |
| 禁用月份 | `opacity-50 cursor-not-allowed` |

## States

| State | 外觀變化 |
|-------|---------|
| default | 顯示當前年月文字，左右箭頭可用 |
| hover（箭頭） | 箭頭按鈕 `bg-accent` |
| disabled（箭頭） | 達到 min/max 時 `opacity-50 cursor-not-allowed` |
| popover-open | 中間按鈕高亮，顯示月份選擇面板 |
| selected-month | 當前月份以 `bg-primary text-primary-foreground` 標示 |

## 範例程式碼

```tsx
"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface MonthPickerProps {
  year: number;
  month: number;
  onChange: (year: number, month: number) => void;
  minDate?: { year: number; month: number };
  maxDate?: { year: number; month: number };
  disabled?: boolean;
}

const MONTHS = [
  "1月", "2月", "3月", "4月",
  "5月", "6月", "7月", "8月",
  "9月", "10月", "11月", "12月",
];

export function MonthPicker({
  year,
  month,
  onChange,
  minDate = { year: 2020, month: 1 },
  maxDate,
  disabled = false,
}: MonthPickerProps) {
  const [open, setOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(year);

  const now = new Date();
  const max = maxDate ?? { year: now.getFullYear(), month: now.getMonth() + 1 };

  const canPrev =
    year > minDate.year || (year === minDate.year && month > minDate.month);
  const canNext =
    year < max.year || (year === max.year && month < max.month);

  function goPrev() {
    if (!canPrev) return;
    if (month === 1) {
      onChange(year - 1, 12);
    } else {
      onChange(year, month - 1);
    }
  }

  function goNext() {
    if (!canNext) return;
    if (month === 12) {
      onChange(year + 1, 1);
    } else {
      onChange(year, month + 1);
    }
  }

  function isMonthDisabled(m: number): boolean {
    if (pickerYear < minDate.year) return true;
    if (pickerYear === minDate.year && m < minDate.month) return true;
    if (pickerYear > max.year) return true;
    if (pickerYear === max.year && m > max.month) return true;
    return false;
  }

  function selectMonth(m: number) {
    onChange(pickerYear, m);
    setOpen(false);
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        onClick={goPrev}
        disabled={disabled || !canPrev}
        aria-label="上個月"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            className="min-w-[140px] text-sm font-medium"
            disabled={disabled}
            aria-label={`${year} 年 ${month} 月，點擊選擇月份`}
          >
            {year} 年 {month} 月
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[280px] p-4" align="center">
          {/* 年份切換 */}
          <div className="mb-3 flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setPickerYear((y) => y - 1)}
              disabled={pickerYear <= minDate.year}
              aria-label="上一年"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-semibold">{pickerYear}</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setPickerYear((y) => y + 1)}
              disabled={pickerYear >= max.year}
              aria-label="下一年"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* 月份格 */}
          <div className="grid grid-cols-4 gap-2">
            {MONTHS.map((label, i) => {
              const m = i + 1;
              const isSelected = pickerYear === year && m === month;
              const isDisabled = isMonthDisabled(m);

              return (
                <Button
                  key={m}
                  variant={isSelected ? "default" : "ghost"}
                  size="sm"
                  className="h-9"
                  disabled={isDisabled}
                  onClick={() => selectMonth(m)}
                  aria-label={`${pickerYear} 年 ${label}`}
                  aria-pressed={isSelected}
                >
                  {label}
                </Button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>

      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        onClick={goNext}
        disabled={disabled || !canNext}
        aria-label="下個月"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
```

## 使用範例

```tsx
// 行事曆頁面
const [year, setYear] = useState(2026);
const [month, setMonth] = useState(4);

<MonthPicker
  year={year}
  month={month}
  onChange={(y, m) => {
    setYear(y);
    setMonth(m);
  }}
/>

// 報表頁面（限制只能看到當月以前）
<MonthPicker
  year={year}
  month={month}
  onChange={(y, m) => {
    setYear(y);
    setMonth(m);
  }}
  maxDate={{ year: 2026, month: 4 }}
/>
```

## Accessibility

- 前/後箭頭按鈕有 `aria-label`（"上個月"、"下個月"）
- 年月顯示按鈕有 `aria-label` 提示可展開選擇
- Popover 面板中的年切換按鈕有 `aria-label`
- 月份按鈕使用 `aria-pressed` 標示選中狀態
- 禁用月份有 `disabled` 屬性
- 完整支援 keyboard navigation（Tab、Enter、Escape）

## 使用的 shadcn/ui 元件

- `Button`
- `Popover`（PopoverTrigger, PopoverContent）
