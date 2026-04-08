# DataTable

## 用途

可排序、可分頁、可搜尋的資料表格。搭配 `@tanstack/react-table` 實作 headless 邏輯，`shadcn/ui Table` 負責外觀。用於員工列表、打卡紀錄列表等頁面。

## Props

| Prop | Type | Default | 說明 |
|------|------|---------|------|
| columns | `ColumnDef<T>[]` | - | TanStack Table 欄位定義 |
| data | `T[]` | - | 資料陣列 |
| searchKey | `string` | - | 搜尋欄位的 key（如 `"name"`） |
| searchPlaceholder | `string` | `"搜尋..."` | 搜尋框 placeholder |
| filterableColumns | `FilterableColumn[]` | `[]` | 可篩選的欄位定義 |
| pageSize | `number` | `20` | 每頁筆數 |
| pageSizeOptions | `number[]` | `[10, 20, 50]` | 每頁筆數選項 |
| isLoading | `boolean` | `false` | 載入中狀態 |
| emptyMessage | `string` | `"沒有資料"` | 無資料時的提示 |
| onRowClick | `(row: T) => void` | - | 行點擊事件 |
| serverSide | `boolean` | `false` | 是否為 server-side 分頁 |
| totalRows | `number` | - | server-side 時的總筆數 |
| onPageChange | `(page: number) => void` | - | server-side 換頁 |
| onSortChange | `(sort: SortingState) => void` | - | server-side 排序 |

## 子型別

```ts
interface FilterableColumn {
  id: string;
  title: string;
  options: { label: string; value: string; icon?: React.ComponentType }[];
}
```

## 外觀規格

| 部位 | 樣式 |
|------|------|
| 表頭 | `bg-muted/50`，`text-sm font-medium text-muted-foreground` |
| 表格行 | `border-b`，hover 時 `bg-muted/50` |
| 表格 cell | `p-3 text-sm`，垂直置中 |
| 分頁列 | 底部，左側顯示筆數，右側分頁按鈕 |
| 搜尋框 | 表格上方，`max-w-sm` |
| 篩選器 | 搜尋框右側，使用 Popover + Command |

## 範例程式碼

### 基礎 DataTable 元件

```tsx
"use client";

import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Search,
  Loader2,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  searchKey?: string;
  searchPlaceholder?: string;
  pageSize?: number;
  isLoading?: boolean;
  emptyMessage?: string;
  onRowClick?: (row: TData) => void;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  searchKey,
  searchPlaceholder = "搜尋...",
  pageSize = 20,
  isLoading = false,
  emptyMessage = "沒有資料",
  onRowClick,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  const table = useReactTable({
    data,
    columns,
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
    <div className="space-y-4">
      {/* Toolbar */}
      {searchKey && (
        <div className="flex items-center gap-2">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder}
              value={(table.getColumn(searchKey)?.getFilterValue() as string) ?? ""}
              onChange={(e) => table.getColumn(searchKey)?.setFilterValue(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="bg-muted/50">
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              // Loading skeleton
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {columns.map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  onClick={() => onRowClick?.(row.original)}
                  className={onRowClick ? "cursor-pointer" : ""}
                >
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
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          共 {table.getFilteredRowModel().rows.length} 筆資料
        </p>
        <div className="flex items-center gap-2">
          <Select
            value={`${table.getState().pagination.pageSize}`}
            onValueChange={(value) => table.setPageSize(Number(value))}
          >
            <SelectTrigger className="h-8 w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[10, 20, 50].map((size) => (
                <SelectItem key={size} value={`${size}`}>
                  {size} 筆/頁
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground">
              第 {table.getState().pagination.pageIndex + 1} / {table.getPageCount()} 頁
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => table.setPageIndex(table.getPageCount() - 1)}
              disabled={!table.getCanNextPage()}
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

### 可排序欄位 Header

```tsx
import { Column } from "@tanstack/react-table";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SortableHeaderProps<TData, TValue> {
  column: Column<TData, TValue>;
  title: string;
}

export function SortableHeader<TData, TValue>({
  column,
  title,
}: SortableHeaderProps<TData, TValue>) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-3 h-8"
      onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
    >
      {title}
      {column.getIsSorted() === "asc" ? (
        <ArrowUp className="ml-2 h-4 w-4" />
      ) : column.getIsSorted() === "desc" ? (
        <ArrowDown className="ml-2 h-4 w-4" />
      ) : (
        <ArrowUpDown className="ml-2 h-4 w-4" />
      )}
    </Button>
  );
}
```

### 員工列表欄位定義範例

```tsx
import { ColumnDef } from "@tanstack/react-table";
import { StatusBadge } from "@/components/status-badge";
import { SortableHeader } from "@/components/sortable-header";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Pencil, KeyRound, UserX } from "lucide-react";

interface Employee {
  id: string;
  employee_id: string;
  name: string;
  email: string;
  role: "employee" | "manager" | "admin";
  department: { id: string; name: string };
  status: "active" | "inactive" | "suspended";
  hire_date: string;
}

export const employeeColumns: ColumnDef<Employee>[] = [
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
    accessorKey: "email",
    header: "Email",
    cell: ({ row }) => (
      <span className="text-muted-foreground">{row.getValue("email")}</span>
    ),
  },
  {
    accessorKey: "department.name",
    header: "部門",
    filterFn: (row, id, value) => value.includes(row.original.department.id),
  },
  {
    accessorKey: "role",
    header: "角色",
    cell: ({ row }) => <StatusBadge type="role" value={row.getValue("role")} />,
  },
  {
    accessorKey: "status",
    header: "狀態",
    cell: ({ row }) => <StatusBadge type="account" value={row.getValue("status")} />,
  },
  {
    accessorKey: "hire_date",
    header: ({ column }) => <SortableHeader column={column} title="到職日" />,
    cell: ({ row }) => new Date(row.getValue("hire_date")).toLocaleDateString("zh-TW"),
  },
  {
    id: "actions",
    cell: ({ row }) => (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">操作選單</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onEdit(row.original)}>
            <Pencil className="mr-2 h-4 w-4" />
            編輯
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onResetPassword(row.original)}>
            <KeyRound className="mr-2 h-4 w-4" />
            重設密碼
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => onDeactivate(row.original)}
            className="text-destructive"
          >
            <UserX className="mr-2 h-4 w-4" />
            停用帳號
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  },
];
```

## States

| State | 外觀 |
|-------|------|
| Loading | 5 列 Skeleton rows |
| Empty | 中央顯示 emptyMessage，高度 96px |
| Error | 中央顯示錯誤訊息 + 重試按鈕 |
| Normal | 正常表格 |

## Accessibility

- Table 使用語意化 `<table>` 元素
- 排序按鈕有 `aria-sort` 屬性
- 分頁按鈕有 `aria-label`（如 "前一頁"、"下一頁"）
- 行操作的 DropdownMenu trigger 有 `sr-only` 標籤
- Loading 狀態使用 `aria-busy="true"`

## 使用的 shadcn/ui 元件

- `Table`（含 TableHeader, TableBody, TableRow, TableHead, TableCell）
- `Button`
- `Input`
- `Select`
- `DropdownMenu`
- `Skeleton`
