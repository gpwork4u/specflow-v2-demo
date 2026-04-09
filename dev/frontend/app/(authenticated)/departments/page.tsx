"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/layout/page-header";
import { SearchFilter } from "@/components/search-filter";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Building2,
  GitBranch,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  User,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { useAdminGuard } from "@/hooks/use-admin-guard";
import api from "@/lib/api";
import type { DepartmentFormValues } from "@/lib/schemas";
import { DepartmentForm } from "./department-form";

interface Department {
  id: string;
  name: string;
  code: string;
  manager: { id: string; name: string } | null;
  parent: { id: string; name: string } | null;
  member_count: number;
  created_at: string;
}

interface Manager {
  id: string;
  name: string;
}

export default function DepartmentsPage() {
  const isAdmin = useAdminGuard();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editingDepartment, setEditingDepartment] =
    useState<Department | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Department | null>(null);

  // Fetch departments
  const { data: departmentsData, isLoading } = useQuery<{ data: Department[] }>(
    {
      queryKey: ["departments"],
      queryFn: async () => {
        const res = await api.get("/departments?limit=100");
        return res.data;
      },
      enabled: isAdmin,
    }
  );

  // Fetch managers for form
  const { data: managersData } = useQuery<{ data: Manager[] }>({
    queryKey: ["managers"],
    queryFn: async () => {
      const res = await api.get("/employees?role=manager&limit=100");
      return res.data;
    },
    enabled: isAdmin,
  });

  const departments = departmentsData?.data || [];
  const managers = managersData?.data || [];

  // Client-side search filter
  const filteredDepartments = useMemo(() => {
    if (!search) return departments;
    const term = search.toLowerCase();
    return departments.filter(
      (d) =>
        d.name.toLowerCase().includes(term) ||
        d.code.toLowerCase().includes(term)
    );
  }, [departments, search]);

  // Create department
  const createMutation = useMutation({
    mutationFn: async (data: DepartmentFormValues) => {
      await api.post("/departments", data);
    },
    onSuccess: () => {
      toast.success("新增成功");
      queryClient.invalidateQueries({ queryKey: ["departments"] });
    },
    onError: (err: any) => {
      const code = err?.response?.data?.code;
      if (code === "DUPLICATE_NAME") {
        toast.error("部門名稱已存在");
      } else if (code === "DUPLICATE_CODE") {
        toast.error("部門代碼已存在");
      } else {
        toast.error("新增失敗，請稍後再試");
      }
      throw err;
    },
  });

  // Update department
  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: DepartmentFormValues;
    }) => {
      await api.put(`/departments/${id}`, data);
    },
    onSuccess: () => {
      toast.success("更新成功");
      queryClient.invalidateQueries({ queryKey: ["departments"] });
    },
    onError: (err: any) => {
      const code = err?.response?.data?.code;
      if (code === "DUPLICATE_NAME") {
        toast.error("部門名稱已存在");
      } else {
        toast.error("更新失敗，請稍後再試");
      }
      throw err;
    },
  });

  // Delete department
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/departments/${id}`);
    },
    onSuccess: () => {
      toast.success("刪除成功");
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ["departments"] });
    },
    onError: (err: any) => {
      const code = err?.response?.data?.code;
      if (code === "HAS_MEMBERS") {
        toast.error("部門仍有員工，無法刪除");
      } else {
        toast.error("刪除失敗，請稍後再試");
      }
    },
  });

  const handleOpenCreate = () => {
    setEditingDepartment(null);
    setFormMode("create");
    setFormOpen(true);
  };

  const handleEdit = (dept: Department) => {
    setEditingDepartment(dept);
    setFormMode("edit");
    setFormOpen(true);
  };

  const handleFormSubmit = async (data: DepartmentFormValues) => {
    // Clean "none" values to empty
    const cleaned = {
      ...data,
      manager_id: data.manager_id === "none" ? undefined : data.manager_id,
      parent_id: data.parent_id === "none" ? undefined : data.parent_id,
    };

    if (formMode === "create") {
      await createMutation.mutateAsync(cleaned);
    } else if (editingDepartment) {
      await updateMutation.mutateAsync({
        id: editingDepartment.id,
        data: cleaned,
      });
    }
  };

  if (!isAdmin) return null;

  return (
    <AppLayout
      breadcrumbs={[
        { label: "Dashboard", href: "/" },
        { label: "部門管理" },
      ]}
    >
      <PageHeader
        title="部門管理"
        description="管理公司組織架構"
        actions={
          <Button onClick={handleOpenCreate}>
            <Plus className="mr-2 h-4 w-4" />
            新增部門
          </Button>
        }
      />

      <SearchFilter
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="搜尋部門名稱或代碼..."
        onReset={() => setSearch("")}
      />

      {!isLoading && filteredDepartments.length === 0 && !search ? (
        <EmptyState
          icon={Building2}
          title="尚無部門"
          description="建立部門來組織您的團隊結構"
          action={
            <Button onClick={handleOpenCreate}>
              <Plus className="mr-2 h-4 w-4" />
              新增部門
            </Button>
          }
        />
      ) : !isLoading && filteredDepartments.length === 0 && search ? (
        <EmptyState
          icon={Building2}
          title="找不到符合條件的部門"
          description="請嘗試不同的搜尋條件"
        />
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {isLoading
            ? Array.from({ length: 6 }).map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader className="pb-3">
                    <div className="h-5 w-24 rounded bg-muted" />
                    <div className="h-4 w-16 rounded bg-muted" />
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="h-4 w-32 rounded bg-muted" />
                    <div className="h-4 w-20 rounded bg-muted" />
                  </CardContent>
                </Card>
              ))
            : filteredDepartments.map((dept) => (
                <DepartmentCard
                  key={dept.id}
                  department={dept}
                  onEdit={() => handleEdit(dept)}
                  onDelete={() => setDeleteTarget(dept)}
                />
              ))}
        </div>
      )}

      {/* Department Form Dialog */}
      <DepartmentForm
        open={formOpen}
        onOpenChange={setFormOpen}
        mode={formMode}
        currentId={editingDepartment?.id}
        defaultValues={
          editingDepartment
            ? {
                name: editingDepartment.name,
                code: editingDepartment.code,
                manager_id: editingDepartment.manager?.id || "",
                parent_id: editingDepartment.parent?.id || "",
              }
            : undefined
        }
        departments={departments.map((d) => ({ id: d.id, name: d.name }))}
        managers={managers.map((m) => ({ id: m.id, name: m.name }))}
        onSubmit={handleFormSubmit}
      />

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="刪除部門"
        description={`確定要刪除「${deleteTarget?.name}」嗎？此操作無法復原。`}
        confirmLabel="刪除"
        variant="destructive"
        isLoading={deleteMutation.isPending}
        onConfirm={() =>
          deleteTarget && deleteMutation.mutate(deleteTarget.id)
        }
      />
    </AppLayout>
  );
}

// Department Card component
function DepartmentCard({
  department,
  onEdit,
  onDelete,
}: {
  department: Department;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardHeader className="flex flex-row items-start justify-between pb-3">
        <div>
          <h3 className="text-lg font-semibold">{department.name}</h3>
          <p className="font-mono text-sm text-muted-foreground">
            {department.code}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">操作選單</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit}>
              <Pencil className="mr-2 h-4 w-4" />
              編輯
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDelete} className="text-destructive">
              <Trash2 className="mr-2 h-4 w-4" />
              刪除
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <User className="h-4 w-4" />
          <span>主管：{department.manager?.name || "未指定"}</span>
        </div>
        {department.parent && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <GitBranch className="h-4 w-4" />
            <span>上級：{department.parent.name}</span>
          </div>
        )}
        <div className="flex items-center gap-2 text-muted-foreground">
          <Users className="h-4 w-4" />
          <span>成員：{department.member_count} 人</span>
        </div>
      </CardContent>
    </Card>
  );
}
