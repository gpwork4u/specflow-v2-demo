import { test, expect } from '@playwright/test';
import {
  loginAsAdmin,
  loginAsEmployee,
  loginAsManager,
  login,
  authHeaders,
  createEmployee,
  createOvertime,
  createOvertimeAndGetId,
  getOvertimes,
  cancelOvertime,
  getPendingOvertimes,
  approveOvertime,
  rejectOvertime,
} from '../helpers/api-client';
import {
  API,
  MANAGER_USER,
  futureDate,
  pastDate,
  todayDate,
} from '../helpers/test-data';

const FEATURE = 'F-006';

test.describe(`[${FEATURE}] 加班申請 - API E2E`, () => {
  let adminToken: string;
  let managerToken: string;
  let managerUserId: string;
  let testDeptId: string;

  test.beforeAll(async ({ request }) => {
    const adminLogin = await loginAsAdmin(request);
    adminToken = adminLogin.access_token;

    const mgrLogin = await loginAsManager(request);
    managerToken = mgrLogin.access_token;
    managerUserId = mgrLogin.user.id;

    // 取得測試部門
    const deptRes = await request.get(API.DEPARTMENTS, {
      headers: authHeaders(adminToken),
    });
    const depts = await deptRes.json();
    testDeptId = depts.data?.[0]?.id;
  });

  /**
   * 建立獨立的測試員工並登入
   */
  async function createTestEmployee(
    request: any,
    suffix: string,
  ): Promise<{ token: string; userId: string }> {
    const ts = Date.now();
    const email = `ot-${suffix}-${ts}@company.com`;
    const password = 'OTTest123!';

    const createRes = await createEmployee(request, adminToken, {
      employee_id: `OT-${suffix}-${ts}`,
      email,
      password,
      name: `加班測試-${suffix}`,
      role: 'employee',
      department_id: testDeptId,
      hire_date: '2024-01-01',
      manager_id: managerUserId,
    });
    expect(createRes.status()).toBe(201);
    const empBody = await createRes.json();

    const loginRes = await request.post(API.AUTH.LOGIN, {
      data: { email, password },
    });
    expect(loginRes.status()).toBe(200);
    const loginBody = await loginRes.json();
    return { token: loginBody.access_token, userId: empBody.id };
  }

  // ===========================================
  // Happy Path
  // ===========================================

  test.describe('Happy Path', () => {
    test('Scenario: 申請加班成功', async ({ request }) => {
      // GIVEN 使用者已登入
      const { token } = await createTestEmployee(request, 'create');

      // WHEN POST /api/v1/overtime
      const res = await createOvertime(request, token, {
        date: todayDate(),
        start_time: '18:00',
        end_time: '21:00',
        reason: '趕專案 deadline',
      });

      // THEN response status = 201
      expect(res.status()).toBe(201);
      const body = await res.json();
      expect(body).toMatchObject({
        id: expect.any(String),
        date: todayDate(),
        start_time: '18:00',
        end_time: '21:00',
        hours: 3.0,
        reason: '趕專案 deadline',
        status: 'pending',
      });
      expect(body.reviewer_id).toBeNull();
      expect(body.reviewed_at).toBeNull();
    });

    test('Scenario: 核准加班', async ({ request }) => {
      // GIVEN 部屬建立一筆 pending 加班申請
      const { token: empToken } = await createTestEmployee(request, 'approve');
      const overtimeId = await createOvertimeAndGetId(request, empToken, {
        date: todayDate(),
        start_time: '18:00',
        end_time: '21:00',
        reason: '加班測試-核准',
      });

      // WHEN 主管核准
      const res = await approveOvertime(request, managerToken, overtimeId);

      // THEN response status = 200, status = "approved"
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.status).toBe('approved');
    });

    test('Scenario: 駁回加班（需填原因）', async ({ request }) => {
      // GIVEN 部屬建立一筆 pending 加班申請
      const { token: empToken } = await createTestEmployee(request, 'reject');
      const overtimeId = await createOvertimeAndGetId(request, empToken, {
        date: todayDate(),
        start_time: '18:00',
        end_time: '20:00',
        reason: '加班測試-駁回',
      });

      // WHEN 主管駁回
      const res = await rejectOvertime(
        request,
        managerToken,
        overtimeId,
        '加班理由不充分',
      );

      // THEN response status = 200, status = "rejected"
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.status).toBe('rejected');
    });

    test('Scenario: 查詢個人加班紀錄', async ({ request }) => {
      // GIVEN 員工已有加班紀錄
      const { token } = await createTestEmployee(request, 'list');
      await createOvertime(request, token, {
        date: todayDate(),
        start_time: '18:00',
        end_time: '20:00',
        reason: '查詢測試',
      });

      // WHEN GET /api/v1/overtime
      const res = await getOvertimes(request, token);

      // THEN 回傳分頁結果
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.data).toBeInstanceOf(Array);
      expect(body.data.length).toBeGreaterThanOrEqual(1);
      expect(body.meta).toMatchObject({
        total: expect.any(Number),
        page: 1,
        limit: 20,
      });
    });

    test('Scenario: 取消加班申請', async ({ request }) => {
      // GIVEN 員工有一筆 pending 加班
      const { token } = await createTestEmployee(request, 'cancel');
      const overtimeId = await createOvertimeAndGetId(request, token, {
        date: todayDate(),
        start_time: '18:00',
        end_time: '20:00',
        reason: '取消測試',
      });

      // WHEN PUT /api/v1/overtime/:id/cancel
      const res = await cancelOvertime(request, token, overtimeId);

      // THEN status = "cancelled"
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.status).toBe('cancelled');
    });

    test('Scenario: 主管查看待審核加班清單', async ({ request }) => {
      // GIVEN 部屬建立加班申請
      const { token: empToken } = await createTestEmployee(request, 'pending-list');
      await createOvertime(request, empToken, {
        date: todayDate(),
        start_time: '19:00',
        end_time: '21:00',
        reason: '待審核清單測試',
      });

      // WHEN 主管查看待審核清單
      const res = await getPendingOvertimes(request, managerToken);

      // THEN 回傳待審核列表
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.data).toBeInstanceOf(Array);
      expect(body.data.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ===========================================
  // Error Handling
  // ===========================================

  test.describe('Error Handling', () => {
    test('Scenario: 同日重複申請', async ({ request }) => {
      // GIVEN 使用者在今天已有 pending 加班
      const { token } = await createTestEmployee(request, 'dup');
      await createOvertime(request, token, {
        date: todayDate(),
        start_time: '18:00',
        end_time: '20:00',
        reason: '第一次加班',
      });

      // WHEN 同日再次申請
      const res = await createOvertime(request, token, {
        date: todayDate(),
        start_time: '20:00',
        end_time: '22:00',
        reason: '第二次加班',
      });

      // THEN 409 DATE_CONFLICT
      expect(res.status()).toBe(409);
      const body = await res.json();
      expect(body.code).toBe('DATE_CONFLICT');
    });

    test('Scenario: 單次加班超過 12 小時', async ({ request }) => {
      const { token } = await createTestEmployee(request, 'over12');

      // WHEN 申請 13 小時加班（18:00 - 07:00 次日）
      const res = await createOvertime(request, token, {
        date: todayDate(),
        start_time: '18:00',
        end_time: '07:00',
        reason: '超長加班',
      });

      // THEN 422 INVALID_TIME_RANGE
      expect(res.status()).toBe(422);
      const body = await res.json();
      expect(body.code).toBe('INVALID_TIME_RANGE');
    });

    test('Scenario: end_time <= start_time', async ({ request }) => {
      const { token } = await createTestEmployee(request, 'bad-time');

      // WHEN end_time <= start_time
      const res = await createOvertime(request, token, {
        date: todayDate(),
        start_time: '21:00',
        end_time: '18:00',
        reason: '時間倒轉',
      });

      // THEN 422 INVALID_TIME_RANGE
      expect(res.status()).toBe(422);
      const body = await res.json();
      expect(body.code).toBe('INVALID_TIME_RANGE');
    });

    test('Scenario: 未授權存取', async ({ request }) => {
      // WHEN 沒有 token
      const res = await request.post(API.OVERTIME.BASE, {
        data: {
          date: todayDate(),
          start_time: '18:00',
          end_time: '20:00',
          reason: 'test',
        },
      });

      // THEN 401
      expect(res.status()).toBe(401);
    });

    test('Scenario: 欄位格式不正確（缺 reason）', async ({ request }) => {
      const { token } = await createTestEmployee(request, 'invalid');

      const res = await request.post(API.OVERTIME.BASE, {
        data: {
          date: todayDate(),
          start_time: '18:00',
          end_time: '20:00',
          // reason 缺失
        },
        headers: authHeaders(token),
      });

      // THEN 400 INVALID_INPUT
      expect(res.status()).toBe(400);
      const body = await res.json();
      expect(body.code).toBe('INVALID_INPUT');
    });

    test('Scenario: 取消非 pending 狀態的加班', async ({ request }) => {
      // GIVEN 加班已被核准
      const { token: empToken } = await createTestEmployee(request, 'cancel-approved');
      const overtimeId = await createOvertimeAndGetId(request, empToken, {
        date: todayDate(),
        start_time: '18:00',
        end_time: '20:00',
        reason: '將被核准',
      });
      await approveOvertime(request, managerToken, overtimeId);

      // WHEN 嘗試取消
      const res = await cancelOvertime(request, empToken, overtimeId);

      // THEN 422 CANNOT_CANCEL
      expect(res.status()).toBe(422);
      const body = await res.json();
      expect(body.code).toBe('CANNOT_CANCEL');
    });

    test('Scenario: 取消他人的加班申請', async ({ request }) => {
      // GIVEN 員工 A 建立加班
      const { token: tokenA } = await createTestEmployee(request, 'cancel-a');
      const overtimeId = await createOvertimeAndGetId(request, tokenA, {
        date: todayDate(),
        start_time: '18:00',
        end_time: '20:00',
        reason: 'A 的加班',
      });

      // WHEN 員工 B 嘗試取消
      const { token: tokenB } = await createTestEmployee(request, 'cancel-b');
      const res = await cancelOvertime(request, tokenB, overtimeId);

      // THEN 403 FORBIDDEN
      expect(res.status()).toBe(403);
      const body = await res.json();
      expect(body.code).toBe('FORBIDDEN');
    });
  });

  // ===========================================
  // Edge Cases
  // ===========================================

  test.describe('Edge Cases', () => {
    test('Scenario: 事後補申請加班（7 天內）', async ({ request }) => {
      const { token } = await createTestEmployee(request, 'retro');
      const retroDate = pastDate(3); // 3 天前

      // WHEN 補申請 3 天前的加班
      const res = await createOvertime(request, token, {
        date: retroDate,
        start_time: '18:00',
        end_time: '21:00',
        reason: '補申請加班',
      });

      // THEN 201 成功
      expect(res.status()).toBe(201);
    });

    test('Scenario: 事後補申請超過 7 天', async ({ request }) => {
      const { token } = await createTestEmployee(request, 'retro-old');
      const oldDate = pastDate(8); // 8 天前

      // WHEN 補申請 8 天前的加班
      const res = await createOvertime(request, token, {
        date: oldDate,
        start_time: '18:00',
        end_time: '21:00',
        reason: '太晚補申請',
      });

      // THEN 422 PAST_DATE
      expect(res.status()).toBe(422);
      const body = await res.json();
      expect(body.code).toBe('PAST_DATE');
    });

    test('Scenario: 加班時數非整數（進位到 0.5）', async ({ request }) => {
      const { token } = await createTestEmployee(request, 'half-hour');

      // WHEN 18:00-19:20 = 1 小時 20 分鐘
      const res = await createOvertime(request, token, {
        date: todayDate(),
        start_time: '18:00',
        end_time: '19:20',
        reason: '零散時間加班',
      });

      // THEN hours = 1.5（進位到 0.5）
      expect(res.status()).toBe(201);
      const body = await res.json();
      expect(body.hours).toBe(1.5);
    });

    test('Scenario: 篩選特定狀態的加班紀錄', async ({ request }) => {
      const { token } = await createTestEmployee(request, 'filter');
      await createOvertime(request, token, {
        date: todayDate(),
        start_time: '18:00',
        end_time: '20:00',
        reason: '篩選測試',
      });

      // WHEN 篩選 pending 狀態
      const res = await getOvertimes(request, token, { status: 'pending' });

      // THEN 只回傳 pending 的紀錄
      expect(res.status()).toBe(200);
      const body = await res.json();
      for (const item of body.data) {
        expect(item.status).toBe('pending');
      }
    });

    test('Scenario: 駁回加班不填原因應失敗', async ({ request }) => {
      // GIVEN 部屬建立加班
      const { token: empToken } = await createTestEmployee(request, 'reject-no-comment');
      const overtimeId = await createOvertimeAndGetId(request, empToken, {
        date: todayDate(),
        start_time: '18:00',
        end_time: '20:00',
        reason: '駁回無原因測試',
      });

      // WHEN 主管駁回不填原因
      const res = await request.put(
        `${API.OVERTIME.BASE}/${overtimeId}/reject`,
        {
          data: {},
          headers: authHeaders(managerToken),
        },
      );

      // THEN 400 INVALID_INPUT
      expect(res.status()).toBe(400);
    });
  });
});
