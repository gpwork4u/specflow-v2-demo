# SearchFilter

## 用途

搜尋框 + 篩選器的組合元件，用於列表頁面的資料過濾。支援文字搜尋 + 多個下拉篩選條件。用於員工列表、打卡紀錄列表等。

## Props

| Prop | Type | Default | 說明 |
|------|------|---------|------|
| searchValue | `string` | `""` | 搜尋文字 |
| onSearchChange | `(value: string) => void` | - | 搜尋變更回呼 |
| searchPlaceholder | `string` | `"搜尋..."` | 搜尋框 placeholder |
| filters | `FilterConfig[]` | `[]` | 篩選器設定 |
| filterValues | `Record<string, string>` | `{}` | 當前篩選值 |
| onFilterChange | `(key: string, value: string) => void` | - | 篩選變更回呼 |
| onReset | `() => void` | - | 重置所有篩選 |

## 子型別

```ts
interface FilterConfig {
  key: string;                           // 篩選欄位 key
  label: string;                         // 顯示標籤
  placeholder: string;                   // 預設文字
  options: { label: string; value: string }[];  // 選項
}
```

## 外觀規格

```
┌─────────────────────────────────────────────────────────┐
│ [🔍 搜尋員工...]  [部門 ▼]  [角色 ▼]  [狀態 ▼]  [重置] │
└─────────────────────────────────────────────────────────┘
```

| 部位 | 樣式 |
|------|------|
| 容器 | `flex flex-wrap items-center gap-2` |
| 搜尋框 | `w-full sm:w-64`，左側 Search icon |
| 篩選 Select | `w-full sm:w-36`，有 placeholder |
| 重置按鈕 | `variant="ghost" size="sm"`，僅在有篩選條件時顯示 |
| 活躍篩選指示 | Select trigger 內文字為非 placeholder 色 |

## 範例程式碼

```tsx
"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, X } from "lucide-react";

interface FilterConfig {
  key: string;
  label: string;
  placeholder: string;
  options: { label: string; value: string }[];
}

interface SearchFilterProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  filters?: FilterConfig[];
  filterValues?: Record<string, string>;
  onFilterChange?: (key: string, value: string) => void;
  onReset?: () => void;
}

export function SearchFilter({
  searchValue,
  onSearchChange,
  searchPlaceholder = "搜尋...",
  filters = [],
  filterValues = {},
  onFilterChange,
  onReset,
}: SearchFilterProps) {
  const hasActiveFilters =
    searchValue || Object.values(filterValues).some((v) => v && v !== "all");

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* 搜尋框 */}
      <div className="relative w-full sm:w-64">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={searchPlaceholder}
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* 篩選器 */}
      {filters.map((filter) => (
        <Select
          key={filter.key}
          value={filterValues[filter.key] || "all"}
          onValueChange={(value) => onFilterChange?.(filter.key, value)}
        >
          <SelectTrigger className="w-full sm:w-36">
            <SelectValue placeholder={filter.placeholder} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{filter.placeholder}</SelectItem>
            {filter.options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ))}

      {/* 重置按鈕 */}
      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={onReset} className="h-10 px-2">
          <X className="mr-1 h-4 w-4" />
          重置
        </Button>
      )}
    </div>
  );
}
```

## 使用範例

### 員工列表篩選

```tsx
const employeeFilters: FilterConfig[] = [
  {
    key: "department_id",
    label: "部門",
    placeholder: "所有部門",
    options: departments.map((d) => ({ label: d.name, value: d.id })),
  },
  {
    key: "role",
    label: "角色",
    placeholder: "所有角色",
    options: [
      { label: "員工", value: "employee" },
      { label: "主管", value: "manager" },
      { label: "管理員", value: "admin" },
    ],
  },
  {
    key: "status",
    label: "狀態",
    placeholder: "所有狀態",
    options: [
      { label: "啟用", value: "active" },
      { label: "停用", value: "inactive" },
      { label: "凍結", value: "suspended" },
    ],
  },
];

<SearchFilter
  searchValue={search}
  onSearchChange={setSearch}
  searchPlaceholder="搜尋員工姓名、編號、Email..."
  filters={employeeFilters}
  filterValues={filters}
  onFilterChange={(key, value) => setFilters((prev) => ({ ...prev, [key]: value }))}
  onReset={() => {
    setSearch("");
    setFilters({});
  }}
/>
```

### 打卡紀錄篩選（含月份選擇）

```tsx
const clockFilters: FilterConfig[] = [
  {
    key: "status",
    label: "出勤狀態",
    placeholder: "所有狀態",
    options: [
      { label: "正常", value: "normal" },
      { label: "遲到", value: "late" },
      { label: "早退", value: "early_leave" },
      { label: "缺席", value: "absent" },
    ],
  },
];

<SearchFilter
  searchValue=""
  onSearchChange={() => {}}
  filters={clockFilters}
  filterValues={filters}
  onFilterChange={handleFilterChange}
  onReset={handleReset}
/>
```

## 響應式行為

| 斷點 | Layout |
|------|--------|
| >= 640px (sm) | 一行排列，搜尋框 256px，篩選各 144px |
| < 640px | 堆疊排列，全部 full width |

## Accessibility

- 搜尋框有明確的 placeholder 文字
- Select 使用 Radix UI，天然支援 keyboard navigation
- 重置按鈕在無篩選時不顯示（減少干擾）
- 搜尋框左側 icon 為裝飾性（`aria-hidden`）

## 使用的 shadcn/ui 元件

- `Input`
- `Select`
- `Button`
