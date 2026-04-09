"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout";
import { PageHeader } from "@/components/layout";
import { MonthPicker } from "@/components/month-picker";
import { CardStats } from "@/components/card-stats";
import { DonutChart, type DonutSegment } from "@/components/donut-chart";
import { HorizontalBarChart, type BarItem } from "@/components/bar-chart";
import { RoleGuard } from "@/components/role-guard";
import {
  Users,
  CalendarCheck,
  AlertTriangle,
  CalendarX,
  Timer,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import api from "@/lib/api";

interface DepartmentReport {
  department_id: string;
  department_name: string;
  total_members: number;
  avg_attendance_rate: number;
  total_late_count: number;
  total_leave_days: number;
  total_overtime_hours: number;
  total_attendance_days: number;
  total_absent_days: number;
}

interface CompanyReport {
  company_summary: {
    total_employees: number;
    avg_attendance_rate: number;
    total_late_count: number;
    total_leave_days: number;
    total_overtime_hours: number;
    total_attendance_days: number;
    total_absent_days: number;
    working_days: number;
  };
  departments: DepartmentReport[];
}

const attendanceColors: Record<string, string> = {
  present: "#22c55e",
  late: "#f59e0b",
  leave: "#3b82f6",
  absent: "#ef4444",
};

export default function CompanyReportPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const { data, isLoading } = useQuery({
    queryKey: ["reports", "company", year, month],
    queryFn: async () => {
      const res = await api.get("/reports/company", {
        params: { year, month },
      });
      return res.data as CompanyReport;
    },
  });

  const handleMonthChange = (y: number, m: number) => {
    setYear(y);
    setMonth(m);
  };

  const summary = data?.company_summary;
  const departments = data?.departments ?? [];

  // Bar chart data for department attendance rates
  const barItems: BarItem[] = departments.map((d) => ({
    label: d.department_name,
    value: Number(d.avg_attendance_rate.toFixed(1)),
    color: "bg-primary",
  }));

  // Donut chart for company-wide attendance distribution
  const donutSegments: DonutSegment[] = summary
    ? [
        {
          label: "正常出勤",
          value: summary.total_attendance_days - summary.total_late_count,
          color: attendanceColors.present,
        },
        { label: "遲到", value: summary.total_late_count, color: attendanceColors.late },
        { label: "請假", value: summary.total_leave_days, color: attendanceColors.leave },
        { label: "缺席", value: summary.total_absent_days, color: attendanceColors.absent },
      ]
    : [];

  return (
    <RoleGuard allowedRoles={["admin"]}>
      <AppLayout
        breadcrumbs={[
          { label: "報表", href: "/reports/personal" },
          { label: "全公司報表" },
        ]}
      >
        <PageHeader
          title="全公司出勤報表"
          description="全公司月出勤統計及部門比較"
        />

        <div className="mb-4">
          <MonthPicker year={year} month={month} onChange={handleMonthChange} />
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-[120px] rounded-lg" />
            ))}
          </div>
        ) : summary ? (
          <>
            {/* Stats cards */}
            <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-5">
              <CardStats
                title="總員工數"
                value={summary.total_employees}
                icon={Users}
              />
              <CardStats
                title="平均出勤率"
                value={`${summary.avg_attendance_rate.toFixed(1)}%`}
                icon={CalendarCheck}
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
              <CardStats
                title="加班時數"
                value={`${summary.total_overtime_hours}h`}
                icon={Timer}
              />
            </div>

            {/* Charts */}
            <div className="mb-6 grid gap-4 md:grid-cols-2">
              <HorizontalBarChart
                title="部門出勤率比較"
                description={`${year} 年 ${month} 月`}
                items={barItems}
                maxValue={100}
                unit="%"
              />
              <DonutChart
                title="全公司出勤分布"
                description={`${year} 年 ${month} 月`}
                segments={donutSegments}
                centerLabel="出勤率"
                centerValue={`${summary.avg_attendance_rate.toFixed(1)}%`}
              />
            </div>

            {/* Department detail table */}
            <div className="rounded-lg border bg-card">
              <div className="border-b px-4 py-3">
                <h3 className="font-semibold">部門出勤明細</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-4 py-2 text-left font-medium text-muted-foreground">部門</th>
                      <th className="px-4 py-2 text-right font-medium text-muted-foreground">人數</th>
                      <th className="px-4 py-2 text-right font-medium text-muted-foreground">出勤率</th>
                      <th className="px-4 py-2 text-right font-medium text-muted-foreground">遲到</th>
                      <th className="px-4 py-2 text-right font-medium text-muted-foreground">請假</th>
                      <th className="px-4 py-2 text-right font-medium text-muted-foreground">加班(h)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {departments.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                          暫無資料
                        </td>
                      </tr>
                    ) : (
                      <>
                        {departments.map((dept) => (
                          <tr key={dept.department_id} className="border-b hover:bg-muted/50">
                            <td className="px-4 py-2 font-medium">{dept.department_name}</td>
                            <td className="px-4 py-2 text-right">{dept.total_members}</td>
                            <td className="px-4 py-2 text-right">
                              <span
                                className={
                                  dept.avg_attendance_rate >= 95
                                    ? "text-green-600"
                                    : dept.avg_attendance_rate >= 85
                                      ? "text-amber-600"
                                      : "text-red-600"
                                }
                              >
                                {dept.avg_attendance_rate.toFixed(1)}%
                              </span>
                            </td>
                            <td className="px-4 py-2 text-right">{dept.total_late_count}</td>
                            <td className="px-4 py-2 text-right">{dept.total_leave_days}</td>
                            <td className="px-4 py-2 text-right">{dept.total_overtime_hours}</td>
                          </tr>
                        ))}
                        {/* Summary row */}
                        <tr className="border-t-2 bg-muted/30 font-medium">
                          <td className="px-4 py-2">全公司合計</td>
                          <td className="px-4 py-2 text-right">{summary.total_employees}</td>
                          <td className="px-4 py-2 text-right">
                            {summary.avg_attendance_rate.toFixed(1)}%
                          </td>
                          <td className="px-4 py-2 text-right">{summary.total_late_count}</td>
                          <td className="px-4 py-2 text-right">{summary.total_leave_days}</td>
                          <td className="px-4 py-2 text-right">{summary.total_overtime_hours}</td>
                        </tr>
                      </>
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
