"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout";
import { PageHeader } from "@/components/layout";
import { MonthPicker } from "@/components/month-picker";
import { CardStats } from "@/components/card-stats";
import { DonutChart, type DonutSegment } from "@/components/donut-chart";
import {
  CalendarCheck,
  AlertTriangle,
  CalendarX,
  Timer,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import api from "@/lib/api";

interface PersonalReport {
  summary: {
    working_days: number;
    attendance_days: number;
    attendance_rate: number;
    late_days: number;
    early_leave_days: number;
    absent_days: number;
    leave_days: number;
    overtime_hours: number;
  };
  leave_summary: {
    leave_type: string;
    days: number;
    hours: number;
  }[];
}

const leaveTypeLabels: Record<string, string> = {
  annual: "特休",
  personal: "事假",
  sick: "病假",
  marriage: "婚假",
  bereavement: "喪假",
  maternity: "產假",
  paternity: "陪產假",
  official: "公假",
};

const attendanceColors: Record<string, string> = {
  present: "#22c55e",
  late: "#f59e0b",
  leave: "#3b82f6",
  absent: "#ef4444",
};

const leaveColors = [
  "#3b82f6", "#8b5cf6", "#06b6d4", "#f59e0b",
  "#ef4444", "#10b981", "#ec4899", "#6366f1",
];

export default function PersonalReportPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const { data, isLoading } = useQuery({
    queryKey: ["reports", "personal", year, month],
    queryFn: async () => {
      const res = await api.get("/reports/personal", {
        params: { year, month },
      });
      return res.data as PersonalReport;
    },
  });

  const handleMonthChange = (y: number, m: number) => {
    setYear(y);
    setMonth(m);
  };

  const summary = data?.summary;

  // Build donut segments for attendance distribution
  const attendanceSegments: DonutSegment[] = summary
    ? [
        { label: "正常出勤", value: summary.attendance_days - summary.late_days - summary.early_leave_days, color: attendanceColors.present },
        { label: "遲到", value: summary.late_days, color: attendanceColors.late },
        { label: "請假", value: summary.leave_days, color: attendanceColors.leave },
        { label: "缺席", value: summary.absent_days, color: attendanceColors.absent },
      ]
    : [];

  // Build donut segments for leave type distribution
  const leaveSegments: DonutSegment[] =
    data?.leave_summary?.map((ls, i) => ({
      label: leaveTypeLabels[ls.leave_type] || ls.leave_type,
      value: ls.days,
      color: leaveColors[i % leaveColors.length],
    })) ?? [];

  return (
    <AppLayout
      breadcrumbs={[
        { label: "報表", href: "/reports/personal" },
        { label: "個人報表" },
      ]}
    >
      <PageHeader
        title="個人出勤報表"
        description="查看您的月出勤統計"
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
              title="出勤率"
              value={`${summary.attendance_rate.toFixed(1)}%`}
              description={`${summary.attendance_days}/${summary.working_days} 工作日`}
              icon={CalendarCheck}
            />
            <CardStats
              title="遲到"
              value={`${summary.late_days} 次`}
              icon={AlertTriangle}
            />
            <CardStats
              title="請假"
              value={`${summary.leave_days} 天`}
              icon={CalendarX}
            />
            <CardStats
              title="加班"
              value={`${summary.overtime_hours}h`}
              icon={Timer}
            />
          </div>

          {/* Charts */}
          <div className="mb-6 grid gap-4 md:grid-cols-2">
            <DonutChart
              title="出勤分布"
              description={`${year} 年 ${month} 月`}
              segments={attendanceSegments}
              centerLabel="出勤天數"
              centerValue={summary.attendance_days}
            />
            <DonutChart
              title="請假類型分布"
              description={`${year} 年 ${month} 月`}
              segments={leaveSegments}
              centerLabel="請假天數"
              centerValue={summary.leave_days}
            />
          </div>

          {/* Leave detail table */}
          {data.leave_summary && data.leave_summary.length > 0 && (
            <div className="rounded-lg border bg-card">
              <div className="border-b px-4 py-3">
                <h3 className="font-semibold">請假明細</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-4 py-2 text-left font-medium text-muted-foreground">假別</th>
                      <th className="px-4 py-2 text-right font-medium text-muted-foreground">天數</th>
                      <th className="px-4 py-2 text-right font-medium text-muted-foreground">時數</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.leave_summary.map((ls) => (
                      <tr key={ls.leave_type} className="border-b last:border-b-0">
                        <td className="px-4 py-2">
                          {leaveTypeLabels[ls.leave_type] || ls.leave_type}
                        </td>
                        <td className="px-4 py-2 text-right">{ls.days}</td>
                        <td className="px-4 py-2 text-right">{ls.hours}h</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
          暫無資料
        </div>
      )}
    </AppLayout>
  );
}
