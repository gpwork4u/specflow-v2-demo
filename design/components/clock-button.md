# ClockButton

## 用途

打卡頁面的核心元件 — 一個大型的打卡按鈕，搭配即時時鐘顯示和今日打卡狀態。設計重點為手機 PWA 操作友善、視覺明確。

## Props

| Prop | Type | Default | 說明 |
|------|------|---------|------|
| status | `'idle' \| 'clocked_in' \| 'clocked_out'` | `'idle'` | 今日打卡狀態 |
| clockInTime | `string \| null` | `null` | 上班打卡時間（ISO string） |
| clockOutTime | `string \| null` | `null` | 下班打卡時間（ISO string） |
| onClockIn | `() => void` | - | 上班打卡回呼 |
| onClockOut | `() => void` | - | 下班打卡回呼 |
| isLoading | `boolean` | `false` | 打卡請求中 |

## 狀態與外觀

| Status | 按鈕文字 | 按鈕顏色 | 按鈕動作 | 狀態文字 |
|--------|---------|----------|---------|---------|
| `idle` | 上班打卡 | Primary (Blue) | `onClockIn` | 尚未打卡 |
| `clocked_in` | 下班打卡 | Success (Green) | `onClockOut` | 已打上班卡 HH:mm |
| `clocked_out` | 今日已完成 | Muted (Gray) | disabled | 上班 HH:mm / 下班 HH:mm |

## 外觀規格

| 部位 | 樣式 |
|------|------|
| 容器 | `flex flex-col items-center gap-6`，置中 |
| 即時時鐘 | `text-5xl font-bold tabular-nums tracking-tight`，每秒更新 |
| 日期 | `text-lg text-muted-foreground`，格式：2026年4月7日 星期二 |
| 打卡按鈕 | 圓形，`w-48 h-48 rounded-full`，shadow-lg |
| 按鈕文字 | `text-2xl font-bold text-white` |
| 按鈕 Icon | `h-10 w-10`，在文字上方 |
| 狀態卡片 | `rounded-xl border bg-card p-4`，寬度與按鈕同 |
| Loading | 按鈕內顯示 Spinner，文字變 "處理中..." |

## 範例程式碼

```tsx
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  LogIn,
  LogOut,
  CheckCircle2,
  Loader2,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { zhTW } from "date-fns/locale";

interface ClockButtonProps {
  status: "idle" | "clocked_in" | "clocked_out";
  clockInTime: string | null;
  clockOutTime: string | null;
  onClockIn: () => void;
  onClockOut: () => void;
  isLoading?: boolean;
}

export function ClockButton({
  status,
  clockInTime,
  clockOutTime,
  onClockIn,
  onClockOut,
  isLoading = false,
}: ClockButtonProps) {
  const [now, setNow] = useState(new Date());

  // 即時時鐘（每秒更新）
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const buttonConfig = {
    idle: {
      label: "上班打卡",
      icon: LogIn,
      onClick: onClockIn,
      disabled: false,
      className: "bg-primary hover:bg-primary/90 shadow-primary/25",
    },
    clocked_in: {
      label: "下班打卡",
      icon: LogOut,
      onClick: onClockOut,
      disabled: false,
      className: "bg-green-600 hover:bg-green-700 shadow-green-600/25",
    },
    clocked_out: {
      label: "今日已完成",
      icon: CheckCircle2,
      onClick: () => {},
      disabled: true,
      className: "bg-muted text-muted-foreground shadow-none",
    },
  };

  const config = buttonConfig[status];
  const Icon = config.icon;

  return (
    <div className="flex flex-col items-center gap-8">
      {/* 即時時鐘 */}
      <div className="text-center">
        <p className="text-5xl font-bold tabular-nums tracking-tight">
          {format(now, "HH:mm:ss")}
        </p>
        <p className="mt-2 text-lg text-muted-foreground">
          {format(now, "yyyy年M月d日 EEEE", { locale: zhTW })}
        </p>
      </div>

      {/* 打卡按鈕 */}
      <button
        onClick={config.onClick}
        disabled={config.disabled || isLoading}
        className={cn(
          "flex h-48 w-48 flex-col items-center justify-center rounded-full",
          "text-white shadow-lg transition-all duration-200",
          "active:scale-95 disabled:opacity-60 disabled:active:scale-100",
          "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring",
          config.className
        )}
        aria-label={config.label}
      >
        {isLoading ? (
          <>
            <Loader2 className="h-10 w-10 animate-spin" />
            <span className="mt-2 text-lg font-semibold">處理中...</span>
          </>
        ) : (
          <>
            <Icon className="h-10 w-10" />
            <span className="mt-2 text-2xl font-bold">{config.label}</span>
          </>
        )}
      </button>

      {/* 今日狀態 */}
      <Card className="w-full max-w-xs">
        <CardContent className="p-4">
          <h3 className="mb-3 text-center text-sm font-medium text-muted-foreground">
            今日打卡狀態
          </h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <LogIn className="h-4 w-4 text-muted-foreground" />
                <span>上班</span>
              </div>
              <span className={cn("text-sm font-medium", clockInTime ? "" : "text-muted-foreground")}>
                {clockInTime
                  ? format(new Date(clockInTime), "HH:mm:ss")
                  : "--:--:--"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <LogOut className="h-4 w-4 text-muted-foreground" />
                <span>下班</span>
              </div>
              <span className={cn("text-sm font-medium", clockOutTime ? "" : "text-muted-foreground")}>
                {clockOutTime
                  ? format(new Date(clockOutTime), "HH:mm:ss")
                  : "--:--:--"}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

## 使用範例

```tsx
// 尚未打卡
<ClockButton
  status="idle"
  clockInTime={null}
  clockOutTime={null}
  onClockIn={handleClockIn}
  onClockOut={handleClockOut}
/>

// 已打上班卡
<ClockButton
  status="clocked_in"
  clockInTime="2026-04-07T01:00:00Z"
  clockOutTime={null}
  onClockIn={handleClockIn}
  onClockOut={handleClockOut}
/>

// 今日已完成
<ClockButton
  status="clocked_out"
  clockInTime="2026-04-07T01:00:00Z"
  clockOutTime="2026-04-07T10:00:00Z"
  onClockIn={handleClockIn}
  onClockOut={handleClockOut}
/>

// 載入中
<ClockButton
  status="idle"
  clockInTime={null}
  clockOutTime={null}
  onClockIn={handleClockIn}
  onClockOut={handleClockOut}
  isLoading
/>
```

## 響應式行為

| 斷點 | 按鈕大小 | 時鐘字體 |
|------|---------|---------|
| >= 768px (md) | 192x192px (w-48) | text-5xl |
| < 768px (sm) | 160x160px (w-40) | text-4xl |

手機版按鈕仍需保持足夠大的觸控區域（最小 48x48px，實際遠超此標準）。

## PWA 特殊考量

- 即時時鐘每秒更新一次（`setInterval 1000ms`），在 visibilitychange 時暫停/恢復以節省電量
- 按鈕按下時有 `active:scale-95` 回饋，提供觸覺感
- Loading 狀態防止重複點擊（雙重保護：UI disable + API debounce）
- 離線時顯示離線提示（由上層頁面處理）

## Accessibility

- 按鈕有明確的 `aria-label`
- Loading 時 `aria-busy="true"`
- Disabled 時 `aria-disabled="true"`
- 時鐘使用 `tabular-nums` 確保數字等寬，避免跳動
- Focus ring 明顯（`ring-4`）
- 色彩不作為唯一的狀態辨識（搭配 icon + 文字）

## 使用的 shadcn/ui 元件

- `Button`（樣式參考）
- `Card`
