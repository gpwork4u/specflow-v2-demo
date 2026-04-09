"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { StatusBadge } from "@/components/status-badge";
import { SortableHeader } from "@/components/sortable-header";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Pencil, KeyRound, UserX, UserCheck } from "lucide-react";

export interface Employee {
  id: string;
  employee_id: string;
  name: string;
  email: string;
  role: "employee" | "manager" | "admin";
  department: { id: string; name: string } | null;
  status: "active" | "inactive" | "suspended";
  hire_date: string;
}

interface ColumnActions {
  onEdit: (employee: Employee) => void;
  onResetPassword: (employee: Employee) => void;
  onToggleStatus: (employee: Employee) => void;
}

export function createEmployeeColumns(
  actions: ColumnActions
): ColumnDef<Employee>[] {
  return [
    {
      accessorKey: "employee_id",
      header: "員工編號",
      cell: ({ row }) => (
        <span className="font-mono text-sm">
          {row.getValue("employee_id")}
        </span>
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
      id: "department",
      accessorFn: (row) => row.department?.name || "-",
      header: "部門",
    },
    {
      accessorKey: "role",
      header: "角色",
      cell: ({ row }) => (
        <StatusBadge type="role" value={row.getValue("role")} />
      ),
    },
    {
      accessorKey: "status",
      header: "狀態",
      cell: ({ row }) => (
        <StatusBadge type="account" value={row.getValue("status")} />
      ),
    },
    {
      accessorKey: "hire_date",
      header: ({ column }) => (
        <SortableHeader column={column} title="到職日" />
      ),
      cell: ({ row }) => {
        const date = row.getValue("hire_date") as string;
        return date
          ? new Date(date).toLocaleDateString("zh-TW")
          : "-";
      },
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const employee = row.original;
        const isActive = employee.status === "active";

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">操作選單</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => actions.onEdit(employee)}>
                <Pencil className="mr-2 h-4 w-4" />
                編輯
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => actions.onResetPassword(employee)}
              >
                <KeyRound className="mr-2 h-4 w-4" />
                重設密碼
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => actions.onToggleStatus(employee)}
                className={isActive ? "text-destructive" : "text-green-600"}
              >
                {isActive ? (
                  <>
                    <UserX className="mr-2 h-4 w-4" />
                    停用帳號
                  </>
                ) : (
                  <>
                    <UserCheck className="mr-2 h-4 w-4" />
                    啟用帳號
                  </>
                )}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];
}
