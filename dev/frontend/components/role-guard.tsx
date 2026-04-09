"use client";

import { useAuthStore } from "@/lib/auth-store";
import { ShieldAlert } from "lucide-react";
import { type ReactNode } from "react";

interface RoleGuardProps {
  allowedRoles: string[];
  children: ReactNode;
}

export function RoleGuard({ allowedRoles, children }: RoleGuardProps) {
  const { user } = useAuthStore();

  if (!user || !allowedRoles.includes(user.role)) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <ShieldAlert className="h-16 w-16 text-muted-foreground" />
        <h2 className="text-xl font-semibold">403 - 權限不足</h2>
        <p className="text-sm text-muted-foreground">
          您沒有權限存取此頁面
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
