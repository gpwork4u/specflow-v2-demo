# LoadingState

## 用途

載入中的骨架屏和 Spinner 元件。提供頁面級、區塊級和元件級的三種載入狀態。

## 元件

### 1. PageLoader（頁面級）

全頁面載入，用於路由切換或初始資料載入。

```tsx
import { Loader2 } from "lucide-react";

export function PageLoader() {
  return (
    <div className="flex h-[50vh] items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}
```

### 2. Skeleton Patterns（骨架屏）

基於 shadcn/ui 的 `Skeleton` 元件。

#### 表格骨架屏

```tsx
import { Skeleton } from "@/components/ui/skeleton";

export function TableSkeleton({ rows = 5, columns = 5 }) {
  return (
    <div className="space-y-4">
      {/* Toolbar skeleton */}
      <div className="flex gap-2">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-10 w-36" />
        <Skeleton className="h-10 w-36" />
      </div>

      {/* Table skeleton */}
      <div className="rounded-lg border">
        {/* Header */}
        <div className="flex border-b bg-muted/50 p-3">
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton key={i} className="mr-4 h-4 flex-1" />
          ))}
        </div>
        {/* Rows */}
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex border-b p-3 last:border-0">
            {Array.from({ length: columns }).map((_, j) => (
              <Skeleton key={j} className="mr-4 h-4 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
```

#### 表單骨架屏

```tsx
export function FormSkeleton({ fields = 4 }) {
  return (
    <div className="space-y-6">
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
      <div className="flex justify-end gap-2">
        <Skeleton className="h-10 w-20" />
        <Skeleton className="h-10 w-20" />
      </div>
    </div>
  );
}
```

#### Dashboard 統計卡片骨架屏

```tsx
export function StatsCardsSkeleton({ count = 4 }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-lg border p-6">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-5 w-5 rounded" />
          </div>
          <Skeleton className="mt-3 h-8 w-16" />
          <Skeleton className="mt-2 h-3 w-32" />
        </div>
      ))}
    </div>
  );
}
```

#### 打卡頁骨架屏

```tsx
export function ClockSkeleton() {
  return (
    <div className="flex flex-col items-center gap-8">
      <div className="text-center">
        <Skeleton className="mx-auto h-12 w-48" />
        <Skeleton className="mx-auto mt-2 h-6 w-36" />
      </div>
      <Skeleton className="h-48 w-48 rounded-full" />
      <Skeleton className="h-24 w-72 rounded-xl" />
    </div>
  );
}
```

### 3. Button Loading

按鈕的載入狀態，使用 spinner 取代 icon。

```tsx
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

// 載入中的按鈕
<Button disabled>
  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
  處理中...
</Button>
```

## 使用規範

| 情境 | 使用的載入元件 | 說明 |
|------|-------------|------|
| 頁面初次載入 | `PageLoader` | 置中 spinner |
| 表格載入 | `TableSkeleton` | 顯示列骨架 |
| 表單載入 | `FormSkeleton` | 顯示欄位骨架 |
| Dashboard 載入 | `StatsCardsSkeleton` | 卡片骨架 |
| 按鈕提交中 | Button + Loader2 | 按鈕內 spinner |
| 下拉選單載入 | Skeleton in Select | 選項內骨架 |

## Accessibility

- Skeleton 區域使用 `aria-busy="true"` + `aria-label="載入中"`
- Spinner 使用 `role="status"` + 隱藏的 "載入中" 文字
- 載入完成後 focus 移到內容區

## 使用的 shadcn/ui 元件

- `Skeleton`
- `Button`（Loader2 icon）
