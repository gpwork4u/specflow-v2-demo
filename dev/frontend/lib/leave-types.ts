/** 假別定義與常用工具 */

export const LEAVE_TYPES = {
  annual: "特休",
  personal: "事假",
  sick: "病假",
  marriage: "婚假",
  bereavement: "喪假",
  maternity: "產假",
  paternity: "陪產假",
  official: "公假",
} as const;

export type LeaveType = keyof typeof LEAVE_TYPES;

export const LEAVE_TYPE_OPTIONS = Object.entries(LEAVE_TYPES).map(
  ([value, label]) => ({ value: value as LeaveType, label })
);

export const LEAVE_STATUS = {
  pending: "待審核",
  approved: "已核准",
  rejected: "已駁回",
  cancelled: "已取消",
} as const;

export type LeaveStatus = keyof typeof LEAVE_STATUS;

export const LEAVE_STATUS_OPTIONS = Object.entries(LEAVE_STATUS).map(
  ([value, label]) => ({ value: value as LeaveStatus, label })
);

export const HALF_DAY_OPTIONS = [
  { value: "full", label: "全天" },
  { value: "morning", label: "上午" },
  { value: "afternoon", label: "下午" },
] as const;

export type HalfDay = "full" | "morning" | "afternoon";

/** 假別對應的顏色 class */
export function getLeaveTypeColor(type: LeaveType): string {
  const colors: Record<LeaveType, string> = {
    annual: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
    personal: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
    sick: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
    marriage: "bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-400",
    bereavement: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
    maternity: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-400",
    paternity: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-400",
    official: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400",
  };
  return colors[type] ?? "";
}

/** 假單狀態對應的顏色 class */
export function getLeaveStatusColor(status: LeaveStatus): string {
  const colors: Record<LeaveStatus, string> = {
    pending: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
    approved: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400",
    rejected: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
    cancelled: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
  };
  return colors[status] ?? "";
}

/** 請假單回傳的資料型別 */
export interface LeaveRecord {
  id: string;
  user_id: string;
  user?: {
    id: string;
    name: string;
    employee_id: string;
    department?: { id: string; name: string };
  };
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  start_half: HalfDay;
  end_half: HalfDay;
  hours: number;
  reason: string;
  status: LeaveStatus;
  reviewer?: {
    id: string;
    name: string;
  } | null;
  reviewed_at: string | null;
  review_comment: string | null;
  created_at: string;
}

export interface LeaveQuota {
  id: string;
  leave_type: LeaveType;
  leave_type_label: string;
  total_hours: number;
  used_hours: number;
  remaining_hours: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

/**
 * 計算請假時數（前端估算，以 8 小時/天計算）
 */
export function calculateLeaveHours(
  startDate: Date,
  endDate: Date,
  startHalf: HalfDay,
  endHalf: HalfDay
): number {
  const oneDay = 24 * 60 * 60 * 1000;
  const totalDays = Math.round((endDate.getTime() - startDate.getTime()) / oneDay) + 1;

  if (totalDays <= 0) return 0;

  if (totalDays === 1) {
    // 同一天
    if (startHalf === "full") return 8;
    return 4; // morning or afternoon
  }

  // 多天: 首日 + 中間天 + 末日
  const firstDayHours = startHalf === "full" ? 8 : 4;
  const lastDayHours = endHalf === "full" ? 8 : 4;
  const middleDays = totalDays - 2;

  return firstDayHours + middleDays * 8 + lastDayHours;
}
