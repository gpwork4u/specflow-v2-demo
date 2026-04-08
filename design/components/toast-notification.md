# Toast / Notification

## 用途

全域的通知提示元件，用於操作回饋（成功、失敗、警告、資訊）。基於 shadcn/ui 的 `Toast` 元件（使用 Radix UI Toast primitive）。

## Variants

| Variant | 外觀 | Icon | 用途範例 |
|---------|------|------|---------|
| `default` | 白色背景 + 深色文字 | `Info` | 一般資訊提示 |
| `success` | 綠色左邊框 | `CheckCircle2` | 操作成功 |
| `destructive` | 紅色背景 | `XCircle` | 操作失敗 |
| `warning` | 橙色左邊框 | `AlertTriangle` | 警告提示 |

## Toast 函式介面

```ts
// shadcn/ui 的 useToast hook
const { toast } = useToast();

// 基礎用法
toast({
  title: "操作成功",
  description: "員工資料已更新",
  variant: "default",
});

// 封裝後的便捷函式
function showSuccess(title: string, description?: string);
function showError(title: string, description?: string);
function showWarning(title: string, description?: string);
function showInfo(title: string, description?: string);
```

## 外觀規格

| 部位 | 樣式 |
|------|------|
| 位置 | 右下角（`bottom-right`），距離邊框 16px |
| 容器 | `rounded-lg border p-4 shadow-lg`，最大寬度 420px |
| Title | `text-sm font-semibold` |
| Description | `text-sm text-muted-foreground` |
| 關閉按鈕 | 右上角 X icon |
| 自動消失 | 5 秒後自動關閉 |
| 動畫 | 從右側滑入，淡出消失 |

## 範例程式碼

### Toaster 元件（放在 layout 中）

```tsx
// app/layout.tsx 或 providers.tsx
import { Toaster } from "@/components/ui/toaster";

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
```

### Toast 便捷函式

```tsx
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, XCircle, AlertTriangle, Info } from "lucide-react";

export function useNotification() {
  const { toast } = useToast();

  return {
    success: (title: string, description?: string) =>
      toast({
        title: (
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            {title}
          </div>
        ),
        description,
      }),

    error: (title: string, description?: string) =>
      toast({
        title: (
          <div className="flex items-center gap-2">
            <XCircle className="h-4 w-4" />
            {title}
          </div>
        ),
        description,
        variant: "destructive",
      }),

    warning: (title: string, description?: string) =>
      toast({
        title: (
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            {title}
          </div>
        ),
        description,
      }),

    info: (title: string, description?: string) =>
      toast({
        title: (
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-blue-600" />
            {title}
          </div>
        ),
        description,
      }),
  };
}
```

### 使用範例

```tsx
const { success, error } = useNotification();

// 登入成功
success("登入成功", "歡迎回來，王小明");

// 登入失敗
error("登入失敗", "Email 或密碼不正確");

// 員工建立成功
success("新增成功", "員工 EMP001 已建立");

// 刪除部門失敗
error("刪除失敗", "部門仍有員工，無法刪除");

// 打卡成功
success("上班打卡成功", "打卡時間 09:00:15");

// 網路錯誤
error("網路錯誤", "無法連線到伺服器，請稍後再試");

// 離線警告
warning("離線模式", "目前無網路連線，部分功能可能無法使用");

// 密碼即將過期
info("密碼提醒", "您的密碼將於 7 天後過期，請盡快變更");
```

## Accessibility

- Toast 使用 `role="status"` + `aria-live="polite"`（非緊急通知）
- Destructive toast 使用 `aria-live="assertive"`（錯誤需立即注意）
- 關閉按鈕有 `aria-label="關閉通知"`
- 自動消失前可被 hover 暫停
- 支援 keyboard dismiss（Escape）
- 通知堆疊時最多顯示 3 個，超過排隊等待

## 使用的 shadcn/ui 元件

- `Toast`（Toaster, ToastProvider, ToastViewport）
- `useToast` hook
