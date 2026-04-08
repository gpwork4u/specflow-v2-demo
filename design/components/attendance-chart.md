# AttendanceChart

## 用途

出勤率統計圖表元件，支援圓餅圖（Pie）和長條圖（Bar）兩種呈現方式。基於 shadcn/ui 的 `Chart` 元件（Recharts wrapper）實作。用於個人出勤報表、團隊報表和公司報表頁面。

## Props

| Prop | Type | Default | 說明 |
|------|------|---------|------|
| type | `'pie' \| 'bar'` | `'pie'` | 圖表類型 |
| data | `ChartDataItem[]` | - | 圖表資料 |
| title | `string` | - | 圖表標題 |
| description | `string` | - | 圖表說明（選填） |
| height | `number` | `300` | 圖表高度（px） |
| showLegend | `boolean` | `true` | 是否顯示圖例 |

## 子型別

```ts
interface ChartDataItem {
  name: string;         // 分類名稱
  value: number;        // 數值
  color: string;        // CSS 變數名（如 "--chart-present"）
  percentage?: number;  // 百分比（圓餅圖用）
}
```

## Variants

### 圓餅圖（type="pie"）

用於單一指標的組成分析，例如個人出勤天數分布。

```
┌─────────────────────────────────────────┐
│  出勤分布                               │
│  2026 年 4 月                           │
│                                         │
│          ┌────────┐                     │
│         /  正常    \                    │
│        │  20天 91% │                    │
│         \  遲到 2  /                    │
│          └────────┘                     │
│                                         │
│  ■ 正常 20天  ■ 遲到 2天  ■ 請假 2天   │
└─────────────────────────────────────────┘
```

### 長條圖（type="bar"）

用於多項比較，例如部門間出勤率比較。

```
┌─────────────────────────────────────────┐
│  部門出勤率比較                         │
│  2026 年 4 月                           │
│                                         │
│  工程部  ████████████████████  96%      │
│  業務部  █████████████████    92%       │
│  人資部  ██████████████████   94%       │
│  行銷部  ████████████████     90%       │
│                                         │
│          0%   25%   50%   75%  100%     │
└─────────────────────────────────────────┘
```

## 外觀規格

| 部位 | 樣式 |
|------|------|
| 容器 | `rounded-lg border bg-card`，使用 shadcn/ui `Card` |
| 標題 | `text-lg font-semibold`（CardTitle） |
| 說明 | `text-sm text-muted-foreground`（CardDescription） |
| 圖表容器 | `ChartContainer` 搭配 `min-h-[VALUE]` |
| 圓餅圖 | Recharts `PieChart` + `Pie` + `Cell`，內半徑 60%（Donut） |
| 長條圖 | Recharts `BarChart` + `Bar`，水平方向 `layout="vertical"` |
| Tooltip | `ChartTooltip` + `ChartTooltipContent` |
| 圖例 | `ChartLegend` + `ChartLegendContent`，底部排列 |
| 色彩 | 使用 `calendar-colors.css` 的 `--chart-*` token |
| 空狀態 | 中央顯示 "暫無資料"，高度同 height |

## ChartConfig 定義

```ts
import { type ChartConfig } from "@/components/ui/chart";

// 個人出勤分布圖
const personalAttendanceConfig: ChartConfig = {
  present: {
    label: "正常出勤",
    color: "hsl(var(--chart-present))",
  },
  late: {
    label: "遲到",
    color: "hsl(var(--chart-late))",
  },
  early_leave: {
    label: "早退",
    color: "hsl(var(--chart-early-leave))",
  },
  leave: {
    label: "請假",
    color: "hsl(var(--chart-leave))",
  },
  absent: {
    label: "缺席",
    color: "hsl(var(--chart-absent))",
  },
  overtime: {
    label: "加班",
    color: "hsl(var(--chart-overtime))",
  },
};

// 部門出勤率比較（單色漸層或多色）
const departmentConfig: ChartConfig = {
  attendance_rate: {
    label: "出勤率",
    color: "hsl(var(--primary))",
  },
};
```

## 範例程式碼

### 圓餅圖（Donut）

```tsx
"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { PieChart, Pie, Cell, Label } from "recharts";

interface AttendancePieChartProps {
  title: string;
  description?: string;
  data: ChartDataItem[];
  config: ChartConfig;
  centerLabel?: string;
  centerValue?: string | number;
  height?: number;
}

export function AttendancePieChart({
  title,
  description,
  data,
  config,
  centerLabel,
  centerValue,
  height = 300,
}: AttendancePieChartProps) {
  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <div
            className="flex items-center justify-center text-sm text-muted-foreground"
            style={{ height }}
          >
            暫無資料
          </div>
        ) : (
          <ChartContainer config={config} className={`min-h-[${height}px]`}>
            <PieChart>
              <ChartTooltip content={<ChartTooltipContent />} />
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                innerRadius="60%"
                outerRadius="80%"
                paddingAngle={2}
                strokeWidth={2}
                stroke="hsl(var(--background))"
              >
                {data.map((entry, i) => (
                  <Cell
                    key={entry.name}
                    fill={`hsl(var(${entry.color}))`}
                  />
                ))}

                {/* 中央標籤 */}
                {centerLabel && (
                  <Label
                    content={({ viewBox }) => {
                      if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                        return (
                          <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle">
                            <tspan
                              x={viewBox.cx}
                              y={(viewBox.cy || 0) - 8}
                              className="fill-foreground text-3xl font-bold"
                            >
                              {centerValue}
                            </tspan>
                            <tspan
                              x={viewBox.cx}
                              y={(viewBox.cy || 0) + 16}
                              className="fill-muted-foreground text-sm"
                            >
                              {centerLabel}
                            </tspan>
                          </text>
                        );
                      }
                    }}
                  />
                )}
              </Pie>
              <ChartLegend content={<ChartLegendContent />} />
            </PieChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
```

### 長條圖（水平）

```tsx
"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";

interface AttendanceBarChartProps {
  title: string;
  description?: string;
  data: { name: string; value: number; fill?: string }[];
  config: ChartConfig;
  dataKey?: string;
  height?: number;
  layout?: "horizontal" | "vertical";
  unit?: string;
}

export function AttendanceBarChart({
  title,
  description,
  data,
  config,
  dataKey = "value",
  height = 300,
  layout = "vertical",
  unit = "%",
}: AttendanceBarChartProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div
            className="flex items-center justify-center text-sm text-muted-foreground"
            style={{ height }}
          >
            暫無資料
          </div>
        ) : (
          <ChartContainer config={config} className={`min-h-[${height}px]`}>
            <BarChart
              data={data}
              layout={layout}
              margin={{ left: 0, right: 16, top: 8, bottom: 8 }}
            >
              <CartesianGrid
                horizontal={layout === "horizontal"}
                vertical={layout === "vertical"}
                strokeDasharray="3 3"
                className="stroke-border"
              />

              {layout === "vertical" ? (
                <>
                  <YAxis
                    dataKey="name"
                    type="category"
                    width={80}
                    tickLine={false}
                    axisLine={false}
                    className="text-xs"
                  />
                  <XAxis
                    type="number"
                    domain={[0, 100]}
                    tickLine={false}
                    axisLine={false}
                    className="text-xs"
                    tickFormatter={(v) => `${v}${unit}`}
                  />
                </>
              ) : (
                <>
                  <XAxis
                    dataKey="name"
                    tickLine={false}
                    axisLine={false}
                    className="text-xs"
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    className="text-xs"
                    tickFormatter={(v) => `${v}${unit}`}
                  />
                </>
              )}

              <ChartTooltip
                content={<ChartTooltipContent />}
                cursor={{ fill: "hsl(var(--muted))", opacity: 0.5 }}
              />

              <Bar
                dataKey={dataKey}
                radius={[4, 4, 4, 4]}
                fill="hsl(var(--primary))"
                maxBarSize={40}
              />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
```

## 使用範例

```tsx
// 個人出勤分布（圓餅圖）
<AttendancePieChart
  title="出勤分布"
  description="2026 年 4 月"
  centerLabel="出勤天數"
  centerValue={20}
  data={[
    { name: "present", value: 18, color: "--chart-present" },
    { name: "late", value: 2, color: "--chart-late" },
    { name: "leave", value: 2, color: "--chart-leave" },
  ]}
  config={personalAttendanceConfig}
/>

// 請假類型分布（圓餅圖）
<AttendancePieChart
  title="請假類型分布"
  description="2026 年 4 月"
  centerLabel="請假天數"
  centerValue={2}
  data={[
    { name: "annual", value: 1, color: "--leave-annual" },
    { name: "sick", value: 0.5, color: "--leave-sick" },
    { name: "personal", value: 0.5, color: "--leave-personal" },
  ]}
  config={{
    annual: { label: "特休", color: "hsl(var(--leave-annual))" },
    sick: { label: "病假", color: "hsl(var(--leave-sick))" },
    personal: { label: "事假", color: "hsl(var(--leave-personal))" },
  }}
/>

// 部門出勤率比較（水平長條圖）
<AttendanceBarChart
  title="部門出勤率比較"
  description="2026 年 4 月"
  data={[
    { name: "工程部", value: 96 },
    { name: "業務部", value: 92 },
    { name: "人資部", value: 94 },
    { name: "行銷部", value: 90 },
  ]}
  config={{ value: { label: "出勤率", color: "hsl(var(--primary))" } }}
  layout="vertical"
  unit="%"
/>

// 月遲到人次（垂直長條圖，可用於趨勢比較）
<AttendanceBarChart
  title="遲到人次"
  description="近 6 個月"
  data={[
    { name: "11月", value: 8 },
    { name: "12月", value: 5 },
    { name: "1月", value: 12 },
    { name: "2月", value: 6 },
    { name: "3月", value: 5 },
    { name: "4月", value: 3 },
  ]}
  config={{ value: { label: "遲到人次", color: "hsl(var(--chart-late))" } }}
  layout="horizontal"
  unit="人次"
/>
```

## 響應式行為

| 斷點 | 圖表行為 |
|------|---------|
| >= 768px (md) | 完整圖表 + 圖例 |
| < 768px | 圖表高度縮小至 200px，圖例堆疊顯示 |

## Accessibility

- `ChartContainer` 提供 `role="img"` 語意
- Recharts Tooltip 支援鍵盤操作
- 色彩搭配文字標籤，不僅依賴色彩傳遞資訊
- 圖例提供文字標籤 + 色彩方塊
- 空狀態有文字提示
- 圓餅圖中央 Label 提供總計數字

## 使用的 shadcn/ui 元件

- `Card`（CardHeader, CardTitle, CardDescription, CardContent）
- `Chart`（ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent）

## 依賴

- `recharts`（透過 shadcn/ui Chart 元件整合）
