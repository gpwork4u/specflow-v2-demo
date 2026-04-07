# 登入頁

## 對應 Feature

#6 F-000: 認證系統

## Layout

```
┌──────────────────────────────────────────────────┐
│                                                  │
│                                                  │
│              ┌──────────────────┐                │
│              │  [Clock Icon]    │                │
│              │  HR 工時管理系統  │                │
│              │                  │                │
│              │  ┌────────────┐  │                │
│              │  │ Email      │  │                │
│              │  └────────────┘  │                │
│              │  ┌────────────┐  │                │
│              │  │ Password 👁│  │                │
│              │  └────────────┘  │                │
│              │                  │                │
│              │  [    登入    ]  │                │
│              │                  │                │
│              │  ⚠ 錯誤訊息     │                │
│              └──────────────────┘                │
│                                                  │
└──────────────────────────────────────────────────┘
```

不使用 AppLayout。登入頁為獨立的全頁面。

## 頁面規格

| 項目 | 說明 |
|------|------|
| 路由 | `/login` |
| 認證 | 不需要（公開頁面） |
| 背景 | `bg-muted`，整頁高度 `min-h-screen` |
| 卡片 | 置中，`max-w-sm`（400px），白色背景，`shadow-md rounded-xl p-8` |
| Logo 區域 | Clock icon + 系統名稱，置中，`mb-8` |

## 使用的元件

| 元件 | 來源 | 說明 |
|------|------|------|
| Card | shadcn/ui | 登入卡片容器 |
| Input | shadcn/ui | Email 輸入框 |
| PasswordInput | `components/form-field` | 密碼輸入框（含顯示/隱藏） |
| Button | shadcn/ui | 登入按鈕 |
| Form | react-hook-form + zod | 表單驗證 |
| Toast | shadcn/ui | 錯誤提示 |

## 互動行為

### 登入流程

1. 使用者輸入 email + password
2. 點擊「登入」或按 Enter 送出
3. 按鈕進入 loading 狀態（顯示 spinner + "登入中..."）
4. 成功：導向 `/`（Dashboard）
5. 失敗：根據錯誤碼顯示對應訊息

### 錯誤處理

| API 錯誤碼 | 前端顯示 |
|-----------|---------|
| `INVALID_INPUT` | 表單欄位驗證（即時，不打 API） |
| `INVALID_CREDENTIALS` | 在表單下方顯示 "Email 或密碼不正確" |
| `ACCOUNT_SUSPENDED` | 在表單下方顯示 "帳號已停用，請聯繫管理員" |
| `ACCOUNT_LOCKED` | 在表單下方顯示 "帳號已鎖定，請 15 分鐘後再試" |
| 網路錯誤 | Toast 顯示 "無法連線到伺服器" |

### 表單驗證

| 欄位 | 即時驗證 | blur 驗證 |
|------|---------|----------|
| Email | - | 格式檢查 |
| Password | - | 不為空 |

## 範例程式碼

```tsx
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Clock, Loader2, Eye, EyeOff, AlertCircle } from "lucide-react";

const loginSchema = z.object({
  email: z.string().min(1, "請輸入 Email").email("Email 格式不正確"),
  password: z.string().min(1, "請輸入密碼"),
});

type LoginValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(data: LoginValues) {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = await res.json();
        const messages: Record<string, string> = {
          INVALID_CREDENTIALS: "Email 或密碼不正確",
          ACCOUNT_SUSPENDED: "帳號已停用，請聯繫管理員",
          ACCOUNT_LOCKED: "帳號已鎖定，請 15 分鐘後再試",
        };
        setError(messages[body.code] || "登入失敗，請稍後再試");
        return;
      }
      // 儲存 token，導向 Dashboard
      const { access_token, refresh_token } = await res.json();
      // ... store tokens and redirect
    } catch {
      setError("無法連線到伺服器，請檢查網路連線");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted p-4">
      <Card className="w-full max-w-sm shadow-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
            <Clock className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold">HR 工時管理系統</h1>
          <p className="text-sm text-muted-foreground">請登入您的帳號</p>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="your@company.com"
                        autoComplete="email"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>密碼</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="請輸入密碼"
                          autoComplete="current-password"
                          {...field}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                          onClick={() => setShowPassword(!showPassword)}
                          tabIndex={-1}
                          aria-label={showPassword ? "隱藏密碼" : "顯示密碼"}
                        >
                          {showPassword ? (
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

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    登入中...
                  </>
                ) : (
                  "登入"
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
```

## 響應式行為

| 斷點 | 變化 |
|------|------|
| >= 640px | 卡片 400px 置中 |
| < 640px | 卡片 full width，左右 padding 16px |

## Accessibility

- 表單使用語意化 `<form>` + label 關聯
- Email 欄位有 `autoComplete="email"`
- Password 欄位有 `autoComplete="current-password"`
- 錯誤訊息使用 `Alert` + `role="alert"`
- Enter 鍵送出表單
- Tab 順序：Email -> Password -> 顯示/隱藏 -> 登入按鈕
