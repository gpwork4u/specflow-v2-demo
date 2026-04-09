"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";

/**
 * 管理員權限守衛。
 * 若使用者非 admin 角色，自動導向首頁。
 * 回傳 true 表示使用者是 admin，可以顯示頁面內容。
 */
export function useAdminGuard(): boolean {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated || !user) {
      router.replace("/login");
      return;
    }
    if (user.role !== "admin") {
      router.replace("/");
    }
  }, [isAuthenticated, user, router]);

  return !!user && user.role === "admin";
}
