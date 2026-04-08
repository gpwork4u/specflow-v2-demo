# LeaveTypeBadge

## 用途

顯示假別類型的 Badge 元件，每種假別有獨立的辨識色。與 `StatusBadge` 同級但專門用於假別標示。基於 shadcn/ui 的 `Badge` 樣式擴展。

## Props

| Prop | Type | Default | 說明 |
|------|------|---------|------|
| leaveType | `LeaveType` | - | 假別代碼 |
| showIcon | `boolean` | `true` | 是否顯示前置圖示 |
| size | `'sm' \| 'md'` | `'sm'` | Badge 大小 |

### LeaveType

```ts
type LeaveType =
  | "annual"       // 特休
  | "personal"     // 事假
  | "sick"         // 病假
  | "marriage"     // 婚假
  | "bereavement"  // 喪假
  | "maternity"    // 產假
  | "paternity"    // 陪產假
  | "official";    // 公假
```

## Variants

| LeaveType | 標籤文字 | 顏色 Token | Icon |
|-----------|---------|-----------|------|
| `annual` | 特休 | `--leave-annual-*` (Blue) | `Palmtree` |
| `personal` | 事假 | `--leave-personal-*` (Orange) | `Briefcase` |
| `sick` | 病假 | `--leave-sick-*` (Red) | `Thermometer` |
| `marriage` | 婚假 | `--leave-marriage-*` (Pink) | `Heart` |
| `bereavement` | 喪假 | `--leave-bereavement-*` (Slate) | `CloudRain` |
| `maternity` | 產假 | `--leave-maternity-*` (Purple) | `Baby` |
| `paternity` | 陪產假 | `--leave-paternity-*` (Indigo) | `Baby` |
| `official` | 公假 | `--leave-official-*` (Teal) | `Building` |

## Sizes

| Size | Padding | Font | Icon Size |
|------|---------|------|-----------|
| `sm` | `px-2 py-0.5` | `text-xs` | `h-3 w-3` |
| `md` | `px-2.5 py-1` | `text-sm` | `h-3.5 w-3.5` |

## 外觀規格

| 部位 | 樣式 |
|------|------|
| 容器 | `inline-flex items-center gap-1 rounded-full font-medium` |
| 背景 | 使用 `--leave-{type}-bg` token |
| 文字色 | 使用 `--leave-{type}-text` token |

## 範例程式碼

```tsx
import {
  Palmtree,
  Briefcase,
  Thermometer,
  Heart,
  CloudRain,
  Baby,
  Building,
} from "lucide-react";
import { cn } from "@/lib/utils";

type LeaveType =
  | "annual" | "personal" | "sick" | "marriage"
  | "bereavement" | "maternity" | "paternity" | "official";

interface LeaveTypeBadgeProps {
  leaveType: LeaveType;
  showIcon?: boolean;
  size?: "sm" | "md";
}

const leaveTypeConfig: Record<
  LeaveType,
  { label: string; icon: React.ElementType; className: string }
> = {
  annual: {
    label: "特休",
    icon: Palmtree,
    className: "bg-[hsl(var(--leave-annual-bg))] text-[hsl(var(--leave-annual-text))]",
  },
  personal: {
    label: "事假",
    icon: Briefcase,
    className: "bg-[hsl(var(--leave-personal-bg))] text-[hsl(var(--leave-personal-text))]",
  },
  sick: {
    label: "病假",
    icon: Thermometer,
    className: "bg-[hsl(var(--leave-sick-bg))] text-[hsl(var(--leave-sick-text))]",
  },
  marriage: {
    label: "婚假",
    icon: Heart,
    className: "bg-[hsl(var(--leave-marriage-bg))] text-[hsl(var(--leave-marriage-text))]",
  },
  bereavement: {
    label: "喪假",
    icon: CloudRain,
    className: "bg-[hsl(var(--leave-bereavement-bg))] text-[hsl(var(--leave-bereavement-text))]",
  },
  maternity: {
    label: "產假",
    icon: Baby,
    className: "bg-[hsl(var(--leave-maternity-bg))] text-[hsl(var(--leave-maternity-text))]",
  },
  paternity: {
    label: "陪產假",
    icon: Baby,
    className: "bg-[hsl(var(--leave-paternity-bg))] text-[hsl(var(--leave-paternity-text))]",
  },
  official: {
    label: "公假",
    icon: Building,
    className: "bg-[hsl(var(--leave-official-bg))] text-[hsl(var(--leave-official-text))]",
  },
};

export function LeaveTypeBadge({
  leaveType,
  showIcon = true,
  size = "sm",
}: LeaveTypeBadgeProps) {
  const config = leaveTypeConfig[leaveType];
  if (!config) return null;

  const Icon = config.icon;
  const sizeClasses = size === "sm"
    ? "px-2 py-0.5 text-xs"
    : "px-2.5 py-1 text-sm";
  const iconClasses = size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-medium",
        sizeClasses,
        config.className
      )}
    >
      {showIcon && <Icon className={iconClasses} />}
      {config.label}
    </span>
  );
}
```

## 使用範例

```tsx
// 基本用法
<LeaveTypeBadge leaveType="annual" />      // [棕] 特休
<LeaveTypeBadge leaveType="sick" />        // [溫] 病假
<LeaveTypeBadge leaveType="personal" />    // [箱] 事假

// 中型
<LeaveTypeBadge leaveType="annual" size="md" />

// 不顯示 icon
<LeaveTypeBadge leaveType="marriage" showIcon={false} />

// 在表格中使用
<TableCell>
  <LeaveTypeBadge leaveType={row.leave_type} />
</TableCell>
```

## Accessibility

- 使用 `<span>` 語意為 inline 元素
- Icon 為裝飾性（`aria-hidden="true"`，lucide-react 預設）
- 文字標籤提供足夠語意
- 色彩對比度符合 WCAG 2.1 AA（文字色 700 vs 淡色背景 >= 4.5:1）
- Dark mode 使用深色背景 + 亮色文字確保對比度

## 色彩 Token

定義於 `design/tokens/leave-colors.css`。

## 使用的 shadcn/ui 元件

- 無直接依賴（自訂 `<span>`）
- 參考 `Badge` 的樣式規範
