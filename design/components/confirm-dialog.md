# ConfirmDialog

## 用途

確認對話框，用於需要使用者確認的操作（刪除部門、停用帳號、重設密碼等）。基於 shadcn/ui 的 `AlertDialog` 元件。

## Props

| Prop | Type | Default | 說明 |
|------|------|---------|------|
| open | `boolean` | - | 是否開啟 |
| onOpenChange | `(open: boolean) => void` | - | 開關狀態變更 |
| title | `string` | - | 對話框標題 |
| description | `string` | - | 描述文字 |
| confirmLabel | `string` | `"確認"` | 確認按鈕文字 |
| cancelLabel | `string` | `"取消"` | 取消按鈕文字 |
| variant | `'default' \| 'destructive'` | `'default'` | 按鈕樣式 |
| onConfirm | `() => void` | - | 確認回呼 |
| isLoading | `boolean` | `false` | 確認按鈕載入狀態 |

## Variants

| Variant | 確認按鈕 | 用途 |
|---------|---------|------|
| `default` | `bg-primary` | 一般確認操作 |
| `destructive` | `bg-destructive` | 刪除、停用等破壞性操作 |

## 外觀規格

| 部位 | 樣式 |
|------|------|
| Overlay | `bg-black/80`，點擊不關閉（需明確操作） |
| Dialog | `max-w-md`，`rounded-lg`，`p-6` |
| Title | `text-lg font-semibold` |
| Description | `text-sm text-muted-foreground`，`mt-2` |
| Actions | `flex justify-end gap-2`，`mt-6` |

## 範例程式碼

```tsx
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { buttonVariants } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "destructive";
  onConfirm: () => void;
  isLoading?: boolean;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "確認",
  cancelLabel = "取消",
  variant = "default",
  onConfirm,
  isLoading = false,
}: ConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isLoading}
            className={cn(
              variant === "destructive" &&
                buttonVariants({ variant: "destructive" })
            )}
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

## 使用範例

```tsx
// 刪除部門
<ConfirmDialog
  open={showDeleteDialog}
  onOpenChange={setShowDeleteDialog}
  title="刪除部門"
  description="確定要刪除「工程部」嗎？此操作無法復原。部門內不可有員工。"
  confirmLabel="刪除"
  variant="destructive"
  onConfirm={handleDelete}
  isLoading={isDeleting}
/>

// 停用帳號
<ConfirmDialog
  open={showDeactivateDialog}
  onOpenChange={setShowDeactivateDialog}
  title="停用帳號"
  description="確定要停用王小明的帳號嗎？停用後該員工將無法登入系統。"
  confirmLabel="停用"
  variant="destructive"
  onConfirm={handleDeactivate}
/>

// 重設密碼
<ConfirmDialog
  open={showResetDialog}
  onOpenChange={setShowResetDialog}
  title="重設密碼"
  description="確定要重設王小明的密碼嗎？系統將產生新的臨時密碼。"
  confirmLabel="重設"
  variant="default"
  onConfirm={handleResetPassword}
/>
```

## Accessibility

- AlertDialog 會自動 trap focus
- 按 Escape 關閉（取消操作）
- 開啟時 focus 移到取消按鈕（安全預設）
- 使用 `AlertDialogTitle` 和 `AlertDialogDescription` 提供語意
- `role="alertdialog"` + `aria-modal="true"`
- 確認按鈕在右側（破壞性操作使用紅色，視覺區分）

## 使用的 shadcn/ui 元件

- `AlertDialog`（含所有子元件）
- `Button`（buttonVariants）
