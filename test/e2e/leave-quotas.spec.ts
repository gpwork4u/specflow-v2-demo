import { test, expect } from '@playwright/test';
import {
  loginAsAdmin,
  loginAsEmployee,
  loginAsManager,
  authHeaders,
  createEmployee,
  createDepartment,
  getMyQuotas,
  getEmployeeQuotas,
  setEmployeeQuotas,
  batchSetQuotas,
} from '../helpers/api-client';
import {
  API,
  LEAVE_TYPES,
  futureDate,
} from '../helpers/test-data';

const FEATURE = 'F-009';

test.describe(`[${FEATURE}] 假別額度管理 - API E2E`, () => {
  let adminToken: string;
  let employeeToken: string;
  let managerToken: string;
  let employeeUserId: string;
  let testDeptId: string;

  test.beforeAll(async ({ request }) => {
    // 以各角色登入取得 token
    const adminLogin = await loginAsAdmin(request);
    adminToken = adminLogin.access_token;

    const empLogin = await loginAsEmployee(request);
    employeeToken = empLogin.access_token;
    employeeUserId = empLogin.user.id;

    const mgrLogin = await loginAsManager(request);
    managerToken = mgrLogin.access_token;

    // 取得或建立測試部門
    const deptRes = await request.get(API.DEPARTMENTS, {
      headers: authHeaders(adminToken),
    });
    const depts = await deptRes.json();
    testDeptId = depts.data?.[0]?.id;
  });

  // =============================================
  // Happy Path
  // =============================================
  test.describe('Happy Path', () => {
    test('Scenario: 員工查看自己的額度 - 200 + quotas 含 total/used/remaining', async ({ request }) => {
      // WHEN
      const res = await getMyQuotas(request, employeeToken, 2026);

      // THEN
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body).toHaveProperty('user_id');
      expect(body).toHaveProperty('year', 2026);
      expect(body).toHaveProperty('quotas');
      expect(Array.isArray(body.quotas)).toBe(true);
      expect(body.quotas.length).toBeGreaterThan(0);

      // AND 每筆 quota 都有 total/used/remaining
      for (const q of body.quotas) {
        expect(q).toHaveProperty('id');
        expect(q).toHaveProperty('leave_type');
        expect(q).toHaveProperty('leave_type_label');
        expect(q).toHaveProperty('total_hours');
        expect(q).toHaveProperty('used_hours');
        expect(q).toHaveProperty('remaining_hours');
        expect(typeof q.total_hours).toBe('number');
        expect(typeof q.used_hours).toBe('number');
        expect(typeof q.remaining_hours).toBe('number');
        expect(q.remaining_hours).toBe(q.total_hours - q.used_hours);
      }
    });

    test('Scenario: Admin 設定員工額度 - 200', async ({ request }) => {
      // WHEN
      const res = await setEmployeeQuotas(request, adminToken, employeeUserId, {
        year: 2026,
        quotas: [
          { leave_type: LEAVE_TYPES.ANNUAL, total_hours: 120.0 },
        ],
      });

      // THEN
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body).toHaveProperty('user_id', employeeUserId);
      expect(body).toHaveProperty('year', 2026);
      expect(body).toHaveProperty('quotas');
      expect(body).toHaveProperty('updated_at');

      const annualQuota = body.quotas.find(
        (q: any) => q.leave_type === LEAVE_TYPES.ANNUAL,
      );
      expect(annualQuota).toBeDefined();
      expect(annualQuota.total_hours).toBe(120.0);
    });

    test('Scenario: Admin 批次設定部門額度 - 200 + updated_count', async ({ request }) => {
      test.skip(!testDeptId, '無可用部門');

      // WHEN
      const res = await batchSetQuotas(request, adminToken, {
        year: 2026,
        department_id: testDeptId,
        quotas: [
          { leave_type: LEAVE_TYPES.PERSONAL, total_hours: 56.0 },
        ],
      });

      // THEN
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body).toHaveProperty('updated_count');
      expect(body.updated_count).toBeGreaterThan(0);
      expect(body).toHaveProperty('year', 2026);
    });
  });

  // =============================================
  // Error Handling
  // =============================================
  test.describe('Error Handling', () => {
    test('Scenario: 額度低於已使用 - 422 QUOTA_BELOW_USED', async ({ request }) => {
      // 先確認員工有已使用額度，設定 total_hours 低於 used_hours
      // 取得目前的 quota 資訊
      const quotaRes = await getMyQuotas(request, employeeToken, 2026);
      const quotaBody = await quotaRes.json();
      const sickQuota = quotaBody.quotas?.find(
        (q: any) => q.leave_type === LEAVE_TYPES.SICK,
      );

      // 如果有已使用的病假時數，嘗試設定低於已使用的額度
      const usedHours = sickQuota?.used_hours || 0;
      if (usedHours === 0) {
        // 沒有已使用額度，設定一個極低值測試（如果可能的話）
        // 先跳過此情境，因為需要已使用的額度
        test.skip(true, '員工尚無已使用的病假額度，跳過此測試');
      }

      // WHEN
      const res = await setEmployeeQuotas(request, adminToken, employeeUserId, {
        year: 2026,
        quotas: [
          { leave_type: LEAVE_TYPES.SICK, total_hours: usedHours - 1 },
        ],
      });

      // THEN
      expect(res.status()).toBe(422);
      const body = await res.json();
      expect(body.code).toBe('QUOTA_BELOW_USED');
    });

    test('Scenario: 非 Admin 設定額度 - 403', async ({ request }) => {
      // WHEN - Manager 嘗試設定額度
      const res = await setEmployeeQuotas(request, managerToken, employeeUserId, {
        year: 2026,
        quotas: [
          { leave_type: LEAVE_TYPES.ANNUAL, total_hours: 80.0 },
        ],
      });

      // THEN
      expect(res.status()).toBe(403);
      const body = await res.json();
      expect(body.code).toBe('FORBIDDEN');
    });
  });

  // =============================================
  // Edge Cases
  // =============================================
  test.describe('Edge Cases', () => {
    test('Scenario: 新員工自動產生額度', async ({ request }) => {
      test.skip(!testDeptId, '無可用部門');

      const ts = Date.now();
      const email = `new-emp-quota-${ts}@company.com`;

      // GIVEN - Admin 建立新員工
      const createRes = await createEmployee(request, adminToken, {
        employee_id: `QUOTA-${ts}`,
        email,
        password: 'NewEmpQuota123!',
        name: '額度測試新員工',
        role: 'employee',
        department_id: testDeptId,
        hire_date: '2026-04-07',
      });
      expect(createRes.status()).toBe(201);

      // 新員工登入
      const loginRes = await request.post(API.AUTH.LOGIN, {
        data: { email, password: 'NewEmpQuota123!' },
      });
      expect(loginRes.status()).toBe(200);
      const newEmpToken = (await loginRes.json()).access_token;

      // THEN - 系統應自動建立 2026 年度所有假別額度
      const quotaRes = await getMyQuotas(request, newEmpToken, 2026);
      expect(quotaRes.status()).toBe(200);
      const body = await quotaRes.json();
      expect(body.quotas.length).toBeGreaterThan(0);

      // AND 應包含常見假別
      const leaveTypes = body.quotas.map((q: any) => q.leave_type);
      expect(leaveTypes).toContain(LEAVE_TYPES.ANNUAL);
      expect(leaveTypes).toContain(LEAVE_TYPES.PERSONAL);
      expect(leaveTypes).toContain(LEAVE_TYPES.SICK);
    });

    test('Scenario: 查看往年額度 - 200', async ({ request }) => {
      // WHEN
      const res = await getMyQuotas(request, employeeToken, 2025);

      // THEN
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body).toHaveProperty('year', 2025);
      expect(body).toHaveProperty('quotas');
      // 往年額度可能為空陣列（如果沒有設定過）或有資料
      expect(Array.isArray(body.quotas)).toBe(true);
    });
  });
});
