# FormField

## 用途

表單欄位元件，封裝 `react-hook-form` + `zod` 驗證 + shadcn/ui 表單元件。統一表單的錯誤提示、標籤、說明文字樣式。用於員工表單、部門表單、登入表單、密碼表單等。

## 基礎架構

shadcn/ui 提供 `Form` 系列元件（基於 react-hook-form），本文件定義各種欄位的使用規範。

### Form 元件層級

```
<Form>                    ← react-hook-form 的 FormProvider
  <FormField>             ← 綁定 control + name
    <FormItem>            ← 外層容器（含 label, control, message）
      <FormLabel>         ← 標籤
      <FormControl>       ← 表單控制項
        <Input />         ← 實際輸入元件
      </FormControl>
      <FormDescription>   ← 說明文字（選填）
      <FormMessage>       ← 錯誤訊息
    </FormItem>
  </FormField>
</Form>
```

## 欄位類型

### 1. Text Input

```tsx
<FormField
  control={form.control}
  name="name"
  render={({ field }) => (
    <FormItem>
      <FormLabel>姓名</FormLabel>
      <FormControl>
        <Input placeholder="請輸入姓名" {...field} />
      </FormControl>
      <FormMessage />
    </FormItem>
  )}
/>
```

### 2. Email Input

```tsx
<FormField
  control={form.control}
  name="email"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Email</FormLabel>
      <FormControl>
        <Input type="email" placeholder="user@company.com" {...field} />
      </FormControl>
      <FormMessage />
    </FormItem>
  )}
/>
```

### 3. Password Input（含顯示/隱藏切換）

```tsx
function PasswordInput({ field, placeholder = "請輸入密碼" }) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="relative">
      <Input
        type={showPassword ? "text" : "password"}
        placeholder={placeholder}
        {...field}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
        onClick={() => setShowPassword(!showPassword)}
        aria-label={showPassword ? "隱藏密碼" : "顯示密碼"}
      >
        {showPassword ? (
          <EyeOff className="h-4 w-4 text-muted-foreground" />
        ) : (
          <Eye className="h-4 w-4 text-muted-foreground" />
        )}
      </Button>
    </div>
  );
}

// 使用方式
<FormField
  control={form.control}
  name="password"
  render={({ field }) => (
    <FormItem>
      <FormLabel>密碼</FormLabel>
      <FormControl>
        <PasswordInput field={field} />
      </FormControl>
      <FormMessage />
    </FormItem>
  )}
/>
```

### 4. Select（下拉選單）

```tsx
<FormField
  control={form.control}
  name="department_id"
  render={({ field }) => (
    <FormItem>
      <FormLabel>部門</FormLabel>
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
```

### 5. Combobox（可搜尋下拉 — 主管選擇）

```tsx
<FormField
  control={form.control}
  name="manager_id"
  render={({ field }) => (
    <FormItem className="flex flex-col">
      <FormLabel>直屬主管</FormLabel>
      <Popover>
        <PopoverTrigger asChild>
          <FormControl>
            <Button
              variant="outline"
              role="combobox"
              className={cn(
                "w-full justify-between",
                !field.value && "text-muted-foreground"
              )}
            >
              {field.value
                ? managers.find((m) => m.id === field.value)?.name
                : "請選擇主管"}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </FormControl>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0">
          <Command>
            <CommandInput placeholder="搜尋主管..." />
            <CommandEmpty>找不到主管</CommandEmpty>
            <CommandGroup>
              {managers.map((manager) => (
                <CommandItem
                  key={manager.id}
                  value={manager.name}
                  onSelect={() => field.onChange(manager.id)}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      manager.id === field.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {manager.name}
                  <span className="ml-auto text-xs text-muted-foreground">
                    {manager.department}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </Command>
        </PopoverContent>
      </Popover>
      <FormDescription>選填，僅限 manager 角色的使用者</FormDescription>
      <FormMessage />
    </FormItem>
  )}
/>
```

### 6. Date Picker

```tsx
<FormField
  control={form.control}
  name="hire_date"
  render={({ field }) => (
    <FormItem className="flex flex-col">
      <FormLabel>到職日</FormLabel>
      <Popover>
        <PopoverTrigger asChild>
          <FormControl>
            <Button
              variant="outline"
              className={cn(
                "w-full pl-3 text-left font-normal",
                !field.value && "text-muted-foreground"
              )}
            >
              {field.value
                ? format(field.value, "yyyy-MM-dd")
                : "請選擇日期"}
              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
            </Button>
          </FormControl>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={field.value}
            onSelect={field.onChange}
            initialFocus
          />
        </PopoverContent>
      </Popover>
      <FormMessage />
    </FormItem>
  )}
/>
```

## Zod Schema 範例

### 員工表單 Schema

```tsx
import { z } from "zod";

export const employeeFormSchema = z.object({
  employee_id: z
    .string()
    .min(1, "員工編號為必填")
    .max(20, "員工編號最長 20 字元"),
  email: z
    .string()
    .min(1, "Email 為必填")
    .email("Email 格式不正確")
    .max(255),
  password: z
    .string()
    .min(8, "密碼至少 8 個字元")
    .max(100, "密碼最長 100 個字元")
    .optional(), // 編輯時不需要
  name: z
    .string()
    .min(1, "姓名為必填")
    .max(100, "姓名最長 100 字元"),
  role: z.enum(["employee", "manager", "admin"], {
    required_error: "請選擇角色",
  }),
  department_id: z.string().uuid("請選擇部門"),
  manager_id: z.string().uuid().optional().or(z.literal("")),
  hire_date: z.date({ required_error: "請選擇到職日" }),
});

export type EmployeeFormValues = z.infer<typeof employeeFormSchema>;
```

### 部門表單 Schema

```tsx
export const departmentFormSchema = z.object({
  name: z
    .string()
    .min(1, "部門名稱為必填")
    .max(100, "部門名稱最長 100 字元"),
  code: z
    .string()
    .min(1, "部門代碼為必填")
    .max(20, "部門代碼最長 20 字元")
    .regex(/^[a-zA-Z0-9-]+$/, "僅允許英數字和連字號"),
  manager_id: z.string().uuid().optional().or(z.literal("")),
  parent_id: z.string().uuid().optional().or(z.literal("")),
});

export type DepartmentFormValues = z.infer<typeof departmentFormSchema>;
```

### 登入表單 Schema

```tsx
export const loginFormSchema = z.object({
  email: z
    .string()
    .min(1, "請輸入 Email")
    .email("Email 格式不正確"),
  password: z
    .string()
    .min(1, "請輸入密碼"),
});

export type LoginFormValues = z.infer<typeof loginFormSchema>;
```

## 表單 Layout 規格

| 場景 | Layout |
|------|--------|
| 登入表單 | 單欄，最大寬度 400px |
| 員工表單（Dialog） | 兩欄 grid（`grid-cols-2`），手機變單欄 |
| 部門表單（Dialog） | 單欄 |
| 密碼表單（Dialog） | 單欄，最大寬度 400px |

## 外觀規格

| 部位 | 樣式 |
|------|------|
| Label | `text-sm font-medium`，必填欄位加紅色 `*` |
| Input | 高度 40px（`h-10`），圓角 `rounded-md`，border `border-input` |
| Error Message | `text-sm text-destructive`，出現時 input border 變 `border-destructive` |
| Description | `text-xs text-muted-foreground` |
| 欄位間距 | `gap-4`（16px） |
| 表單底部 Actions | `flex justify-end gap-2`，包含取消 + 送出按鈕 |

## Accessibility

- 所有 `<input>` 透過 `FormControl` 自動綁定 `aria-describedby`（指向 FormMessage）
- 錯誤狀態時 input 有 `aria-invalid="true"`
- Label 透過 `htmlFor` 關聯 input
- 必填欄位有 `aria-required="true"`
- 密碼顯示/隱藏按鈕有 `aria-label`
- 表單送出時 focus 第一個錯誤欄位

## 使用的 shadcn/ui 元件

- `Form`（FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage）
- `Input`
- `Select`
- `Popover`
- `Command`（Combobox）
- `Calendar`
- `Button`
