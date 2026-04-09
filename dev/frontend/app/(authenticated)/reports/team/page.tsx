"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout";
import { PageHeader } from "@/components/layout";
import { MonthPicker } from "@/components/month-picker";
import { CardStats } from "@/components/card-stats";
import { RoleGuard } from "@/components/role-guard";
import { useAuthStore } from "@/lib/auth-store";
import {
  CalendarCheck,
  Users,
  AlertTriangle,
  CalendarX,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import api from "@/lib/api";

interface Department {
  id: string;
  name: string;
  code: string;
}

interface TeamMemberReport {
  user_id: string;
  employee_id: string;
  name: string;
  attendance_days: number;
  absent_days: number;
  late_days: number;
  early_leave_days: number;
  leave_days: number;
  overtime_hours: number;
  attendance_rate: number;
}

interface TeamReport {
  team_summary: {
    total_members: number;
    avg_attendance_rate: number;
    total_late_count: number;
    total_leave_days: number;
  };
  members: TeamMemberReport[];
}

export default function TeamReportPage() {
  const { user } = useAuthStore();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [departmentId, setDepartmentId] = useState<string>(
    user?.department?.id ?? ""
  );
  const [searchTerm, setSearchTerm] = useState("");

  // Fetch departments for admin
  const { data: departments } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const res = await api.get("/departments");
      return res.data as Department[];
    },
    enabled: user?.role === "admin",
  });

  // Fetch team report
  const { data, isLoading } = useQuery({
    queryKey: ["reports", "team", year, month, departmentId],
    queryFn: async () => {
      const params: Record<string, string | number> = { year, month };
      if (departmentId) params.department_id = departmentId;
      const res = await api.get("/reports/team", { params });
      return res.data as TeamReport;
    },
    enabled: !!departmentId || user?.role === "admin",
  });

  const handleMonthChange = (y: number, m: number) => {
    setYear(y);
    setMonth(m);
  };

  const filteredMembers =
    data?.members?.filter((m) =>
      searchTerm
        ? m.name.includes(searchTerm) || m.employee_id.includes(searchTerm)
        : true
    ) ?? [];

  const summary = data?.team_summary;

  return (
    <RoleGuard allowedRoles={["manager", "admin"]}>
      <AppLayout
        breadcrumbs={[
          { label: "報表", href: "/reports/personal" },
          { label: "團隊報表" },
        ]}
      >
        <PageHeader
          title="團隊報表"
          description="查看團隊的月出勤統計"
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

        {isLoading ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[120px] rounded-lg" />
            ))}
          </div>
        ) : summary ? (
          <>
            {/* Stats cards */}
            <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
              <CardStats
                title="平均出勤率"
                value={`${summary.avg_attendance_rate.toFixed(1)}%`}
                icon={CalendarCheck}
              />
              <CardStats
                title="總人數"
                value={summary.total_members}
                icon={Users}
              />
              <CardStats
                title="遲到人次"
                value={`${summary.total_late_count} 次`}
                icon={AlertTriangle}
              />
              <CardStats
                title="請假天數"
                value={`${summary.total_leave_days} 天`}
                icon={CalendarX}
              />
            </div>

            {/* Member table */}
            <div className="rounded-lg border bg-card">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <h3 className="font-semibold">團隊出勤明細</h3>
                <input
                  type="text"
                  placeholder="搜尋員工..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="rounded-md border border-input bg-background px-3 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-4 py-2 text-left font-medium text-muted-foreground">編號</th>
                      <th className="px-4 py-2 text-left font-medium text-muted-foreground">姓名</th>
                      <th className="px-4 py-2 text-right font-medium text-muted-foreground">出勤</th>
                      <th className="px-4 py-2 text-right font-medium text-muted-foreground">缺席</th>
                      <th className="px-4 py-2 text-right font-medium text-muted-foreground">遲到</th>
                      <th className="px-4 py-2 text-right font-medium text-muted-foreground">早退</th>
                      <th className="px-4 py-2 text-right font-medium text-muted-foreground">請假</th>
                      <th className="px-4 py-2 text-right font-medium text-muted-foreground">加班(h)</th>
                      <th className="px-4 py-2 text-right font-medium text-muted-foreground">出勤率</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMembers.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                          暫無資料
                        </td>
                      </tr>
                    ) : (
                      filteredMembers.map((m) => (
                        <tr key={m.user_id} className="border-b last:border-b-0 hover:bg-muted/50">
                          <td className="px-4 py-2 text-muted-foreground">{m.employee_id}</td>
                          <td className="px-4 py-2 font-medium">{m.name}</td>
                          <td className="px-4 py-2 text-right">{m.attendance_days}</td>
                          <td className="px-4 py-2 text-right">{m.absent_days}</td>
                          <td className="px-4 py-2 text-right">{m.late_days}</td>
                          <td className="px-4 py-2 text-right">{m.early_leave_days}</td>
                          <td className="px-4 py-2 text-right">{m.leave_days}</td>
                          <td className="px-4 py-2 text-right">{m.overtime_hours}</td>
                          <td className="px-4 py-2 text-right">
                            <span
                              className={
                                m.attendance_rate >= 95
                                  ? "text-green-600"
                                  : m.attendance_rate >= 85
                                    ? "text-amber-600"
                                    : "text-red-600"
                              }
                            >
                              {m.attendance_rate.toFixed(1)}%
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : (
          <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
            暫無資料
          </div>
        )}
      </AppLayout>
    </RoleGuard>
  );
}
