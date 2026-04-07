# StatusBadge

## 用途

顯示各種狀態標籤的 Badge 元件。支援出勤狀態、帳號狀態、角色標籤三種類型。基於 shadcn/ui 的 `Badge` 元件擴展。

## Props

| Prop | Type | Default | 說明 |
|------|------|---------|------|
| type | `'attendance' \| 'account' \| 'role'` | - | Badge 類型 |
| value | `string` | - | 狀態值 |
| showIcon | `boolean` | `true` | 是否顯示前置圖示 |

## Variants

### 出勤狀態（type="attendance"）

| Value | 標籤文字 | 顏色 | Icon |
|-------|---------|------|------|
| `normal` | 正常 | Green bg + Green text | `CheckCircle2` |
| `late` | 遲到 | Amber bg + Amber text | `Clock` |
| `early_leave` | 早退 | Orange bg + Orange text | `LogOut` |
| `absent` | 缺席 | Red bg + Red text | `XCircle` |
| `amended` | 已補打卡 | Blue bg + Blue text | `FileEdit` |

### 帳號狀態（type="account"）

| Value | 標籤文字 | 顏色 | Icon |
|-------|---------|------|------|
| `active` | 啟用 | Green bg + Green text | `CheckCircle2` |
| `inactive` | 停用 | Gray bg + Gray text | `MinusCircle` |
| `suspended` | 凍結 | Red bg + Red text | `Ban` |

### 角色標籤（type="role"）

| Value | 標籤文字 | 顏色 | Icon |
|-------|---------|------|------|
| `admin` | 管理員 | Purple bg + Purple text | `Shield` |
| `manager` | 主管 | Blue bg + Blue text | `UserCog` |
| `employee` | 員工 | Gray bg + Gray text | `User` |

## 外觀規格

| 部位 | 樣式 |
|------|------|
| 容器 | `inline-flex items-center gap-1 rounded-full px-2.5 py-0.5` |
| 文字 | `text-xs font-medium` |
| Icon | `h-3 w-3` |
| 背景 | 使用對應顏色的淡色版本（opacity 10-15%） |
| 文字色 | 使用對應顏色的深色版本（700） |

## 範例程式碼

```tsx
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  Clock,
  LogOut,
  XCircle,
  FileEdit,
  MinusCircle,
  Ban,
  Shield,
  UserCog,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";

type StatusType = "attendance" | "account" | "role";

interface StatusBadgeProps {
  type: StatusType;
  value: string;
  showIcon?: boolean;
}

const statusConfig = {
  attendance: {
    normal: {
      label: "正常",
      icon: CheckCircle2,
      className: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400",
    },
    late: {
      label: "遲到",
      icon: Clock,
      className: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
    },
    early_leave: {
      label: "早退",
      icon: LogOut,
      className: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400",
    },
    absent: {
      label: "缺席",
      icon: XCircle,
      className: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
    },
    amended: {
      label: "已補打卡",
      icon: FileEdit,
      className: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
    },
  },
  account: {
    active: {
      label: "啟用",
      icon: CheckCircle2,
      className: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400",
    },
    inactive: {
      label: "停用",
      icon: MinusCircle,
      className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
    },
    suspended: {
      label: "凍結",
      icon: Ban,
      className: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
    },
  },
  role: {
    admin: {
      label: "管理員",
      icon: Shield,
      className: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-400",
    },
    manager: {
      label: "主管",
      icon: UserCog,
      className: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
    },
    employee: {
      label: "員工",
      icon: User,
      className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
    },
  },
} as const;

export function StatusBadge({ type, value, showIcon = true }: StatusBadgeProps) {
  const config = statusConfig[type]?.[value as keyof (typeof statusConfig)[typeof type]];

  if (!config) return null;

  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        config.className
      )}
    >
      {showIcon && <Icon className="h-3 w-3" />}
      {config.label}
    </span>
  );
}
```

## 使用範例

```tsx
// 出勤狀態
<StatusBadge type="attendance" value="normal" />    // [v] 正常
<StatusBadge type="attendance" value="late" />       // [!] 遲到
<StatusBadge type="attendance" value="absent" />     // [x] 缺席

// 帳號狀態
<StatusBadge type="account" value="active" />        // [v] 啟用
<StatusBadge type="account" value="suspended" />     // [x] 凍結

// 角色
<StatusBadge type="role" value="admin" />            // [盾] 管理員
<StatusBadge type="role" value="manager" />          // [齒] 主管

// 不顯示 icon
<StatusBadge type="attendance" value="late" showIcon={false} />
```

## Accessibility

- 使用 `<span>` 而非 `<div>`，語意正確為 inline 元素
- Icon 為裝飾性（`aria-hidden="true"`，lucide-react 預設）
- 文字標籤提供足夠語意，不需額外 aria-label
- 色彩對比度符合 WCAG 2.1 AA（文字色 vs 背景色對比 >= 4.5:1）
- Dark mode 下使用更深背景 + 更亮文字確保對比度

## 使用的 shadcn/ui 元件

- `Badge`（作為樣式參考，實際使用自訂 `<span>`）
