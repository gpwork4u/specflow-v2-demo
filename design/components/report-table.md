# ReportTable

## 用途

報表專用表格，擴展自 Sprint 1 的 DataTable，增加匯出功能按鈕列、摘要行（合計/平均）、條件格式化（數值色彩標示）。用於團隊報表和公司報表的成員/部門出勤明細。

## 與 DataTable 的差異

| 項目 | DataTable（Sprint 1） | ReportTable（Sprint 3） |
|------|---------------------|------------------------|
| 用途 | 通用列表 | 報表明細 |
| 匯出 | 無 | 支援 CSV/XLSX |
| 摘要行 | 無 | Footer 顯示合計/平均 |
| 條件格式 | 無 | 數值依閾值變色 |
| 列操作 | 有（DropdownMenu） | 無（唯讀） |

## Props

| Prop | Type | Default | 說明 |
|------|------|---------|------|
| columns | `ColumnDef<T>[]` | - | 欄位定義 |
| data | `T[]` | - | 資料陣列 |
| title | `string` | - | 表格標題 |
| description | `string` | - | 表格說明（選填） |
| searchKey | `string` | - | 搜尋欄位 key |
| searchPlaceholder | `string` | `"搜尋..."` | 搜尋框 placeholder |
| pageSize | `number` | `20` | 每頁筆數 |
| isLoading | `boolean` | `false` | 載入中狀態 |
| showExport | `boolean` | `true` | 是否顯示匯出按鈕 |
| onExport | `(format: 'csv' \| 'xlsx') => void` | - | 匯出回呼 |
| exportLoading | `boolean` | `false` | 匯出中狀態 |
| summaryRow | `Record<string, string \| number>` | - | 摘要行資料（選填） |
| emptyMessage | `string` | `"沒有資料"` | 無資料提示 |

## Layout

```
┌─────────────────────────────────────────────────────────┐
│ 團隊出勤報表                                            │
│ 2026 年 4 月 — 工程部                                   │
│                                                         │
│ ┌─ Toolbar ───────────────────────────────────────────┐ │
│ │ [搜尋員工...]                   [匯出 v]           │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ ┌─ Table ─────────────────────────────────────────────┐ │
│ │ 員工編號 ^ │ 姓名   │ 出勤天數 │ 遲到 │ 請假 │ 出勤率│ │
│ ├────────────┼────────┼─────────┼──────┼──────┼───────│ │
│ │ EMP001     │ 王小明 │ 20      │  2   │  2   │ 90.9% │ │
│ │ EMP002     │ 李小華 │ 22      │  0   │  0   │100.0% │ │
│ │ EMP003     │ 張美玲 │ 18      │  1   │  4   │ 81.8% │ │
│ ├────────────┼────────┼─────────┼──────┼──────┼───────│ │
│ │ 合計/平均  │ 3 人   │ avg 20  │  3   │  6   │ 90.9% │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ 共 3 筆資料                               第 1 / 1 頁   │
└─────────────────────────────────────────────────────────┘
```

## 外觀規格

| 部位 | 樣式 |
|------|------|
| 容器 | `rounded-lg border bg-card` |
| 標題區 | `px-6 pt-6 pb-2`，標題 `text-lg font-semibold`，說明 `text-sm text-muted-foreground` |
| Toolbar | `flex items-center justify-between gap-4 px-6 py-3 border-b` |
| 搜尋框 | `max-w-sm`，同 DataTable |
| 匯出按鈕 | `DropdownMenu`，trigger 為 `Button variant="outline" size="sm"` |
| 匯出選項 | CSV（FileText icon）、XLSX（FileSpreadsheet icon） |
| 表格 | 同 DataTable 外觀 |
| 摘要行（Footer） | `bg-muted/50 font-medium border-t-2` |
| 條件格式 — success | `text-[hsl(var(--success))] font-medium`（出勤率 >= 95%） |
| 條件格式 — warning | `text-[hsl(var(--warning))] font-medium`（出勤率 90-95%） |
| 條件格式 — danger | `text-destructive font-medium`（出勤率 < 90%） |
| 數值欄位 | `text-right font-mono text-sm` |

## 條件格式化規則

| 指標 | Success | Warning | Danger |
|------|---------|---------|--------|
| 出勤率 | >= 95% | 90-95% | < 90% |
| 遲到天數 | 0 | 1-3 | > 3 |
| 缺席天數 | 0 | - | > 0 |

## 範例程式碼

### ReportTable 元件

```tsx
"use client";

import { useState } from "react";
import {
  ColumnDef, SortingState, ColumnFiltersState, flexRender,
  getCoreRowModel, getFilteredRowModel, getPaginationRowModel,
  getSortedRowModel, useReactTable,
} from "@tanstack/react-table";
import {
  Table, TableBody, TableCell, TableFooter,
  TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Search, Download, FileSpreadsheet, FileText, Loader2,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface ReportTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  title?: string;
  description?: string;
  searchKey?: string;
  searchPlaceholder?: string;
  pageSize?: number;
  isLoading?: boolean;
  showExport?: boolean;
  onExport?: (format: "csv" | "xlsx") => void;
  exportLoading?: boolean;
  summaryRow?: Record<string, string | number>;
  emptyMessage?: string;
}

export function ReportTable<TData, TValue>({
  columns, data, title, description,
  searchKey, searchPlaceholder = "搜尋...",
  pageSize = 20, isLoading = false,
  showExport = true, onExport, exportLoading = false,
  summaryRow, emptyMessage = "沒有資料",
}: ReportTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  const table = useReactTable({
    data, columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    state: { sorting, columnFilters },
    initialState: { pagination: { pageSize } },
  });

  return (
    <div className="rounded-lg border bg-card">
      {/* 標題區 */}
      {(title || description) && (
        <div className="px-6 pt-6 pb-2">
          {title && <h3 className="text-lg font-semibold">{title}</h3>}
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 border-b px-6 py-3">
        {searchKey ? (
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder}
              value={(table.getColumn(searchKey)?.getFilterValue() as string) ?? ""}
              onChange={(e) => table.getColumn(searchKey)?.setFilterValue(e.target.value)}
              className="pl-9"
            />
          </div>
        ) : <div />}

        {showExport && onExport && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={exportLoading}>
                {exportLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                匯出
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onExport("csv")}>
                <FileText className="mr-2 h-4 w-4" />
                匯出 CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onExport("xlsx")}>
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                匯出 XLSX
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* 表格 */}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="bg-muted/50">
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {columns.map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
          {summaryRow && (
            <TableFooter>
              <TableRow className="bg-muted/50 font-medium border-t-2">
                {table.getAllColumns().map((col) => (
                  <TableCell key={col.id}>{summaryRow[col.id] ?? ""}</TableCell>
                ))}
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>

      {/* 分頁 */}
      <div className="flex items-center justify-between border-t px-6 py-3">
        <p className="text-sm text-muted-foreground">
          共 {table.getFilteredRowModel().rows.length} 筆資料
        </p>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8"
            onClick={() => table.setPageIndex(0)} disabled={!table.getCanPreviousPage()}>
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8"
            onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="px-2 text-sm text-muted-foreground">
            第 {table.getState().pagination.pageIndex + 1} / {table.getPageCount()} 頁
          </span>
          <Button variant="outline" size="icon" className="h-8 w-8"
            onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8"
            onClick={() => table.setPageIndex(table.getPageCount() - 1)} disabled={!table.getCanNextPage()}>
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
```

### 團隊報表欄位定義範例

```tsx
import { ColumnDef } from "@tanstack/react-table";
import { SortableHeader } from "@/components/sortable-header";
import { cn } from "@/lib/utils";

interface TeamMemberReport {
  employee_id: string;
  name: string;
  present_days: number;
  absent_days: number;
  late_days: number;
  early_leave_days: number;
  leave_days: number;
  overtime_hours: number;
  attendance_rate: number;
}

export const teamReportColumns: ColumnDef<TeamMemberReport>[] = [
  {
    accessorKey: "employee_id",
    header: "員工編號",
    cell: ({ row }) => (
      <span className="font-mono text-sm">{row.getValue("employee_id")}</span>
    ),
  },
  {
    accessorKey: "name",
    header: ({ column }) => <SortableHeader column={column} title="姓名" />,
  },
  {
    accessorKey: "present_days",
    header: ({ column }) => <SortableHeader column={column} title="出勤天數" />,
    cell: ({ row }) => (
      <span className="text-right font-mono text-sm">{row.getValue("present_days")}</span>
    ),
  },
  {
    accessorKey: "late_days",
    header: ({ column }) => <SortableHeader column={column} title="遲到" />,
    cell: ({ row }) => {
      const value = row.getValue("late_days") as number;
      return (
        <span className={cn(
          "text-right font-mono text-sm",
          value > 3 && "text-destructive font-medium",
          value > 0 && value <= 3 && "text-[hsl(var(--warning))] font-medium"
        )}>
          {value}
        </span>
      );
    },
  },
  {
    accessorKey: "leave_days",
    header: "請假",
    cell: ({ row }) => (
      <span className="text-right font-mono text-sm">{row.getValue("leave_days")}</span>
    ),
  },
  {
    accessorKey: "overtime_hours",
    header: "加班(h)",
    cell: ({ row }) => (
      <span className="text-right font-mono text-sm">{row.getValue("overtime_hours")}</span>
    ),
  },
  {
    accessorKey: "attendance_rate",
    header: ({ column }) => <SortableHeader column={column} title="出勤率" />,
    cell: ({ row }) => {
      const rate = row.getValue("attendance_rate") as number;
      return (
        <span className={cn(
          "text-right font-mono text-sm",
          rate >= 95 && "text-[hsl(var(--success))] font-medium",
          rate < 90 && "text-destructive font-medium",
          rate >= 90 && rate < 95 && "text-[hsl(var(--warning))] font-medium"
        )}>
          {rate.toFixed(1)}%
        </span>
      );
    },
  },
];
```

## 使用範例

```tsx
<ReportTable
  title="團隊出勤明細"
  description="2026 年 4 月 — 工程部"
  columns={teamReportColumns}
  data={teamMembers}
  searchKey="name"
  searchPlaceholder="搜尋員工..."
  onExport={(format) => exportReport({ scope: "team", format, year: 2026, month: 4 })}
  summaryRow={{
    employee_id: "合計/平均",
    name: `${teamMembers.length} 人`,
    present_days: Math.round(avg("present_days")),
    late_days: sum("late_days"),
    leave_days: sum("leave_days"),
    overtime_hours: sum("overtime_hours"),
    attendance_rate: `${avg("attendance_rate").toFixed(1)}%`,
  }}
/>
```

## Accessibility

- 同 DataTable 的 Accessibility 規範
- 匯出按鈕 DropdownMenu 支援 keyboard（Enter 開啟、方向鍵選擇、Escape 關閉）
- 條件格式化不僅依賴色彩：搭配 font-medium 增加視覺粗細差異
- 摘要行使用 `<tfoot>` 語意元素
- 排序按鈕有 `aria-sort` 屬性
- Loading 狀態使用 `aria-busy="true"`
- 匯出中顯示 loading spinner，按鈕 disabled

## 使用的 shadcn/ui 元件

- `Table`（含 TableHeader, TableBody, TableFooter, TableRow, TableHead, TableCell）
- `Button`
- `Input`
- `DropdownMenu`
- `Skeleton`
