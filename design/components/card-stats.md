# CardStats

## 用途

Dashboard 頁面的統計摘要卡片。顯示一個指標數字 + 標題 + 可選的趨勢/描述。基於 shadcn/ui 的 `Card` 元件。

## Props

| Prop | Type | Default | 說明 |
|------|------|---------|------|
| title | `string` | - | 卡片標題 |
| value | `string \| number` | - | 主要數值 |
| description | `string` | - | 描述文字 |
| icon | `LucideIcon` | - | 左側圖示 |
| trend | `{ value: number; label: string }` | - | 趨勢指標（選填） |

## 外觀規格

```
┌─────────────────────────────────┐
│  [Icon]   今日出勤人數           │
│           42                    │
│           較昨日 +3             │
└─────────────────────────────────┘
```

| 部位 | 樣式 |
|------|------|
| 容器 | `rounded-lg border bg-card p-6 shadow-sm` |
| Icon | `h-5 w-5 text-muted-foreground`，右上角 |
| Title | `text-sm font-medium text-muted-foreground` |
| Value | `text-3xl font-bold tracking-tight` |
| Description | `text-xs text-muted-foreground` |
| 趨勢正值 | `text-green-600` |
| 趨勢負值 | `text-red-600` |

## 範例程式碼

```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface CardStatsProps {
  title: string;
  value: string | number;
  description?: string;
  icon: LucideIcon;
  trend?: { value: number; label: string };
}

export function CardStats({ title, value, description, icon: Icon, trend }: CardStatsProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className="h-5 w-5 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold tracking-tight">{value}</div>
        {(description || trend) && (
          <p className="mt-1 text-xs text-muted-foreground">
            {trend && (
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 font-medium",
                  trend.value >= 0 ? "text-green-600" : "text-red-600"
                )}
              >
                {trend.value >= 0 ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                {trend.value >= 0 ? "+" : ""}
                {trend.value}
              </span>
            )}{" "}
            {trend?.label || description}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
```

## 使用範例

```tsx
import { Users, Clock, AlertTriangle, CheckCircle2 } from "lucide-react";

// Dashboard 摘要卡片
<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
  <CardStats
    title="今日出勤"
    value={42}
    icon={Users}
    trend={{ value: 3, label: "較昨日" }}
  />
  <CardStats
    title="準時率"
    value="95%"
    icon={CheckCircle2}
    trend={{ value: 2, label: "較上週" }}
  />
  <CardStats
    title="遲到人數"
    value={2}
    icon={AlertTriangle}
    description="今日"
  />
  <CardStats
    title="平均工時"
    value="8.2h"
    icon={Clock}
    description="本月平均"
  />
</div>
```

## 使用的 shadcn/ui 元件

- `Card`（CardHeader, CardTitle, CardContent）
