import { APIRequestContext } from '@playwright/test';
import { API, ADMIN_USER, EMPLOYEE_USER, MANAGER_USER, LEAVE_TYPES, HALF_DAY, futureDate } from './test-data';

/**
 * API Client Helper
 * 封裝常用的 API 呼叫，包含 token 管理
 */

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: {
    id: string;
    employee_id: string;
    email: string;
    name: string;
    role: string;
    department: {
      id: string;
      name: string;
    };
  };
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

/**
 * 登入並取得 token pair
 */
export async function login(
  request: APIRequestContext,
  email: string,
  password: string,
): Promise<LoginResponse> {
  const res = await request.post(API.AUTH.LOGIN, {
    data: { email, password },
  });
  if (!res.ok()) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      `Login failed (${res.status()}): ${JSON.stringify(body)}`,
    );
  }
  return res.json();
}

/**
 * 以 Admin 身份登入
 */
export async function loginAsAdmin(
  request: APIRequestContext,
): Promise<LoginResponse> {
  return login(request, ADMIN_USER.email, ADMIN_USER.password);
}

/**
 * 以一般員工身份登入
 */
export async function loginAsEmployee(
  request: APIRequestContext,
): Promise<LoginResponse> {
  return login(request, EMPLOYEE_USER.email, EMPLOYEE_USER.password);
}

/**
 * 以主管身份登入
 */
export async function loginAsManager(
  request: APIRequestContext,
): Promise<LoginResponse> {
  return login(request, MANAGER_USER.email, MANAGER_USER.password);
}

/**
 * 建立帶有 Authorization header 的請求選項
 */
export function authHeaders(accessToken: string) {
  return {
    Authorization: `Bearer ${accessToken}`,
  };
}

/**
 * 建立部門（需 admin token）
 */
export async function createDepartment(
  request: APIRequestContext,
  accessToken: string,
  data: { name: string; code: string; manager_id?: string; parent_id?: string },
) {
  return request.post(API.DEPARTMENTS, {
    data,
    headers: authHeaders(accessToken),
  });
}

/**
 * 建立員工（需 admin token）
 */
export async function createEmployee(
  request: APIRequestContext,
  accessToken: string,
  data: {
    employee_id: string;
    email: string;
    password: string;
    name: string;
    role: string;
    department_id: string;
    hire_date: string;
    manager_id?: string;
  },
) {
  return request.post(API.EMPLOYEES, {
    data,
    headers: authHeaders(accessToken),
  });
}

/**
 * 刷新 token
 */
export async function refreshToken(
  request: APIRequestContext,
  refreshTokenValue: string,
) {
  return request.post(API.AUTH.REFRESH, {
    data: { refresh_token: refreshTokenValue },
  });
}

/**
 * 登出
 */
export async function logout(
  request: APIRequestContext,
  accessToken: string,
) {
  return request.post(API.AUTH.LOGOUT, {
    headers: authHeaders(accessToken),
  });
}

/**
 * 取得個人資料
 */
export async function getMe(
  request: APIRequestContext,
  accessToken: string,
) {
  return request.get(API.AUTH.ME, {
    headers: authHeaders(accessToken),
  });
}

/**
 * 變更密碼
 */
export async function changePassword(
  request: APIRequestContext,
  accessToken: string,
  currentPassword: string,
  newPassword: string,
) {
  return request.put(API.AUTH.PASSWORD, {
    data: { current_password: currentPassword, new_password: newPassword },
    headers: authHeaders(accessToken),
  });
}

// =============================================
// 假別額度 API
// =============================================

/**
 * 取得自己的假別額度
 */
export async function getMyQuotas(
  request: APIRequestContext,
  accessToken: string,
  year?: number,
) {
  const query = year ? `?year=${year}` : '';
  return request.get(`${API.LEAVE_QUOTAS.ME}${query}`, {
    headers: authHeaders(accessToken),
  });
}

/**
 * Admin 取得指定員工的假別額度
 */
export async function getEmployeeQuotas(
  request: APIRequestContext,
  accessToken: string,
  userId: string,
  year?: number,
) {
  const query = year ? `?year=${year}` : '';
  return request.get(`${API.LEAVE_QUOTAS.EMPLOYEES}/${userId}${query}`, {
    headers: authHeaders(accessToken),
  });
}

/**
 * Admin 設定員工額度
 */
export async function setEmployeeQuotas(
  request: APIRequestContext,
  accessToken: string,
  userId: string,
  data: {
    year: number;
    quotas: Array<{ leave_type: string; total_hours: number }>;
  },
) {
  return request.put(`${API.LEAVE_QUOTAS.EMPLOYEES}/${userId}`, {
    data,
    headers: authHeaders(accessToken),
  });
}

/**
 * Admin 批次設定額度
 */
export async function batchSetQuotas(
  request: APIRequestContext,
  accessToken: string,
  data: {
    year: number;
    department_id?: string;
    user_ids?: string[];
    quotas: Array<{ leave_type: string; total_hours: number }>;
  },
) {
  return request.post(API.LEAVE_QUOTAS.BATCH, {
    data,
    headers: authHeaders(accessToken),
  });
}

// =============================================
// 請假 API
// =============================================

export interface CreateLeaveData {
  leave_type: string;
  start_date: string;
  end_date: string;
  start_half?: string;
  end_half?: string;
  reason: string;
}

/**
 * 建立請假申請
 */
export async function createLeave(
  request: APIRequestContext,
  accessToken: string,
  data: CreateLeaveData,
) {
  return request.post(API.LEAVES.BASE, {
    data,
    headers: authHeaders(accessToken),
  });
}

/**
 * 查詢個人請假紀錄
 */
export async function getLeaves(
  request: APIRequestContext,
  accessToken: string,
  params?: Record<string, string>,
) {
  const query = params
    ? '?' + new URLSearchParams(params).toString()
    : '';
  return request.get(`${API.LEAVES.BASE}${query}`, {
    headers: authHeaders(accessToken),
  });
}

/**
 * 查詢單筆請假詳情
 */
export async function getLeaveById(
  request: APIRequestContext,
  accessToken: string,
  leaveId: string,
) {
  return request.get(`${API.LEAVES.BASE}/${leaveId}`, {
    headers: authHeaders(accessToken),
  });
}

/**
 * 取消請假
 */
export async function cancelLeave(
  request: APIRequestContext,
  accessToken: string,
  leaveId: string,
) {
  return request.put(`${API.LEAVES.BASE}/${leaveId}/cancel`, {
    headers: authHeaders(accessToken),
  });
}

/**
 * 查看待審核清單
 */
export async function getPendingLeaves(
  request: APIRequestContext,
  accessToken: string,
  params?: Record<string, string>,
) {
  const query = params
    ? '?' + new URLSearchParams(params).toString()
    : '';
  return request.get(`${API.LEAVES.PENDING}${query}`, {
    headers: authHeaders(accessToken),
  });
}

/**
 * 核准請假
 */
export async function approveLeave(
  request: APIRequestContext,
  accessToken: string,
  leaveId: string,
  comment?: string,
) {
  return request.put(`${API.LEAVES.BASE}/${leaveId}/approve`, {
    data: comment ? { comment } : {},
    headers: authHeaders(accessToken),
  });
}

/**
 * 駁回請假
 */
export async function rejectLeave(
  request: APIRequestContext,
  accessToken: string,
  leaveId: string,
  comment: string,
) {
  return request.put(`${API.LEAVES.BASE}/${leaveId}/reject`, {
    data: { comment },
    headers: authHeaders(accessToken),
  });
}

/**
 * 建立一筆請假並回傳 leave id（方便測試前置作業）
 */
export async function createLeaveAndGetId(
  request: APIRequestContext,
  accessToken: string,
  data: CreateLeaveData,
): Promise<string> {
  const res = await createLeave(request, accessToken, data);
  const body = await res.json();
  return body.id;
}
