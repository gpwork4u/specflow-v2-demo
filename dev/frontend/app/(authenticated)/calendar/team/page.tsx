"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout";
import { PageHeader } from "@/components/layout";
import { MonthPicker } from "@/components/month-picker";
import { TeamCalendarGrid, type TeamMember } from "@/components/team-calendar-grid";
import { RoleGuard } from "@/components/role-guard";
import { useAuthStore } from "@/lib/auth-store";
import api from "@/lib/api";

interface Department {
  id: string;
  name: string;
  code: string;
}

export default function TeamCalendarPage() {
  const { user } = useAuthStore();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [departmentId, setDepartmentId] = useState<string>(
    user?.department?.id ?? ""
  );

  // Fetch departments for admin
  const { data: departments } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const res = await api.get("/departments");
      return res.data as Department[];
    },
    enabled: user?.role === "admin",
  });

  // Fetch team calendar
  const { data, isLoading } = useQuery({
    queryKey: ["calendar", "team", year, month, departmentId],
    queryFn: async () => {
      const params: Record<string, string | number> = { year, month };
      if (departmentId) params.department_id = departmentId;
      const res = await api.get("/calendar/team", { params });
      return res.data as { members: TeamMember[] };
    },
    enabled: !!departmentId || user?.role === "admin",
  });

  const handleMonthChange = (y: number, m: number) => {
    setYear(y);
    setMonth(m);
  };

  return (
    <RoleGuard allowedRoles={["manager", "admin"]}>
      <AppLayout
        breadcrumbs={[
          { label: "行事曆", href: "/calendar" },
          { label: "團隊行事曆" },
        ]}
      >
        <PageHeader
          title="團隊行事曆"
          description="查看團隊成員的月出勤狀況"
          actions={
            user?.role === "admin" && departments ? (
              <select
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                <option value="">全部部門</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </select>
            ) : undefined
          }
        />

        <div className="mb-4">
          <MonthPicker year={year} month={month} onChange={handleMonthChange} />
        </div>

        <TeamCalendarGrid
          year={year}
          month={month}
          members={data?.members ?? []}
          isLoading={isLoading}
        />
      </AppLayout>
    </RoleGuard>
  );
}
