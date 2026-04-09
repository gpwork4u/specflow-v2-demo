"use client";

import { useState } from "react";
import {
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
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
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  pageSize?: number;
  pageSizeOptions?: number[];
  isLoading?: boolean;
  emptyMessage?: string;
  onRowClick?: (row: TData) => void;
  // Server-side pagination
  serverSide?: boolean;
  totalRows?: number;
  currentPage?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  pageSize = 20,
  pageSizeOptions = [10, 20, 50],
  isLoading = false,
  emptyMessage = "沒有資料",
  onRowClick,
  serverSide = false,
  totalRows,
  currentPage = 1,
  onPageChange,
  onPageSizeChange,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [pSize, setPSize] = useState(pageSize);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    ...(!serverSide && {
      getPaginationRowModel: getPaginationRowModel(),
      getSortedRowModel: getSortedRowModel(),
      getFilteredRowModel: getFilteredRowModel(),
    }),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    state: {
      sorting,
      columnFilters,
      ...(serverSide && {
        pagination: { pageIndex: currentPage - 1, pageSize: pSize },
      }),
    },
    ...(!serverSide && {
      initialState: { pagination: { pageSize } },
    }),
    ...(serverSide && {
      manualPagination: true,
      pageCount: totalRows ? Math.ceil(totalRows / pSize) : -1,
    }),
  });

  const totalPages = serverSide
    ? Math.ceil((totalRows || 0) / pSize)
    : table.getPageCount();
  const currentPageDisplay = serverSide
    ? currentPage
    : table.getState().pagination.pageIndex + 1;
  const total = serverSide
    ? totalRows || 0
    : table.getFilteredRowModel().rows.length;

  const handlePageSizeChange = (value: string) => {
    const newSize = Number(value);
    setPSize(newSize);
    if (serverSide) {
      onPageSizeChange?.(newSize);
      onPageChange?.(1);
    } else {
      table.setPageSize(newSize);
    }
  };

  const canPrevious = serverSide
    ? currentPage > 1
    : table.getCanPreviousPage();
  const canNext = serverSide
    ? currentPage < totalPages
    : table.getCanNextPage();

  return (
    <div className="space-y-4">
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="bg-muted/50">
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
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
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          共 {total} 筆資料
        </p>
        <div className="flex items-center gap-2">
          <Select value={`${pSize}`} onValueChange={handlePageSizeChange}>
            <SelectTrigger className="h-8 w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pageSizeOptions.map((size) => (
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
              onClick={() =>
                serverSide ? onPageChange?.(1) : table.setPageIndex(0)
              }
              disabled={!canPrevious}
            >
              <ChevronsLeft className="h-4 w-4" />
              <span className="sr-only">第一頁</span>
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() =>
                serverSide
                  ? onPageChange?.(currentPage - 1)
                  : table.previousPage()
              }
              disabled={!canPrevious}
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="sr-only">上一頁</span>
            </Button>
            <span className="text-sm text-muted-foreground">
              第 {currentPageDisplay} / {totalPages || 1} 頁
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() =>
                serverSide
                  ? onPageChange?.(currentPage + 1)
                  : table.nextPage()
              }
              disabled={!canNext}
            >
              <ChevronRight className="h-4 w-4" />
              <span className="sr-only">下一頁</span>
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() =>
                serverSide
                  ? onPageChange?.(totalPages)
                  : table.setPageIndex(table.getPageCount() - 1)
              }
              disabled={!canNext}
            >
              <ChevronsRight className="h-4 w-4" />
              <span className="sr-only">最後一頁</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
