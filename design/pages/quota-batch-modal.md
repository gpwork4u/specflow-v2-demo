# 批次額度設定 Modal

## 對應 Feature

#16 F-009: 假別額度管理

## Layout

```
┌──────────────────────────────────────────┐
│ 批次設定額度                              │
│                                          │
│ 年度: 2026                               │
│                                          │
│ 設定目標 *                                │
│ ○ 依部門    ○ 依員工                      │
│                                          │
│ ┌── 依部門 ──────────────────────────┐   │
│ │ 選擇部門                           │   │
│ │ [▼ 請選擇部門]                     │   │
│ │ 影響人數: 15 人                     │   │
│ └────────────────────────────────────┘   │
│                                          │
│ --- 或 ---                               │
│                                          │
│ ┌── 依員工 ──────────────────────────┐   │
│ │ 選擇員工（可多選）                  │   │
│ │ [🔍 搜尋...]                       │   │
│ │ ☑ 王小明 (EMP001)                  │   │
│ │ ☑ 李小華 (EMP002)                  │   │
│ │ ☐ 張小美 (EMP003)                  │   │
│ │ 已選 2 人                          │   │
│ └────────────────────────────────────┘   │
│                                          │
│ ┌── 額度設定 ────────────────────────┐   │
│ │ QuotaEditor (batch mode)           │   │
│ │ | 假別   | 額度 (天) |             │   │
│ │ |--------|----------|             │   │
│ │ | [特休] | [10]     |             │   │
│ │ | [事假] | [ 7]     |             │   │
│ │ | [病假] | [30]     |             │   │
│ │ | ...    | ...      |             │   │
│ └────────────────────────────────────┘   │
│                                          │
│ ⚠ 此操作將覆蓋選擇對象的現有額度設定      │
│                                          │
│                [取消]  [確認設定]          │
└──────────────────────────────────────────┘

       ↓ 確認後

┌──────────────────────────────────────────┐
│ 設定完成                                  │
│                                          │
│ ✓ 已成功更新 15 位員工的額度設定          │
│                                          │
│                          [關閉]           │
└──────────────────────────────────────────┘
```

## 外觀規格

| 部位 | 樣式 |
|------|------|
| Dialog | `max-w-lg` |
| 標題 | `text-lg font-semibold` |
| RadioGroup（目標） | `flex gap-6` |
| 部門 Select | shadcn/ui `Select` |
| 員工多選 | `Command` + Checkbox list，max-h-[200px] overflow-auto |
| 已選人數 | `text-sm text-muted-foreground` |
| QuotaEditor | batch mode |
| 警告文字 | `text-sm text-amber-600` + `AlertTriangle` icon |
| 確認按鈕 | `Button variant="default"` |

## Props

| Prop | Type | Default | 說明 |
|------|------|---------|------|
| open | `boolean` | - | 是否開啟 |
| onOpenChange | `(open: boolean) => void` | - | 開關 |
| year | `number` | - | 年度 |
| departments | `Department[]` | - | 部門列表 |
| onSubmit | `(data: BatchQuotaData) => Promise<void>` | - | 提交回呼 |
| isSubmitting | `boolean` | `false` | 是否正在提交 |

### BatchQuotaData

```ts
interface BatchQuotaData {
  year: number;
  department_id?: string;
  user_ids?: string[];
  quotas: { leave_type: string; total_hours: number }[];
}
```

## 互動行為

1. 選擇 "依部門" -> 顯示部門下拉 -> 選擇後顯示影響人數
2. 選擇 "依員工" -> 顯示員工搜尋多選列表
3. 設定各假別額度（QuotaEditor batch 模式）
4. 點擊 [確認設定] -> 呼叫 `POST /api/v1/leave-quotas/batch`
5. 成功：顯示結果（更新人數）-> 關閉 -> 刷新主頁面
6. 失敗：Toast 錯誤訊息

## 範例程式碼

```tsx
import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Command, CommandInput, CommandEmpty, CommandGroup, CommandItem,
} from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { QuotaEditor } from "@/components/quota-editor";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";

type TargetMode = "department" | "employees";

interface BatchQuotaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  year: number;
  departments: Department[];
  onSubmit: (data: BatchQuotaData) => Promise<{ updated_count: number }>;
  isSubmitting?: boolean;
}

const defaultQuotas: EditableQuota[] = [
  { leave_type: "annual", leave_type_label: "特休", total_hours: 80, used_hours: 0, remaining_hours: 80 },
  { leave_type: "personal", leave_type_label: "事假", total_hours: 56, used_hours: 0, remaining_hours: 56 },
  { leave_type: "sick", leave_type_label: "病假", total_hours: 240, used_hours: 0, remaining_hours: 240 },
  { leave_type: "marriage", leave_type_label: "婚假", total_hours: 64, used_hours: 0, remaining_hours: 64 },
  { leave_type: "bereavement", leave_type_label: "喪假", total_hours: 24, used_hours: 0, remaining_hours: 24 },
  { leave_type: "maternity", leave_type_label: "產假", total_hours: 448, used_hours: 0, remaining_hours: 448 },
  { leave_type: "paternity", leave_type_label: "陪產假", total_hours: 56, used_hours: 0, remaining_hours: 56 },
];

export function BatchQuotaModal({
  open,
  onOpenChange,
  year,
  departments,
  onSubmit,
  isSubmitting = false,
}: BatchQuotaModalProps) {
  const [targetMode, setTargetMode] = useState<TargetMode>("department");
  const [departmentId, setDepartmentId] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [quotas, setQuotas] = useState(defaultQuotas);
  const [result, setResult] = useState<{ updated_count: number } | null>(null);

  const canSubmit =
    (targetMode === "department" && departmentId) ||
    (targetMode === "employees" && selectedUserIds.length > 0);

  const handleSubmit = async () => {
    const data: BatchQuotaData = {
      year,
      ...(targetMode === "department" ? { department_id: departmentId } : {}),
      ...(targetMode === "employees" ? { user_ids: selectedUserIds } : {}),
      quotas: quotas.map((q) => ({
        leave_type: q.leave_type,
        total_hours: q.total_hours,
      })),
    };
    const res = await onSubmit(data);
    setResult(res);
  };

  if (result) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <div className="flex flex-col items-center gap-4 py-6">
            <CheckCircle2 className="h-12 w-12 text-green-500" />
            <p className="text-lg font-medium">設定完成</p>
            <p className="text-sm text-muted-foreground">
              已成功更新 {result.updated_count} 位員工的額度設定
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => { setResult(null); onOpenChange(false); }}>
              關閉
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>批次設定額度</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* 年度 */}
          <p className="text-sm text-muted-foreground">年度：{year}</p>

          {/* 設定目標 */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">設定目標 *</Label>
            <RadioGroup
              value={targetMode}
              onValueChange={(v) => setTargetMode(v as TargetMode)}
              className="flex gap-6"
            >
              <div className="flex items-center gap-1.5">
                <RadioGroupItem value="department" id="target-dept" />
                <Label htmlFor="target-dept" className="cursor-pointer">依部門</Label>
              </div>
              <div className="flex items-center gap-1.5">
                <RadioGroupItem value="employees" id="target-emp" />
                <Label htmlFor="target-emp" className="cursor-pointer">依員工</Label>
              </div>
            </RadioGroup>
          </div>

          {/* 依部門 */}
          {targetMode === "department" && (
            <Select value={departmentId} onValueChange={setDepartmentId}>
              <SelectTrigger>
                <SelectValue placeholder="請選擇部門" />
              </SelectTrigger>
              <SelectContent>
                {departments.map((dept) => (
                  <SelectItem key={dept.id} value={dept.id}>
                    {dept.name} ({dept.employee_count} 人)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* 依員工 */}
          {targetMode === "employees" && (
            <div className="space-y-2">
              <Command className="rounded-lg border">
                <CommandInput placeholder="搜尋員工..." />
                <CommandEmpty>找不到員工</CommandEmpty>
                <CommandGroup className="max-h-[200px] overflow-auto">
                  {employees.map((emp) => (
                    <CommandItem key={emp.id} className="flex items-center gap-2">
                      <Checkbox
                        checked={selectedUserIds.includes(emp.id)}
                        onCheckedChange={(checked) => {
                          setSelectedUserIds((prev) =>
                            checked
                              ? [...prev, emp.id]
                              : prev.filter((id) => id !== emp.id)
                          );
                        }}
                      />
                      <span className="text-sm">{emp.name}</span>
                      <span className="text-xs text-muted-foreground font-mono">
                        ({emp.employee_id})
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </Command>
              <p className="text-xs text-muted-foreground">
                已選 {selectedUserIds.length} 人
              </p>
            </div>
          )}

          {/* 額度設定 */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">額度設定</Label>
            <QuotaEditor
              quotas={quotas}
              onChange={setQuotas}
              mode="batch"
            />
          </div>

          {/* 警告 */}
          <div className="flex items-center gap-2 text-sm text-amber-600">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>此操作將覆蓋選擇對象的現有額度設定</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            確認設定
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

## Accessibility

- Dialog trap focus
- RadioGroup 支援方向鍵
- Checkbox list 支援鍵盤操作
- 警告文字含 icon + 文字
- 不可提交時 disable 確認按鈕

## 使用的 shadcn/ui 元件

- `Dialog`（DialogContent, DialogHeader, DialogTitle, DialogFooter）
- `RadioGroup`（RadioGroupItem）
- `Select`
- `Command`（CommandInput, CommandEmpty, CommandGroup, CommandItem）
- `Checkbox`
- `Button`
- `Label`
- `QuotaEditor`（自訂）
