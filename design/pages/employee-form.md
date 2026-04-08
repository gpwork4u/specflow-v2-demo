# 員工新增/編輯表單

## 對應 Feature

#7 F-008: 員工/部門管理

## Layout

使用 Dialog（非獨立頁面），從員工列表頁觸發。

```
┌─────────────── Dialog ──────────────────┐
│ [X]                                     │
│ 新增員工 / 編輯員工                       │
│ 填寫員工基本資料                          │
│                                         │
│ ┌─ Grid (2 cols) ────────────────────┐  │
│ │ 員工編號 *         Email *          │  │
│ │ [EMP___]          [___@company.com] │  │
│ │                                    │  │
│ │ 姓名 *             角色 *           │  │
│ │ [___________]     [員工 ▼]          │  │
│ │                                    │  │
│ │ 部門 *             直屬主管          │  │
│ │ [請選擇部門 ▼]    [搜尋主管... ▼]   │  │
│ │                                    │  │
│ │ 到職日 *           密碼 * (新增才有) │  │
│ │ [📅 選擇日期]     [_________ 👁]    │  │
│ └────────────────────────────────────┘  │
│                                         │
│                    [取消]  [儲存]        │
└─────────────────────────────────────────┘
```

## 頁面規格

| 項目 | 說明 |
|------|------|
| 觸發方式 | 員工列表的「新增員工」按鈕 / 行操作「編輯」 |
| 容器 | `Dialog`，`max-w-2xl`（672px） |
| 認證 | 需要（role: admin） |

## 使用的元件

| 元件 | 來源 | 用途 |
|------|------|------|
| Dialog | shadcn/ui | 容器 |
| Form | react-hook-form + zod | 表單驗證 |
| Input | shadcn/ui | 文字欄位 |
| Select | shadcn/ui | 角色、部門下拉 |
| Combobox | shadcn/ui (Popover + Command) | 主管選擇 |
| Calendar | shadcn/ui | 到職日選擇 |
| PasswordInput | `components/form-field` | 密碼欄位 |
| Button | shadcn/ui | 送出/取消 |

## 表單欄位

| 欄位 | Label | Type | 必填 | 新增 | 編輯 | 驗證 |
|------|-------|------|------|------|------|------|
| employee_id | 員工編號 | text | 是 | 可編輯 | 唯讀 | max 20, unique |
| email | Email | email | 是 | 可編輯 | 可編輯 | valid email, unique |
| name | 姓名 | text | 是 | 可編輯 | 可編輯 | max 100 |
| role | 角色 | select | 是 | 可選 | 可選 | enum |
| department_id | 部門 | select | 是 | 可選 | 可選 | valid uuid |
| manager_id | 直屬主管 | combobox | 否 | 可選 | 可選 | role=manager |
| hire_date | 到職日 | date | 是 | 可選 | 可選 | valid date |
| password | 密碼 | password | 是(新增) | 可編輯 | 不顯示 | min 8 |

## 互動行為

### 新增模式

1. 開啟 Dialog，所有欄位為空
2. Title: "新增員工"
3. 送出：`POST /api/v1/employees`
4. 成功：關閉 Dialog + Toast "新增成功" + 刷新列表
5. 失敗：根據錯誤碼顯示（DUPLICATE_EMPLOYEE_ID / DUPLICATE_EMAIL 等）

### 編輯模式

1. 開啟 Dialog，預填現有資料
2. Title: "編輯員工"
3. employee_id 欄位設為 `disabled`（唯讀）
4. 不顯示密碼欄位
5. 送出：`PUT /api/v1/employees/:id`
6. 成功：關閉 Dialog + Toast "更新成功" + 刷新列表

### 角色與主管連動

- 選擇角色為 `manager` 或 `admin` 時，主管欄位可以為空
- 主管下拉只顯示 `role=manager` 的使用者
- 切換部門時，主管欄位重置（因為主管通常在同部門）

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
import { employeeFormSchema, type EmployeeFormValues } from "@/lib/schemas";

interface EmployeeFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  defaultValues?: Partial<EmployeeFormValues>;
  departments: { id: string; name: string }[];
  managers: { id: string; name: string; department: string }[];
  onSubmit: (data: EmployeeFormValues) => Promise<void>;
}

export function EmployeeForm({
  open,
  onOpenChange,
  mode,
  defaultValues,
  departments,
  managers,
  onSubmit,
}: EmployeeFormProps) {
  const form = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeFormSchema),
    defaultValues: defaultValues || {
      employee_id: "",
      email: "",
      name: "",
      role: "employee",
      department_id: "",
      manager_id: "",
      hire_date: undefined,
      password: "",
    },
  });

  const isSubmitting = form.formState.isSubmitting;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "新增員工" : "編輯員工"}
          </DialogTitle>
          <DialogDescription>
            填寫員工基本資料
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {/* 員工編號 */}
              <FormField
                control={form.control}
                name="employee_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>員工編號 *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="EMP001"
                        disabled={mode === "edit"}
                        className="font-mono"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Email */}
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email *</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="user@company.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* 姓名 */}
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>姓名 *</FormLabel>
                    <FormControl>
                      <Input placeholder="請輸入姓名" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* 角色 */}
              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>角色 *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="請選擇角色" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="employee">員工</SelectItem>
                        <SelectItem value="manager">主管</SelectItem>
                        <SelectItem value="admin">管理員</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* 部門 */}
              <FormField
                control={form.control}
                name="department_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>部門 *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="請選擇部門" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {departments.map((dept) => (
                          <SelectItem key={dept.id} value={dept.id}>
                            {dept.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* 直屬主管（Combobox — 見 form-field.md） */}
              {/* ... Combobox 元件 ... */}

              {/* 到職日（DatePicker — 見 form-field.md） */}
              {/* ... DatePicker 元件 ... */}

              {/* 密碼（僅新增模式） */}
              {mode === "create" && (
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>初始密碼 *</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="至少 8 個字元" {...field} />
                      </FormControl>
                      <FormDescription>員工登入後可自行變更</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

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
| `DUPLICATE_EMPLOYEE_ID` | 表單 employee_id 欄位顯示 "員工編號已存在" |
| `DUPLICATE_EMAIL` | 表單 email 欄位顯示 "Email 已存在" |
| `DEPARTMENT_NOT_FOUND` | Toast "所選部門不存在" |
| `INVALID_INPUT` | 對應欄位顯示錯誤（由 zod 前端攔截） |

## 響應式行為

| 斷點 | Grid | Dialog 寬度 |
|------|------|------------|
| >= 640px (sm) | 2 欄 | 672px |
| < 640px | 1 欄 | full width |
