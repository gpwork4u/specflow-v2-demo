import { APIRequestContext } from '@playwright/test';
import { API, ADMIN_USER, EMPLOYEE_USER, MANAGER_USER } from './test-data';

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
