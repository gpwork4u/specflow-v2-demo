import { APIRequestContext } from '@playwright/test';
import { loginAsAdmin, createDepartment, createEmployee, authHeaders } from './api-client';
import {
  API,
  TEST_DEPARTMENT,
  TEST_DEPARTMENT_2,
  TEST_DEPARTMENT_EMPTY,
  NEW_EMPLOYEE,
  NEW_EMPLOYEE_2,
  SUSPENDED_USER,
  LOCKOUT_USER,
  EMPLOYEE_USER,
  MANAGER_USER,
} from './test-data';

/**
 * 測試環境設置
 * 在 test suite 開始前建立必要的測試資料
 */

export interface SetupResult {
  adminToken: string;
  departmentId: string;
  department2Id: string;
  emptyDepartmentId: string;
  employeeId?: string;
  managerId?: string;
}

/**
 * 完整的測試環境初始化
 * 建立部門、員工、停用帳號等測試資料
 *
 * 注意：此函式假設系統已有 seed 資料（admin 帳號）
 * 如果資料已存在會跳過（忽略 409 錯誤）
 */
export async function setupTestEnvironment(
  request: APIRequestContext,
): Promise<SetupResult> {
  // 1. 以 admin 登入
  const adminLogin = await loginAsAdmin(request);
  const token = adminLogin.access_token;

  // 2. 建立測試部門
  const dept1Res = await createDepartment(request, token, TEST_DEPARTMENT);
  const dept1Body = dept1Res.ok() ? await dept1Res.json() : null;
  let departmentId = dept1Body?.id;

  // 如果部門已存在（409），查詢取得 id
  if (!departmentId) {
    const listRes = await request.get(`${API.DEPARTMENTS}?search=${encodeURIComponent(TEST_DEPARTMENT.name)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (listRes.ok()) {
      const listBody = await listRes.json();
      departmentId = listBody.data?.[0]?.id;
    }
  }

  const dept2Res = await createDepartment(request, token, TEST_DEPARTMENT_2);
  const dept2Body = dept2Res.ok() ? await dept2Res.json() : null;
  let department2Id = dept2Body?.id;

  if (!department2Id) {
    const listRes = await request.get(`${API.DEPARTMENTS}?search=${encodeURIComponent(TEST_DEPARTMENT_2.name)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (listRes.ok()) {
      const listBody = await listRes.json();
      department2Id = listBody.data?.[0]?.id;
    }
  }

  const deptEmptyRes = await createDepartment(request, token, TEST_DEPARTMENT_EMPTY);
  const deptEmptyBody = deptEmptyRes.ok() ? await deptEmptyRes.json() : null;
  let emptyDepartmentId = deptEmptyBody?.id;

  if (!emptyDepartmentId) {
    const listRes = await request.get(`${API.DEPARTMENTS}?search=${encodeURIComponent(TEST_DEPARTMENT_EMPTY.name)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (listRes.ok()) {
      const listBody = await listRes.json();
      emptyDepartmentId = listBody.data?.[0]?.id;
    }
  }

  // 3. 建立測試主管
  if (departmentId) {
    const managerRes = await createEmployee(request, token, {
      employee_id: 'EMP-MGR-001',
      email: MANAGER_USER.email,
      password: MANAGER_USER.password,
      name: MANAGER_USER.name,
      role: 'manager',
      department_id: departmentId,
      hire_date: '2024-01-01',
    });
    // 忽略 409（已存在）
  }

  // 4. 建立測試員工
  if (departmentId) {
    const empRes = await createEmployee(request, token, {
      employee_id: 'EMP-STAFF-001',
      email: EMPLOYEE_USER.email,
      password: EMPLOYEE_USER.password,
      name: EMPLOYEE_USER.name,
      role: 'employee',
      department_id: departmentId,
      hire_date: '2024-03-01',
    });
    // 忽略 409
  }

  // 5. 建立停用帳號
  if (departmentId) {
    const suspRes = await createEmployee(request, token, {
      employee_id: 'EMP-SUSP-001',
      email: SUSPENDED_USER.email,
      password: SUSPENDED_USER.password,
      name: SUSPENDED_USER.name,
      role: 'employee',
      department_id: departmentId,
      hire_date: '2024-01-01',
    });
    if (suspRes.ok()) {
      const suspBody = await suspRes.json();
      // 停用該帳號
      await request.put(`${API.EMPLOYEES}/${suspBody.id}`, {
        data: { status: 'suspended' },
        headers: authHeaders(token),
      });
    }
  }

  // 6. 建立鎖定測試帳號
  if (departmentId) {
    await createEmployee(request, token, {
      employee_id: 'EMP-LOCK-001',
      email: LOCKOUT_USER.email,
      password: LOCKOUT_USER.password,
      name: LOCKOUT_USER.name,
      role: 'employee',
      department_id: departmentId,
      hire_date: '2024-01-01',
    });
    // 忽略 409
  }

  return {
    adminToken: token,
    departmentId: departmentId || '',
    department2Id: department2Id || '',
    emptyDepartmentId: emptyDepartmentId || '',
  };
}
