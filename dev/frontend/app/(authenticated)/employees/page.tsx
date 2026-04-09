"use client";

import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/layout/page-header";
import { SearchFilter, type FilterConfig } from "@/components/search-filter";
import { DataTable } from "@/components/data-table";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Plus, Users } from "lucide-react";
import { toast } from "sonner";
import { useAdminGuard } from "@/hooks/use-admin-guard";
import api from "@/lib/api";
import type { EmployeeFormValues } from "@/lib/schemas";
import { EmployeeForm } from "./employee-form";
import { createEmployeeColumns, type Employee } from "./employee-columns";
import { useDebounce } from "@/hooks/use-debounce";

interface EmployeesResponse {
  data: Employee[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

interface DepartmentOption {
  id: string;
  name: string;
}

export default function EmployeesPage() {
  const isAdmin = useAdminGuard();
  const queryClient = useQueryClient();

  // Search & filter state
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const debouncedSearch = useDebounce(search, 300);

  // Form dialog state
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

  // Confirm dialogs
  const [resetPasswordTarget, setResetPasswordTarget] =
    useState<Employee | null>(null);
  const [toggleStatusTarget, setToggleStatusTarget] =
    useState<Employee | null>(null);

  // Fetch departments for filter and form
  const { data: departmentsData } = useQuery<{ data: DepartmentOption[] }>({
    queryKey: ["departments", "all"],
    queryFn: async () => {
      const res = await api.get("/departments?limit=100");
      return res.data;
    },
    enabled: isAdmin,
  });

  const departments = departmentsData?.data || [];

  // Fetch employees
  const { data: employeesData, isLoading } = useQuery<EmployeesResponse>({
    queryKey: [
      "employees",
      debouncedSearch,
      roleFilter,
      statusFilter,
      departmentFilter,
      page,
      pageSize,
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(pageSize));
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (roleFilter !== "all") params.set("role", roleFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (departmentFilter !== "all")
        params.set("department_id", departmentFilter);
      const res = await api.get(`/employees?${params.toString()}`);
      return res.data;
    },
    enabled: isAdmin,
  });

  // Create employee
  const createMutation = useMutation({
    mutationFn: async (data: EmployeeFormValues) => {
      await api.post("/employees", data);
    },
    onSuccess: () => {
      toast.success("新增成功");
      queryClient.invalidateQueries({ queryKey: ["employees"] });
    },
    onError: (err: any) => {
      const code = err?.response?.data?.code;
      if (code === "DUPLICATE_EMPLOYEE_ID") {
        toast.error("員工編號已存在");
      } else if (code === "DUPLICATE_EMAIL") {
        toast.error("Email 已存在");
      } else if (code === "DEPARTMENT_NOT_FOUND") {
        toast.error("所選部門不存在");
      } else {
        toast.error("新增失敗，請稍後再試");
      }
      throw err;
    },
  });

  // Update employee
  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: EmployeeFormValues;
    }) => {
      await api.put(`/employees/${id}`, data);
    },
    onSuccess: () => {
      toast.success("更新成功");
      queryClient.invalidateQueries({ queryKey: ["employees"] });
    },
    onError: (err: any) => {
      const code = err?.response?.data?.code;
      if (code === "DUPLICATE_EMAIL") {
        toast.error("Email 已存在");
      } else {
        toast.error("更新失敗，請稍後再試");
      }
      throw err;
    },
  });

  // Reset password
  const resetPasswordMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.post(`/employees/${id}/reset-password`);
    },
    onSuccess: () => {
      toast.success("密碼已重設");
      setResetPasswordTarget(null);
    },
    onError: () => {
      toast.error("重設密碼失敗");
    },
  });

  // Toggle status
  const toggleStatusMutation = useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string;
      status: string;
    }) => {
      await api.put(`/employees/${id}`, { status });
    },
    onSuccess: () => {
      toast.success("狀態已更新");
      setToggleStatusTarget(null);
      queryClient.invalidateQueries({ queryKey: ["employees"] });
    },
    onError: () => {
      toast.error("更新狀態失敗");
    },
  });

  // Column actions
  const handleEdit = useCallback((employee: Employee) => {
    setEditingEmployee(employee);
    setFormMode("edit");
    setFormOpen(true);
  }, []);

  const handleResetPassword = useCallback((employee: Employee) => {
    setResetPasswordTarget(employee);
  }, []);

  const handleToggleStatus = useCallback((employee: Employee) => {
    setToggleStatusTarget(employee);
  }, []);

  const columns = useMemo(
    () =>
      createEmployeeColumns({
        onEdit: handleEdit,
        onResetPassword: handleResetPassword,
        onToggleStatus: handleToggleStatus,
      }),
    [handleEdit, handleResetPassword, handleToggleStatus]
  );

  const handleFormSubmit = async (data: EmployeeFormValues) => {
    if (formMode === "create") {
      await createMutation.mutateAsync(data);
    } else if (editingEmployee) {
      await updateMutation.mutateAsync({ id: editingEmployee.id, data });
    }
  };

  const handleOpenCreate = () => {
    setEditingEmployee(null);
    setFormMode("create");
    setFormOpen(true);
  };

  const handleReset = () => {
    setSearch("");
    setRoleFilter("all");
    setStatusFilter("all");
    setDepartmentFilter("all");
    setPage(1);
  };

  const filters: FilterConfig[] = [
    {
      key: "department_id",
      label: "部門",
      options: departments.map((d) => ({ label: d.name, value: d.id })),
      value: departmentFilter,
      onChange: (v) => {
        setDepartmentFilter(v);
        setPage(1);
      },
    },
    {
      key: "role",
      label: "角色",
      options: [
        { label: "員工", value: "employee" },
        { label: "主管", value: "manager" },
        { label: "管理員", value: "admin" },
      ],
      value: roleFilter,
      onChange: (v) => {
        setRoleFilter(v);
        setPage(1);
      },
    },
    {
      key: "status",
      label: "狀態",
      options: [
        { label: "啟用", value: "active" },
        { label: "停用", value: "inactive" },
        { label: "凍結", value: "suspended" },
      ],
      value: statusFilter,
      onChange: (v) => {
        setStatusFilter(v);
        setPage(1);
      },
    },
  ];

  if (!isAdmin) return null;

  const employees = employeesData?.data || [];
  const totalRows = employeesData?.meta?.total || 0;

  return (
    <AppLayout
      breadcrumbs={[
        { label: "Dashboard", href: "/" },
        { label: "員工管理" },
      ]}
    >
      <PageHeader
        title="員工管理"
        description="管理公司員工帳號與資料"
        actions={
          <Button onClick={handleOpenCreate}>
            <Plus className="mr-2 h-4 w-4" />
            新增員工
          </Button>
        }
      />

      <SearchFilter
        searchValue={search}
        onSearchChange={(v) => {
          setSearch(v);
          setPage(1);
        }}
        searchPlaceholder="搜尋姓名、Email 或員工編號..."
        filters={filters}
        onReset={handleReset}
      />

      <div className="mt-4">
        {!isLoading && employees.length === 0 && !debouncedSearch ? (
          <EmptyState
            icon={Users}
            title="尚無員工"
            description="新增員工帳號開始管理"
            action={
              <Button onClick={handleOpenCreate}>
                <Plus className="mr-2 h-4 w-4" />
                新增員工
              </Button>
            }
          />
        ) : (
          <DataTable
            columns={columns}
            data={employees}
            isLoading={isLoading}
            emptyMessage="找不到符合條件的員工"
            serverSide
            totalRows={totalRows}
            currentPage={page}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        )}
      </div>

      {/* Employee Form Dialog */}
      <EmployeeForm
        open={formOpen}
        onOpenChange={setFormOpen}
        mode={formMode}
        defaultValues={
          editingEmployee
            ? {
                employee_id: editingEmployee.employee_id,
                email: editingEmployee.email,
                name: editingEmployee.name,
                role: editingEmployee.role,
                department_id: editingEmployee.department?.id || "",
                hire_date: editingEmployee.hire_date
                  ? editingEmployee.hire_date.split("T")[0]
                  : "",
              }
            : undefined
        }
        departments={departments}
        onSubmit={handleFormSubmit}
      />

      {/* Reset Password Confirm */}
      <ConfirmDialog
        open={!!resetPasswordTarget}
        onOpenChange={(open) => !open && setResetPasswordTarget(null)}
        title="重設密碼"
        description={`確定要重設「${resetPasswordTarget?.name}」的密碼嗎？`}
        confirmLabel="重設密碼"
        variant="default"
        isLoading={resetPasswordMutation.isPending}
        onConfirm={() =>
          resetPasswordTarget &&
          resetPasswordMutation.mutate(resetPasswordTarget.id)
        }
      />

      {/* Toggle Status Confirm */}
      <ConfirmDialog
        open={!!toggleStatusTarget}
        onOpenChange={(open) => !open && setToggleStatusTarget(null)}
        title={
          toggleStatusTarget?.status === "active" ? "停用帳號" : "啟用帳號"
        }
        description={`確定要${
          toggleStatusTarget?.status === "active" ? "停用" : "啟用"
        }「${toggleStatusTarget?.name}」的帳號嗎？`}
        confirmLabel={
          toggleStatusTarget?.status === "active" ? "停用" : "啟用"
        }
        variant={
          toggleStatusTarget?.status === "active" ? "destructive" : "default"
        }
        isLoading={toggleStatusMutation.isPending}
        onConfirm={() =>
          toggleStatusTarget &&
          toggleStatusMutation.mutate({
            id: toggleStatusTarget.id,
            status:
              toggleStatusTarget.status === "active" ? "inactive" : "active",
          })
        }
      />
    </AppLayout>
  );
}
