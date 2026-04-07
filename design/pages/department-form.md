# 部門新增/編輯表單

## 對應 Feature

#7 F-008: 員工/部門管理

## Layout

使用 Dialog，從部門列表頁觸發。

```
┌─────────────── Dialog ──────────────────┐
│ [X]                                     │
│ 新增部門 / 編輯部門                       │
│ 填寫部門基本資料                          │
│                                         │
│ 部門名稱 *                               │
│ [________________________]               │
│                                         │
│ 部門代碼 *                               │
│ [________________________]               │
│ 僅允許英數字和連字號                       │
│                                         │
│ 部門主管                                 │
│ [搜尋主管... ▼]                          │
│ 選填，僅限 manager 角色                   │
│                                         │
│ 上級部門                                 │
│ [請選擇上級部門 ▼]                        │
│ 選填，最多 3 層                           │
│                                         │
│                    [取消]  [儲存]        │
└─────────────────────────────────────────┘
```

## 頁面規格

| 項目 | 說明 |
|------|------|
| 觸發方式 | 部門列表的「新增部門」按鈕 / 卡片操作「編輯」 |
| 容器 | `Dialog`，`max-w-md`（448px） |
| 認證 | 需要（role: admin） |

## 使用的元件

| 元件 | 來源 | 用途 |
|------|------|------|
| Dialog | shadcn/ui | 容器 |
| Form | react-hook-form + zod | 表單驗證 |
| Input | shadcn/ui | 名稱、代碼 |
| Combobox | shadcn/ui (Popover + Command) | 主管選擇 |
| Select | shadcn/ui | 上級部門選擇 |
| Button | shadcn/ui | 送出/取消 |

## 表單欄位

| 欄位 | Label | Type | 必填 | 新增 | 編輯 | 驗證 |
|------|-------|------|------|------|------|------|
| name | 部門名稱 | text | 是 | 可編輯 | 可編輯 | max 100, unique |
| code | 部門代碼 | text | 是 | 可編輯 | 唯讀 | max 20, unique, alphanumeric+hyphen |
| manager_id | 部門主管 | combobox | 否 | 可選 | 可選 | role=manager |
| parent_id | 上級部門 | select | 否 | 可選 | 可選 | valid dept, max 3 layers |

## 範例程式碼

```tsx
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { departmentFormSchema, type DepartmentFormValues } from "@/lib/schemas";

interface DepartmentFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  defaultValues?: Partial<DepartmentFormValues>;
  departments: { id: string; name: string }[];  // 可選的上級部門
  managers: { id: string; name: string }[];
  onSubmit: (data: DepartmentFormValues) => Promise<void>;
}

export function DepartmentForm({
  open,
  onOpenChange,
  mode,
  defaultValues,
  departments,
  managers,
  onSubmit,
}: DepartmentFormProps) {
  const form = useForm<DepartmentFormValues>({
    resolver: zodResolver(departmentFormSchema),
    defaultValues: defaultValues || {
      name: "",
      code: "",
      manager_id: "",
      parent_id: "",
    },
  });

  const isSubmitting = form.formState.isSubmitting;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "新增部門" : "編輯部門"}
          </DialogTitle>
          <DialogDescription>填寫部門基本資料</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>部門名稱 *</FormLabel>
                  <FormControl>
                    <Input placeholder="例：工程部" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>部門代碼 *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="例：ENG"
                      className="font-mono uppercase"
                      disabled={mode === "edit"}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>僅允許英數字和連字號</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 部門主管（Combobox） */}
            <FormField
              control={form.control}
              name="manager_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>部門主管</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="請選擇主管（選填）" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="">不指定</SelectItem>
                      {managers.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>選填，僅限 manager 角色</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 上級部門 */}
            <FormField
              control={form.control}
              name="parent_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>上級部門</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="請選擇上級部門（選填）" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="">無上級部門</SelectItem>
                      {departments.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>選填，部門最多 3 層</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
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
                {mode === "create" ? "新增" : "儲存"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
```

## 錯誤處理

| API 錯誤碼 | 前端行為 |
|-----------|---------|
| `DUPLICATE_NAME` | 表單 name 欄位顯示 "部門名稱已存在" |
| `DUPLICATE_CODE` | 表單 code 欄位顯示 "部門代碼已存在" |
| `INVALID_INPUT` | 對應欄位顯示錯誤 |

## 互動行為

- 編輯模式下 code 欄位唯讀（`disabled`）
- 上級部門不可選擇自己或自己的子部門（避免循環）
- 主管下拉只顯示 `role=manager` 的使用者
