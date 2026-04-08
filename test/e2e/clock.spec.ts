import { test, expect } from '@playwright/test';
import {
  loginAsEmployee,
  loginAsAdmin,
  createDepartment,
  createEmployee,
  authHeaders,
} from '../helpers/api-client';
import { API } from '../helpers/test-data';

const FEATURE = 'F-001';

test.describe(`[${FEATURE}] 打卡 - API E2E`, () => {
  /**
   * 每個 test 使用獨立的員工帳號以確保測試隔離
   * 避免打卡狀態在 test 之間互相影響
   */
  let adminToken: string;
  let testDeptId: string;

  test.beforeAll(async ({ request }) => {
    const adminLogin = await loginAsAdmin(request);
    adminToken = adminLogin.access_token;

    // 建立打卡測試專用部門
    const deptRes = await createDepartment(request, adminToken, {
      name: `打卡測試部-${Date.now()}`,
      code: `CLK-${Date.now()}`,
    });
    if (deptRes.ok()) {
      const dept = await deptRes.json();
      testDeptId = dept.id;
    }
  });

  /** 建立獨立的測試員工並登入，回傳 access_token */
  async function createAndLoginEmployee(
    request: any,
    suffix: string,
  ): Promise<string> {
    const ts = Date.now();
    const email = `clock-${suffix}-${ts}@company.com`;
    const password = 'ClockTest123!';

    const createRes = await createEmployee(request, adminToken, {
      employee_id: `CLK-${suffix}-${ts}`,
      email,
      password,
      name: `打卡測試-${suffix}`,
      role: 'employee',
      department_id: testDeptId,
      hire_date: '2026-01-01',
    });
    expect(createRes.status()).toBe(201);

    const loginRes = await request.post(API.AUTH.LOGIN, {
      data: { email, password },
    });
    expect(loginRes.status()).toBe(200);
    const body = await loginRes.json();
    return body.access_token;
  }

  // =============================================
  // Happy Path
  // =============================================
  test.describe('Happy Path', () => {
    test('Scenario: 上班打卡成功 - 201 + clock_in 有值', async ({ request }) => {
      test.skip(!testDeptId, '無可用部門');
      const token = await createAndLoginEmployee(request, 'in');

      // WHEN
      const res = await request.post(API.CLOCK.IN, {
        headers: authHeaders(token),
      });

      // THEN
      expect(res.status()).toBe(201);
      const body = await res.json();
      expect(body).toHaveProperty('id');
      expect(body).toHaveProperty('date');
      expect(body).toHaveProperty('clock_in');
      expect(body.clock_in).not.toBeNull();
      expect(body.clock_out).toBeNull();
    });

    test('Scenario: 下班打卡成功 - 200 + clock_out 有值 + status 自動計算', async ({ request }) => {
      test.skip(!testDeptId, '無可用部門');
      const token = await createAndLoginEmployee(request, 'out');

      // GIVEN - 先打上班卡
      const clockInRes = await request.post(API.CLOCK.IN, {
        headers: authHeaders(token),
      });
      expect(clockInRes.status()).toBe(201);

      // WHEN
      const res = await request.post(API.CLOCK.OUT, {
        headers: authHeaders(token),
      });

      // THEN
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body).toHaveProperty('clock_out');
      expect(body.clock_out).not.toBeNull();
      expect(body).toHaveProperty('status');
      expect(['normal', 'late', 'early_leave']).toContain(body.status);
    });

    test('Scenario: 查詢今日打卡狀態 - 200', async ({ request }) => {
      test.skip(!testDeptId, '無可用部門');
      const token = await createAndLoginEmployee(request, 'today');

      // GIVEN - 打上班卡
      await request.post(API.CLOCK.IN, {
        headers: authHeaders(token),
      });

      // WHEN
      const res = await request.get(API.CLOCK.TODAY, {
        headers: authHeaders(token),
      });

      // THEN
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body).toHaveProperty('date');
      expect(body).toHaveProperty('clock_in');
      expect(body.clock_in).not.toBeNull();
      expect(body).toHaveProperty('status');
    });

    test('Scenario: 查詢月份打卡紀錄 - 200 + 分頁', async ({ request }) => {
      test.skip(!testDeptId, '無可用部門');
      const token = await createAndLoginEmployee(request, 'records');

      // GIVEN - 打一張卡產生紀錄
      await request.post(API.CLOCK.IN, {
        headers: authHeaders(token),
      });

      // WHEN
      const today = new Date();
      const startDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
      const endDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()).padStart(2, '0')}`;

      const res = await request.get(
        `${API.CLOCK.RECORDS}?start_date=${startDate}&end_date=${endDate}`,
        { headers: authHeaders(token) },
      );

      // THEN
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body).toHaveProperty('data');
      expect(Array.isArray(body.data)).toBe(true);
      expect(body).toHaveProperty('meta');
      expect(body.meta).toHaveProperty('total');
      expect(body.meta).toHaveProperty('page');
      expect(body.meta).toHaveProperty('limit');
      expect(body.meta).toHaveProperty('totalPages');
    });

    test('Scenario: 上班打卡帶備註 - 201 + note', async ({ request }) => {
      test.skip(!testDeptId, '無可用部門');
      const token = await createAndLoginEmployee(request, 'note');
      const note = '外出開會晚到';

      // WHEN
      const res = await request.post(API.CLOCK.IN, {
        data: { note },
        headers: authHeaders(token),
      });

      // THEN
      expect(res.status()).toBe(201);
      const body = await res.json();
      expect(body.note).toBe(note);
    });
  });

  // =============================================
  // Error Handling
  // =============================================
  test.describe('Error Handling', () => {
    test('Scenario: 重複上班打卡 - 409 ALREADY_CLOCKED_IN', async ({ request }) => {
      test.skip(!testDeptId, '無可用部門');
      const token = await createAndLoginEmployee(request, 'dup-in');

      // GIVEN - 已打上班卡
      const firstRes = await request.post(API.CLOCK.IN, {
        headers: authHeaders(token),
      });
      expect(firstRes.status()).toBe(201);

      // WHEN - 再打一次
      const res = await request.post(API.CLOCK.IN, {
        headers: authHeaders(token),
      });

      // THEN
      expect(res.status()).toBe(409);
      const body = await res.json();
      expect(body.code).toBe('ALREADY_CLOCKED_IN');
    });

    test('Scenario: 未打上班卡就打下班卡 - 422 NOT_CLOCKED_IN', async ({ request }) => {
      test.skip(!testDeptId, '無可用部門');
      const token = await createAndLoginEmployee(request, 'no-in');

      // WHEN - 直接打下班卡
      const res = await request.post(API.CLOCK.OUT, {
        headers: authHeaders(token),
      });

      // THEN
      expect(res.status()).toBe(422);
      const body = await res.json();
      expect(body.code).toBe('NOT_CLOCKED_IN');
    });

    test('Scenario: 重複下班打卡 - 409 ALREADY_CLOCKED_OUT', async ({ request }) => {
      test.skip(!testDeptId, '無可用部門');
      const token = await createAndLoginEmployee(request, 'dup-out');

      // GIVEN - 完成上班+下班打卡
      await request.post(API.CLOCK.IN, { headers: authHeaders(token) });
      const firstOut = await request.post(API.CLOCK.OUT, { headers: authHeaders(token) });
      expect(firstOut.status()).toBe(200);

      // WHEN - 再打一次下班
      const res = await request.post(API.CLOCK.OUT, {
        headers: authHeaders(token),
      });

      // THEN
      expect(res.status()).toBe(409);
      const body = await res.json();
      expect(body.code).toBe('ALREADY_CLOCKED_OUT');
    });

    test('Scenario: 未認證存取 - 401 UNAUTHORIZED', async ({ request }) => {
      // WHEN - 不帶 token
      const res = await request.post(API.CLOCK.IN);

      // THEN
      expect(res.status()).toBe(401);
      const body = await res.json();
      expect(body.code).toBe('UNAUTHORIZED');
    });
  });

  // =============================================
  // Edge Cases
  // =============================================
  test.describe('Edge Cases', () => {
    test('Scenario: 今日無打卡紀錄時查詢 - 200 + 欄位為 null', async ({ request }) => {
      test.skip(!testDeptId, '無可用部門');
      const token = await createAndLoginEmployee(request, 'no-record');

      // WHEN - 新帳號查詢今日狀態（尚未打卡）
      const res = await request.get(API.CLOCK.TODAY, {
        headers: authHeaders(token),
      });

      // THEN
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body).toHaveProperty('date');
      expect(body.clock_in).toBeNull();
      expect(body.clock_out).toBeNull();
      expect(body.status).toBeNull();
    });

    test('Scenario: 查詢日期範圍超過 90 天 - 400', async ({ request }) => {
      test.skip(!testDeptId, '無可用部門');
      const token = await createAndLoginEmployee(request, 'range');

      // WHEN - 查詢超過 90 天
      const res = await request.get(
        `${API.CLOCK.RECORDS}?start_date=2026-01-01&end_date=2026-06-30`,
        { headers: authHeaders(token) },
      );

      // THEN
      expect(res.status()).toBe(400);
      const body = await res.json();
      expect(body.code).toBe('INVALID_INPUT');
    });
  });
});
