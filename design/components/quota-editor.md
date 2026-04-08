# QuotaEditor

## 用途

HR Admin 編輯員工假別額度的表格元件。支援行內編輯（直接在表格中修改 total_hours），並即時驗證不可低於 used_hours。用於 Admin 額度管理頁和批次設定 Modal。

## Props

| Prop | Type | Default | 說明 |
|------|------|---------|------|
| quotas | `EditableQuota[]` | - | 可編輯的額度列表 |
| onChange | `(quotas: EditableQuota[]) => void` | - | 變更回呼 |
| mode | `'inline' \| 'batch'` | `'inline'` | 編輯模式 |
| isLoading | `boolean` | `false` | 載入中狀態 |

### EditableQuota Type

```ts
interface EditableQuota {
  leave_type: LeaveType;
  leave_type_label: string;
  total_hours: number;
  used_hours: number;     // 唯讀，僅 inline 模式顯示
  remaining_hours: number; // 自動計算
  isEditing?: boolean;     // 是否正在編輯
  error?: string;          // 驗證錯誤訊息
}
```

## Layout

### Inline 模式（單一員工編輯）

```
┌──────────────────────────────────────────────────────┐
│ 假別額度管理 — 王小明 (EMP001)                        │
│                                                      │
│ | 假別   | 總額(天) | 已用(天) | 剩餘(天) | 操作    | │
│ |--------|---------|---------|---------|---------|   │
│ | [特休] | [10]    | 2       | 8       | [編輯]  |   │
│ | [事假] | [7]     | 0       | 7       | [編輯]  |   │
│ | [病假] | [30]    | 1       | 29      | [編輯]  |   │
│ | [婚假] | [8]     | 0       | 8       | [編輯]  |   │
│ | ...    | ...     | ...     | ...     | ...     |   │
│                                                      │
│                              [取消]  [儲存變更]       │
└──────────────────────────────────────────────────────┘

  編輯中的 row：

│ | [特休] | [ 12__ ] | 2      | 10      | [v] [x] |  │
│                ↑ Input, 數字                          │
```

### Batch 模式（批次設定，不顯示 used）

```
┌──────────────────────────────────────┐
│ | 假別     | 額度 (天) |             │
│ |----------|----------|             │
│ | [特休]   | [ 10   ] |             │
│ | [事假]   | [  7   ] |             │
│ | [病假]   | [ 30   ] |             │
│ | ...      | ...      |             │
└──────────────────────────────────────┘
```

## 外觀規格

| 部位 | 樣式 |
|------|------|
| 表格 | `Table` + `TableHeader` + `TableBody` |
| 假別欄 | `LeaveTypeBadge` |
| 數字欄 | `text-sm text-right font-mono` |
| 編輯 Input | `Input type="number" className="w-20 h-8 text-right font-mono"` step="0.5" |
| 編輯按鈕 | `Button variant="ghost" size="icon"` + `Pencil` icon |
| 確認/取消 | `Button variant="ghost" size="icon"` + `Check` / `X` icon |
| 錯誤狀態 | Input `border-destructive`，下方 `text-xs text-destructive` |
| 剩餘不足 | 剩餘欄位 `text-destructive font-medium` |

## 驗證規則

1. total_hours >= 0
2. total_hours 精度到 0.5（step="0.5"）
3. total_hours >= used_hours（不可低於已使用時數）
4. 違反規則 3 時：顯示 "不可低於已使用的 {used_hours} 小時"

## 範例程式碼

```tsx
import { useState } from "react";
import { Check, X, Pencil } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LeaveTypeBadge } from "@/components/leave-type-badge";
import { cn } from "@/lib/utils";

interface QuotaEditorProps {
  quotas: EditableQuota[];
  onChange: (quotas: EditableQuota[]) => void;
  mode?: "inline" | "batch";
  isLoading?: boolean;
}

export function QuotaEditor({
  quotas,
  onChange,
  mode = "inline",
  isLoading = false,
}: QuotaEditorProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState<number>(0);

  const startEdit = (index: number) => {
    setEditingIndex(index);
    setEditValue(quotas[index].total_hours / 8); // 顯示天數
  };

  const confirmEdit = (index: number) => {
    const totalHours = editValue * 8;
    const quota = quotas[index];

    if (totalHours < quota.used_hours) {
      const updated = [...quotas];
      updated[index] = {
        ...quota,
        error: `不可低於已使用的 ${quota.used_hours} 小時 (${quota.used_hours / 8} 天)`,
      };
      onChange(updated);
      return;
    }

    const updated = [...quotas];
    updated[index] = {
      ...quota,
      total_hours: totalHours,
      remaining_hours: totalHours - quota.used_hours,
      error: undefined,
    };
    onChange(updated);
    setEditingIndex(null);
  };

  const cancelEdit = () => {
    setEditingIndex(null);
    // 清除錯誤
    const updated = quotas.map((q) => ({ ...q, error: undefined }));
    onChange(updated);
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[120px]">假別</TableHead>
          <TableHead className="text-right w-[100px]">總額 (天)</TableHead>
          {mode === "inline" && (
            <>
              <TableHead className="text-right w-[100px]">已用 (天)</TableHead>
              <TableHead className="text-right w-[100px]">剩餘 (天)</TableHead>
            </>
          )}
          <TableHead className="w-[80px]" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {quotas.map((quota, index) => (
          <TableRow key={quota.leave_type}>
            <TableCell>
              <LeaveTypeBadge leaveType={quota.leave_type} />
            </TableCell>
            <TableCell className="text-right">
              {mode === "batch" || editingIndex === index ? (
                <div className="space-y-1">
                  <Input
                    type="number"
                    step="0.5"
                    min="0"
                    value={mode === "batch" ? quota.total_hours / 8 : editValue}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      if (mode === "batch") {
                        const updated = [...quotas];
                        updated[index] = {
                          ...quota,
                          total_hours: val * 8,
                          remaining_hours: val * 8 - quota.used_hours,
                        };
                        onChange(updated);
                      } else {
                        setEditValue(val);
                      }
                    }}
                    className={cn(
                      "w-20 h-8 text-right font-mono",
                      quota.error && "border-destructive"
                    )}
                  />
                  {quota.error && (
                    <p className="text-xs text-destructive">{quota.error}</p>
                  )}
                </div>
              ) : (
                <span className="text-sm font-mono">
                  {quota.total_hours / 8}
                </span>
              )}
            </TableCell>
            {mode === "inline" && (
              <>
                <TableCell className="text-right text-sm font-mono text-muted-foreground">
                  {quota.used_hours / 8}
                </TableCell>
                <TableCell
                  className={cn(
                    "text-right text-sm font-mono",
                    quota.remaining_hours <= 0
                      ? "text-destructive font-medium"
                      : "text-muted-foreground"
                  )}
                >
                  {quota.remaining_hours / 8}
                </TableCell>
              </>
            )}
            <TableCell>
              {mode === "inline" && (
                editingIndex === index ? (
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => confirmEdit(index)}
                    >
                      <Check className="h-4 w-4 text-green-600" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={cancelEdit}
                    >
                      <X className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => startEdit(index)}
                    disabled={isLoading}
                  >
                    <Pencil className="h-4 w-4 text-muted-foreground" />
                  </Button>
                )
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

## 使用範例

```tsx
// Admin 額度管理頁 — inline 模式
<QuotaEditor
  quotas={employeeQuotas}
  onChange={setEmployeeQuotas}
  mode="inline"
/>

// 批次設定 Modal — batch 模式
<QuotaEditor
  quotas={batchQuotas}
  onChange={setBatchQuotas}
  mode="batch"
/>
```

## Accessibility

- Table 使用語意化 `<table>` 標籤
- 編輯中的 Input 自動 focus
- 數字 Input 有 `step`、`min` 限制
- 錯誤狀態有 `border-destructive` + 文字提示
- 編輯/確認/取消按鈕有 icon + implicit aria-label

## 使用的 shadcn/ui 元件

- `Table`（TableHeader, TableBody, TableRow, TableHead, TableCell）
- `Input`
- `Button`
- `LeaveTypeBadge`（自訂）
