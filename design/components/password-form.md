# PasswordForm

## 用途

變更密碼的 Modal 表單。使用者從 Header 選單或 Sidebar 觸發開啟，輸入目前密碼 + 新密碼後送出。基於 shadcn/ui `Dialog` + `react-hook-form` + `zod`。

## Props

| Prop | Type | Default | 說明 |
|------|------|---------|------|
| open | `boolean` | - | 是否開啟 |
| onOpenChange | `(open: boolean) => void` | - | 開關狀態變更 |
| onSubmit | `(data: PasswordFormValues) => Promise<void>` | - | 送出回呼 |

## 表單欄位

| 欄位 | Label | Type | 驗證 |
|------|-------|------|------|
| current_password | 目前密碼 | password | 必填，min 8 |
| new_password | 新密碼 | password | 必填，min 8，不可與目前密碼相同 |
| confirm_password | 確認新密碼 | password | 必填，必須與新密碼一致 |

## Zod Schema

```tsx
const passwordFormSchema = z
  .object({
    current_password: z.string().min(1, "請輸入目前密碼"),
    new_password: z
      .string()
      .min(8, "密碼至少 8 個字元")
      .max(100, "密碼最長 100 個字元"),
    confirm_password: z.string().min(1, "請確認新密碼"),
  })
  .refine((data) => data.new_password === data.confirm_password, {
    message: "新密碼與確認密碼不一致",
    path: ["confirm_password"],
  })
  .refine((data) => data.current_password !== data.new_password, {
    message: "新密碼不可與目前密碼相同",
    path: ["new_password"],
  });

type PasswordFormValues = z.infer<typeof passwordFormSchema>;
```

## 外觀規格

| 部位 | 樣式 |
|------|------|
| Dialog | `max-w-sm`（400px） |
| Title | "變更密碼" |
| Description | "請輸入目前密碼和新密碼" |
| 欄位間距 | `space-y-4` |
| Actions | `flex justify-end gap-2`，取消 + 送出 |

## 範例程式碼

```tsx
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, Loader2 } from "lucide-react";

const passwordFormSchema = z
  .object({
    current_password: z.string().min(1, "請輸入目前密碼"),
    new_password: z
      .string()
      .min(8, "密碼至少 8 個字元")
      .max(100, "密碼最長 100 個字元"),
    confirm_password: z.string().min(1, "請確認新密碼"),
  })
  .refine((data) => data.new_password === data.confirm_password, {
    message: "新密碼與確認密碼不一致",
    path: ["confirm_password"],
  })
  .refine((data) => data.current_password !== data.new_password, {
    message: "新密碼不可與目前密碼相同",
    path: ["new_password"],
  });

type PasswordFormValues = z.infer<typeof passwordFormSchema>;

interface PasswordFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: PasswordFormValues) => Promise<void>;
}

export function PasswordForm({ open, onOpenChange, onSubmit }: PasswordFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: {
      current_password: "",
      new_password: "",
      confirm_password: "",
    },
  });

  const handleSubmit = async (data: PasswordFormValues) => {
    setIsSubmitting(true);
    try {
      await onSubmit(data);
      form.reset();
      onOpenChange(false);
    } catch {
      // API 錯誤由上層處理（toast）
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>變更密碼</DialogTitle>
          <DialogDescription>請輸入目前密碼和新密碼</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <PasswordField
              control={form.control}
              name="current_password"
              label="目前密碼"
              placeholder="請輸入目前密碼"
            />
            <PasswordField
              control={form.control}
              name="new_password"
              label="新密碼"
              placeholder="至少 8 個字元"
            />
            <PasswordField
              control={form.control}
              name="confirm_password"
              label="確認新密碼"
              placeholder="再次輸入新密碼"
            />

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                取消
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                變更密碼
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// 密碼欄位子元件
function PasswordField({
  control,
  name,
  label,
  placeholder,
}: {
  control: any;
  name: string;
  label: string;
  placeholder: string;
}) {
  const [show, setShow] = useState(false);

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <div className="relative">
              <Input
                type={show ? "text" : "password"}
                placeholder={placeholder}
                {...field}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                onClick={() => setShow(!show)}
                tabIndex={-1}
                aria-label={show ? "隱藏密碼" : "顯示密碼"}
              >
                {show ? (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            </div>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
```

## 使用範例

```tsx
const [showPasswordForm, setShowPasswordForm] = useState(false);

async function handleChangePassword(data: PasswordFormValues) {
  await api.put("/auth/password", {
    current_password: data.current_password,
    new_password: data.new_password,
  });
  toast({ title: "密碼變更成功" });
}

<PasswordForm
  open={showPasswordForm}
  onOpenChange={setShowPasswordForm}
  onSubmit={handleChangePassword}
/>
```

## 錯誤處理

| API 錯誤碼 | 前端行為 |
|-----------|---------|
| `INVALID_CREDENTIALS` | Toast 顯示 "目前密碼不正確" |
| `SAME_PASSWORD` | Toast 顯示 "新密碼不可與目前密碼相同" |
| 網路錯誤 | Toast 顯示 "網路錯誤，請稍後再試" |

## Accessibility

- Dialog 自動 trap focus
- 按 Escape 關閉
- 密碼顯示/隱藏按鈕有 `aria-label`
- `tabIndex={-1}` 讓顯示/隱藏按鈕不在 Tab 序列中
- 表單錯誤自動 focus 第一個錯誤欄位
- 送出成功後自動關閉並 reset 表單

## 使用的 shadcn/ui 元件

- `Dialog`
- `Form`（FormField, FormItem, FormLabel, FormControl, FormMessage）
- `Input`
- `Button`
