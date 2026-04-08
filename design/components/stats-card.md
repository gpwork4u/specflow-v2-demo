# StatsCard

## 用途

報表統計卡片，用於出勤報表頁面顯示關鍵指標。相較於 Sprint 1 的 `CardStats`（Dashboard 用），StatsCard 增加了環形進度、大數字強調、及可選的迷你圖表。用於個人/團隊/公司報表頁面的摘要區。

## 與 CardStats 的差異

| 項目 | CardStats（Sprint 1） | StatsCard（Sprint 3） |
|------|---------------------|---------------------|
| 用途 | Dashboard 快覽 | 報表頁深度指標 |
| 主數字 | `text-3xl` | `text-4xl`（Display） |
| 進度環 | 無 | 可選（用於百分比指標） |
| 副標題 | 描述文字 | 子指標列表 |
| 趨勢 | 簡單 +/- 數字 | 與上月比較百分比 |

## Props

| Prop | Type | Default | 說明 |
|------|------|---------|------|
| title | `string` | - | 卡片標題 |
| value | `string \| number` | - | 主要數值 |
| unit | `string` | - | 數值單位（如 "%"、"天"、"小時"） |
| icon | `LucideIcon` | - | 圖示 |
| variant | `'default' \| 'success' \| 'warning' \| 'danger'` | `'default'` | 色彩變體 |
| progress | `number` | - | 環形進度值 0-100（選填） |
| comparison | `{ value: number; label: string }` | - | 與上期比較（選填） |
| subItems | `{ label: string; value: string \| number }[]` | - | 子指標列表（選填） |

## Variants

| Variant | Icon 色 | 進度環色 | 使用場景 |
|---------|--------|---------|---------|
| default | `text-primary` | `stroke-primary` | 一般指標 |
| success | `text-[hsl(var(--success))]` | `stroke-[hsl(var(--success))]` | 出勤率高 |
| warning | `text-[hsl(var(--warning))]` | `stroke-[hsl(var(--warning))]` | 需注意 |
| danger | `text-destructive` | `stroke-destructive` | 異常值 |

## Layout

```
┌─────────────────────────────────────────┐
│  [Icon]  出勤率                  [環形] │
│                                  95.5%  │
│  95.5%                                  │
│  ~~~~~~~~                               │
│  +2.3% 較上月                           │
│  ─────────────────                      │
│  出勤天數: 20    遲到: 2                │
│  請假天數: 2     加班: 8h               │
└─────────────────────────────────────────┘
```

### 無進度環版本

```
┌─────────────────────────────────┐
│  [Icon]  遲到次數               │
│                                 │
│  5 次                           │
│  ~~~~~~~~                       │
│  -2 較上月                      │
└─────────────────────────────────┘
```

## 外觀規格

| 部位 | 樣式 |
|------|------|
| 容器 | `rounded-lg border bg-card p-6 shadow-sm` |
| Header | `flex items-center justify-between mb-4` |
| Title | `text-sm font-medium text-muted-foreground` |
| Icon | `h-5 w-5`，顏色依 variant |
| 主數字 | `text-4xl font-bold tracking-tight` |
| 單位 | `text-lg font-medium text-muted-foreground ml-1` |
| 比較 — 正值 | `text-xs font-medium text-[hsl(var(--success))]`，`TrendingUp icon` |
| 比較 — 負值 | `text-xs font-medium text-destructive`，`TrendingDown icon` |
| 比較 label | `text-xs text-muted-foreground` |
| 分隔線 | `border-t mt-3 pt-3` |
| 子指標 | `grid grid-cols-2 gap-2 text-sm` |
| 子指標 label | `text-muted-foreground` |
| 子指標 value | `font-medium text-right` |
| 進度環 | SVG 圓環 `w-16 h-16`，底色 `stroke-muted`，進度色依 variant |

## 範例程式碼

```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatsCardProps {
  title: string;
  value: string | number;
  unit?: string;
  icon: LucideIcon;
  variant?: "default" | "success" | "warning" | "danger";
  progress?: number;
  comparison?: { value: number; label: string };
  subItems?: { label: string; value: string | number }[];
}

const variantStyles = {
  default: { icon: "text-primary", ring: "stroke-primary" },
  success: { icon: "text-[hsl(var(--success))]", ring: "stroke-[hsl(var(--success))]" },
  warning: { icon: "text-[hsl(var(--warning))]", ring: "stroke-[hsl(var(--warning))]" },
  danger: { icon: "text-destructive", ring: "stroke-destructive" },
};

// 環形進度元件
function ProgressRing({
  value,
  size = 64,
  strokeWidth = 6,
  className,
}: {
  value: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (value / 100) * circumference;

  return (
    <svg
      width={size}
      height={size}
      className="rotate-[-90deg]"
      role="img"
      aria-label={`${value}%`}
    >
      {/* 背景環 */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        className="stroke-muted"
        strokeWidth={strokeWidth}
      />
      {/* 進度環 */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        className={cn("transition-all duration-500", className)}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
      />
    </svg>
  );
}

export function StatsCard({
  title,
  value,
  unit,
  icon: Icon,
  variant = "default",
  progress,
  comparison,
  subItems,
}: StatsCardProps) {
  const styles = variantStyles[variant];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-2">
          <Icon className={cn("h-5 w-5", styles.icon)} />
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {title}
          </CardTitle>
        </div>
        {progress !== undefined && (
          <div className="relative flex items-center justify-center">
            <ProgressRing value={progress} className={styles.ring} />
            <span className="absolute text-xs font-semibold">
              {Math.round(progress)}%
            </span>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {/* 主數字 */}
        <div className="flex items-baseline">
          <span className="text-4xl font-bold tracking-tight">{value}</span>
          {unit && (
            <span className="ml-1 text-lg font-medium text-muted-foreground">
              {unit}
            </span>
          )}
        </div>

        {/* 比較 */}
        {comparison && (
          <div className="mt-1 flex items-center gap-1">
            <span
              className={cn(
                "inline-flex items-center gap-0.5 text-xs font-medium",
                comparison.value >= 0
                  ? "text-[hsl(var(--success))]"
                  : "text-destructive"
              )}
            >
              {comparison.value >= 0 ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              {comparison.value >= 0 ? "+" : ""}
              {comparison.value}%
            </span>
            <span className="text-xs text-muted-foreground">
              {comparison.label}
            </span>
          </div>
        )}

        {/* 子指標 */}
        {subItems && subItems.length > 0 && (
          <>
            <Separator className="my-3" />
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              {subItems.map((item) => (
                <div key={item.label} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{item.label}</span>
                  <span className="font-medium">{item.value}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
```

## 使用範例

```tsx
import {
  CalendarCheck,
  Clock,
  AlertTriangle,
  TrendingUp,
  Timer,
} from "lucide-react";

// 個人報表 — 出勤率卡片（含進度環）
<StatsCard
  title="出勤率"
  value="95.5"
  unit="%"
  icon={CalendarCheck}
  variant="success"
  progress={95.5}
  comparison={{ value: 2.3, label: "較上月" }}
  subItems={[
    { label: "出勤天數", value: 20 },
    { label: "工作日", value: 22 },
  ]}
/>

// 個人報表 — 遲到卡片
<StatsCard
  title="遲到次數"
  value={2}
  unit="次"
  icon={AlertTriangle}
  variant="warning"
  comparison={{ value: -1, label: "較上月" }}
/>

// 團隊報表 — 平均出勤率
<StatsCard
  title="團隊平均出勤率"
  value="94.2"
  unit="%"
  icon={TrendingUp}
  variant="success"
  progress={94.2}
  subItems={[
    { label: "總人數", value: 10 },
    { label: "遲到人次", value: 5 },
    { label: "請假天數", value: 12 },
    { label: "加班時數", value: "24h" },
  ]}
/>

// 報表摘要區 Layout
<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
  <StatsCard ... />
  <StatsCard ... />
  <StatsCard ... />
  <StatsCard ... />
</div>
```

## Accessibility

- 進度環使用 `role="img"` + `aria-label` 提供百分比文字
- 趨勢 icon 為裝飾性（lucide-react 預設 `aria-hidden="true"`）
- 文字色彩對比度符合 WCAG 2.1 AA
- Card 語意結構清晰（CardHeader + CardContent）

## 使用的 shadcn/ui 元件

- `Card`（CardHeader, CardTitle, CardContent）
- `Separator`
