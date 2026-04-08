# QuotaProgressBar

## 用途

顯示單一假別的額度使用進度條，包含已用/總額/剩餘的數字資訊。用於個人額度總覽頁和請假申請表單中的即時額度提示。基於 shadcn/ui 的 `Progress` 元件擴展。

## Props

| Prop | Type | Default | 說明 |
|------|------|---------|------|
| leaveType | `LeaveType` | - | 假別代碼 |
| totalHours | `number` | - | 總額度（小時） |
| usedHours | `number` | - | 已使用（小時） |
| showLabel | `boolean` | `true` | 是否顯示假別名稱 |
| showDetails | `boolean` | `true` | 是否顯示詳細數字 |
| size | `'sm' \| 'md' \| 'lg'` | `'md'` | 進度條大小 |
| highlightRemaining | `boolean` | `false` | 強調剩餘額度（用於選擇假別後的即時提示） |

## Computed Values

```ts
const remainingHours = totalHours - usedHours;
const percentage = totalHours > 0 ? (usedHours / totalHours) * 100 : 0;
const remainingDays = remainingHours / 8;
const usedDays = usedHours / 8;
const totalDays = totalHours / 8;
```

## 外觀規格

### Sizes

| Size | 進度條高度 | Label 字級 | 數字字級 |
|------|-----------|-----------|---------|
| `sm` | `h-1.5` | `text-xs` | `text-xs` |
| `md` | `h-2.5` | `text-sm` | `text-sm` |
| `lg` | `h-3.5` | `text-base` | `text-base font-medium` |

### 色彩規則

| 使用率 | 進度條顏色 | 說明 |
|--------|-----------|------|
| 0-70% | 對應假別色 (`--leave-{type}`) | 正常 |
| 70-90% | `--warning` (Amber) | 額度偏低 |
| 90-100% | `--destructive` (Red) | 額度即將用完 |
| 100% | `--destructive` (Red) + 文字提示 | 已用完 |

### Layout

```
┌──────────────────────────────────────┐
│ [Icon] 特休                 剩餘 8 天 │ ← showLabel + 剩餘
│ ████████████░░░░░░░░░░░░░░░░░░░░░░  │ ← Progress bar
│ 已用 2 天 / 總計 10 天              │ ← showDetails
└──────────────────────────────────────┘
```

## 範例程式碼

```tsx
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { LeaveTypeBadge } from "@/components/leave-type-badge";

type LeaveType =
  | "annual" | "personal" | "sick" | "marriage"
  | "bereavement" | "maternity" | "paternity" | "official";

interface QuotaProgressBarProps {
  leaveType: LeaveType;
  totalHours: number;
  usedHours: number;
  showLabel?: boolean;
  showDetails?: boolean;
  size?: "sm" | "md" | "lg";
  highlightRemaining?: boolean;
}

const leaveBarColors: Record<LeaveType, string> = {
  annual: "bg-[hsl(var(--leave-annual))]",
  personal: "bg-[hsl(var(--leave-personal))]",
  sick: "bg-[hsl(var(--leave-sick))]",
  marriage: "bg-[hsl(var(--leave-marriage))]",
  bereavement: "bg-[hsl(var(--leave-bereavement))]",
  maternity: "bg-[hsl(var(--leave-maternity))]",
  paternity: "bg-[hsl(var(--leave-paternity))]",
  official: "bg-[hsl(var(--leave-official))]",
};

export function QuotaProgressBar({
  leaveType,
  totalHours,
  usedHours,
  showLabel = true,
  showDetails = true,
  size = "md",
  highlightRemaining = false,
}: QuotaProgressBarProps) {
  const remainingHours = totalHours - usedHours;
  const percentage = totalHours > 0 ? Math.min((usedHours / totalHours) * 100, 100) : 0;
  const remainingDays = remainingHours / 8;
  const usedDays = usedHours / 8;
  const totalDays = totalHours / 8;

  // 色彩依使用率
  const barColor =
    percentage >= 90
      ? "bg-destructive"
      : percentage >= 70
        ? "bg-[hsl(var(--warning))]"
        : leaveBarColors[leaveType];

  const sizeConfig = {
    sm: { bar: "h-1.5", label: "text-xs", detail: "text-xs" },
    md: { bar: "h-2.5", label: "text-sm", detail: "text-sm" },
    lg: { bar: "h-3.5", label: "text-base", detail: "text-base font-medium" },
  };

  const s = sizeConfig[size];

  return (
    <div className="space-y-1.5">
      {/* 上方標籤列 */}
      {showLabel && (
        <div className="flex items-center justify-between">
          <LeaveTypeBadge leaveType={leaveType} size="sm" />
          <span
            className={cn(
              s.detail,
              highlightRemaining ? "font-semibold text-foreground" : "text-muted-foreground"
            )}
          >
            {remainingHours <= 0 ? (
              <span className="text-destructive">已用完</span>
            ) : (
              <>剩餘 {remainingDays} 天</>
            )}
          </span>
        </div>
      )}

      {/* 進度條 */}
      <div className={cn("w-full rounded-full bg-secondary", s.bar)}>
        <div
          className={cn("h-full rounded-full transition-all duration-300", barColor)}
          style={{ width: `${percentage}%` }}
          role="progressbar"
          aria-valuenow={usedHours}
          aria-valuemin={0}
          aria-valuemax={totalHours}
          aria-label={`${leaveType} 額度：已使用 ${usedHours} 小時，共 ${totalHours} 小時`}
        />
      </div>

      {/* 下方詳細資訊 */}
      {showDetails && (
        <div className={cn("flex justify-between", s.detail, "text-muted-foreground")}>
          <span>已用 {usedDays} 天</span>
          <span>總計 {totalDays} 天</span>
        </div>
      )}
    </div>
  );
}
```

## 使用範例

```tsx
// 個人額度總覽 — 完整顯示
<QuotaProgressBar
  leaveType="annual"
  totalHours={80}
  usedHours={16}
  size="lg"
/>

// 請假申請表單 — 精簡提示
<QuotaProgressBar
  leaveType="annual"
  totalHours={80}
  usedHours={16}
  size="sm"
  showDetails={false}
  highlightRemaining
/>

// 額度即將用完
<QuotaProgressBar
  leaveType="personal"
  totalHours={56}
  usedHours={52}
/>

// 額度已用完
<QuotaProgressBar
  leaveType="sick"
  totalHours={240}
  usedHours={240}
/>

// 在列表中批次顯示
{quotas.map((q) => (
  <QuotaProgressBar
    key={q.leave_type}
    leaveType={q.leave_type}
    totalHours={q.total_hours}
    usedHours={q.used_hours}
  />
))}
```

## Accessibility

- 進度條使用 `role="progressbar"` + `aria-valuenow` / `aria-valuemin` / `aria-valuemax`
- `aria-label` 完整描述使用狀況
- 色彩不作為唯一的資訊傳達（同時有數字標示）
- 額度偏低 / 用完時的紅色配合文字提示

## 使用的 shadcn/ui 元件

- `Progress`（作為樣式參考，實際使用自訂 div 以支援假別色）
