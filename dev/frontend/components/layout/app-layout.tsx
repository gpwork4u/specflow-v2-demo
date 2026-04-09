"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "./app-sidebar";
import { AppHeader, type BreadcrumbItem } from "./app-header";
import { PasswordForm } from "@/components/password-form";
import { useAuthStore } from "@/lib/auth-store";
import api from "@/lib/api";
import { toast } from "sonner";

interface AppLayoutProps {
  children: ReactNode;
  breadcrumbs?: BreadcrumbItem[];
}

export function AppLayout({ children, breadcrumbs = [] }: AppLayoutProps) {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [showPasswordForm, setShowPasswordForm] = useState(false);

  const handleLogout = async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      // Ignore logout API errors
    } finally {
      logout();
      // Remove auth cookie
      document.cookie = "auth-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
      router.push("/login");
    }
  };

  const handleChangePassword = async (data: {
    current_password: string;
    new_password: string;
    confirm_password: string;
  }) => {
    try {
      await api.put("/auth/change-password", {
        current_password: data.current_password,
        new_password: data.new_password,
      });
      toast.success("密碼變更成功");
    } catch (err: any) {
      const code = err?.response?.data?.code;
      if (code === "INVALID_CREDENTIALS") {
        toast.error("目前密碼不正確");
      } else if (code === "SAME_PASSWORD") {
        toast.error("新密碼不可與目前密碼相同");
      } else {
        toast.error("網路錯誤，請稍後再試");
      }
      throw err;
    }
  };

  if (!user) return null;

  return (
    <SidebarProvider>
      <AppSidebar
        role={user.role}
        onChangePassword={() => setShowPasswordForm(true)}
        onLogout={handleLogout}
      />
      <SidebarInset>
        <AppHeader
          user={{
            name: user.name,
            role: user.role,
            department: user.department?.name,
          }}
          breadcrumbs={breadcrumbs}
          onChangePassword={() => setShowPasswordForm(true)}
          onLogout={handleLogout}
        />
        <main className="flex-1 p-4 md:p-6">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </SidebarInset>
      <PasswordForm
        open={showPasswordForm}
        onOpenChange={setShowPasswordForm}
        onSubmit={handleChangePassword}
      />
    </SidebarProvider>
  );
}
