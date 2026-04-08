import { test, expect } from '@playwright/test';
import {
  loginAsAdmin,
  loginAsManager,
  authHeaders,
  createEmployee,
  createMissedClock,
  createMissedClockAndGetId,
  getMissedClocks,
  getPendingMissedClocks,
  approveMissedClock,
  rejectMissedClock,
} from '../helpers/api-client';
import {
  API,
  MANAGER_USER,
  pastDate,
  todayDate,
} from '../helpers/test-data';

const FEATURE = 'F-010';

test.describe(`[${FEATURE}] 補打卡申請 - API E2E`, () => {
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
    const email = `mc-${suffix}-${ts}@company.com`;
    const password = 'MCTest123!';

    const createRes = await createEmployee(request, adminToken, {
      employee_id: `MC-${suffix}-${ts}`,
      email,
      password,
      name: `補打卡測試-${suffix}`,
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

  /** 產生昨天的 datetime（用於 requested_time） */
  function yesterdayClockTime(hour: number): string {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    d.setHours(hour, 0, 0, 0);
    return d.toISOString().replace(/\.\d+Z$/, 'Z');
  }

  // ===========================================
  // Happy Path
  // ===========================================

  test.describe('Happy Path', () => {
    test('Scenario: 申請補上班打卡', async ({ request }) => {
      // GIVEN 使用者昨天忘記打上班卡
      const { token } = await createTestEmployee(request, 'clock-in');
      const yesterday = pastDate(1);

      // WHEN POST /api/v1/missed-clocks
      const res = await createMissedClock(request, token, {
        date: yesterday,
        clock_type: 'clock_in',
        requested_time: yesterdayClockTime(1), // UTC 01:00 = TW 09:00
        reason: '忘記打卡，當日 9:00 已到辦公室',
      });

      // THEN response status = 201, status = "pending"
      expect(res.status()).toBe(201);
      const body = await res.json();
      expect(body).toMatchObject({
        id: expect.any(String),
        date: yesterday,
        clock_type: 'clock_in',
        status: 'pending',
        reason: expect.any(String),
      });
      expect(body.reviewer_id).toBeNull();
    });

    test('Scenario: 核准補上班打卡', async ({ request }) => {
      // GIVEN 部屬申請補上班卡
      const { token: empToken } = await createTestEmployee(request, 'approve-in');
      const yesterday = pastDate(1);
      const requestedTime = yesterdayClockTime(1);

      const mcId = await createMissedClockAndGetId(request, empToken, {
        date: yesterday,
        clock_type: 'clock_in',
        requested_time: requestedTime,
        reason: '忘記打上班卡',
      });

      // WHEN 主管核准
      const res = await approveMissedClock(request, managerToken, mcId, '核准');

      // THEN response status = 200, status = "approved"
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.status).toBe('approved');
      expect(body.reviewer).toBeDefined();
      expect(body.reviewed_at).toBeDefined();
    });

    test('Scenario: 核准補下班卡', async ({ request }) => {
      // GIVEN 員工有打上班卡但忘了打下班卡，申請補下班卡
      const { token: empToken } = await createTestEmployee(request, 'approve-out');
      const yesterday = pastDate(1);

      // 先打上班卡（透過補打卡模擬已有上班紀錄）
      // 直接申請補下班卡
      const mcId = await createMissedClockAndGetId(request, empToken, {
        date: yesterday,
        clock_type: 'clock_out',
        requested_time: yesterdayClockTime(10), // UTC 10:00 = TW 18:00
        reason: '忘記打下班卡',
      });

      // WHEN 主管核准
      const res = await approveMissedClock(request, managerToken, mcId);

      // THEN status = "approved"
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.status).toBe('approved');
    });

    test('Scenario: 查詢個人補打卡紀錄', async ({ request }) => {
      const { token } = await createTestEmployee(request, 'list');
      const yesterday = pastDate(1);

      await createMissedClock(request, token, {
        date: yesterday,
        clock_type: 'clock_in',
        requested_time: yesterdayClockTime(1),
        reason: '查詢測試',
      });

      // WHEN GET /api/v1/missed-clocks
      const res = await getMissedClocks(request, token);

      // THEN 回傳分頁結果
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.data).toBeInstanceOf(Array);
      expect(body.data.length).toBeGreaterThanOrEqual(1);
      expect(body.meta).toBeDefined();
    });

    test('Scenario: 主管查看待審核補打卡清單', async ({ request }) => {
      const { token: empToken } = await createTestEmployee(request, 'pending-list');
      const yesterday = pastDate(1);

      await createMissedClock(request, empToken, {
        date: yesterday,
        clock_type: 'clock_in',
        requested_time: yesterdayClockTime(1),
        reason: '待審核清單測試',
      });

      // WHEN 主管查看
      const res = await getPendingMissedClocks(request, managerToken);

      // THEN 回傳待審核列表
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.data).toBeInstanceOf(Array);
      expect(body.data.length).toBeGreaterThanOrEqual(1);
    });

    test('Scenario: 駁回補打卡（需填原因）', async ({ request }) => {
      const { token: empToken } = await createTestEmployee(request, 'reject');
      const yesterday = pastDate(1);

      const mcId = await createMissedClockAndGetId(request, empToken, {
        date: yesterday,
        clock_type: 'clock_in',
        requested_time: yesterdayClockTime(1),
        reason: '駁回測試',
      });

      // WHEN 主管駁回
      const res = await rejectMissedClock(
        request,
        managerToken,
        mcId,
        '時間不合理，請確認',
      );

      // THEN status = "rejected"
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.status).toBe('rejected');
    });
  });

  // ===========================================
  // Error Handling
  // ===========================================

  test.describe('Error Handling', () => {
    test('Scenario: 超過 7 天前', async ({ request }) => {
      const { token } = await createTestEmployee(request, 'past');

      // WHEN 申請 8 天前
      const res = await createMissedClock(request, token, {
        date: pastDate(8),
        clock_type: 'clock_in',
        requested_time: new Date(Date.now() - 8 * 86400000).toISOString().replace(/\.\d+Z$/, 'Z'),
        reason: '太久前的打卡',
      });

      // THEN 422 PAST_DATE
      expect(res.status()).toBe(422);
      const body = await res.json();
      expect(body.code).toBe('PAST_DATE');
    });

    test('Scenario: 重複申請（同日同類型已有 pending）', async ({ request }) => {
      const { token } = await createTestEmployee(request, 'dup');
      const yesterday = pastDate(1);

      // 第一次申請
      const first = await createMissedClock(request, token, {
        date: yesterday,
        clock_type: 'clock_in',
        requested_time: yesterdayClockTime(1),
        reason: '第一次',
      });
      expect(first.status()).toBe(201);

      // WHEN 同日同類型再次申請
      const res = await createMissedClock(request, token, {
        date: yesterday,
        clock_type: 'clock_in',
        requested_time: yesterdayClockTime(2),
        reason: '第二次',
      });

      // THEN 409 ALREADY_EXISTS
      expect(res.status()).toBe(409);
      const body = await res.json();
      expect(body.code).toBe('ALREADY_EXISTS');
    });

    test('Scenario: 未授權存取', async ({ request }) => {
      const res = await request.post(API.MISSED_CLOCKS.BASE, {
        data: {
          date: pastDate(1),
          clock_type: 'clock_in',
          requested_time: yesterdayClockTime(1),
          reason: 'test',
        },
      });

      // THEN 401
      expect(res.status()).toBe(401);
    });

    test('Scenario: 欄位格式不正確（缺 reason）', async ({ request }) => {
      const { token } = await createTestEmployee(request, 'invalid');

      const res = await request.post(API.MISSED_CLOCKS.BASE, {
        data: {
          date: pastDate(1),
          clock_type: 'clock_in',
          requested_time: yesterdayClockTime(1),
          // reason 缺失
        },
        headers: authHeaders(token),
      });

      // THEN 400 INVALID_INPUT
      expect(res.status()).toBe(400);
      const body = await res.json();
      expect(body.code).toBe('INVALID_INPUT');
    });

    test('Scenario: 駁回不填原因應失敗', async ({ request }) => {
      const { token: empToken } = await createTestEmployee(request, 'reject-no-comment');
      const yesterday = pastDate(1);

      const mcId = await createMissedClockAndGetId(request, empToken, {
        date: yesterday,
        clock_type: 'clock_in',
        requested_time: yesterdayClockTime(1),
        reason: '駁回無原因測試',
      });

      // WHEN 主管駁回不填原因
      const res = await request.put(
        `${API.MISSED_CLOCKS.BASE}/${mcId}/reject`,
        {
          data: {},
          headers: authHeaders(managerToken),
        },
      );

      // THEN 400
      expect(res.status()).toBe(400);
    });

    test('Scenario: 審核不存在的補打卡', async ({ request }) => {
      const res = await approveMissedClock(
        request,
        managerToken,
        '00000000-0000-0000-0000-000000000000',
      );

      // THEN 404
      expect(res.status()).toBe(404);
      const body = await res.json();
      expect(body.code).toBe('NOT_FOUND');
    });

    test('Scenario: 審核非 pending 狀態的補打卡', async ({ request }) => {
      // GIVEN 已核准的補打卡
      const { token: empToken } = await createTestEmployee(request, 'not-pending');
      const yesterday = pastDate(1);

      const mcId = await createMissedClockAndGetId(request, empToken, {
        date: yesterday,
        clock_type: 'clock_in',
        requested_time: yesterdayClockTime(1),
        reason: '已核准測試',
      });
      await approveMissedClock(request, managerToken, mcId);

      // WHEN 再次核准
      const res = await approveMissedClock(request, managerToken, mcId);

      // THEN 422 NOT_PENDING
      expect(res.status()).toBe(422);
      const body = await res.json();
      expect(body.code).toBe('NOT_PENDING');
    });
  });

  // ===========================================
  // Edge Cases
  // ===========================================

  test.describe('Edge Cases', () => {
    test('Scenario: 同天補上班卡和下班卡（不同 clock_type 不衝突）', async ({ request }) => {
      const { token } = await createTestEmployee(request, 'both');
      const yesterday = pastDate(1);

      // WHEN 補上班卡
      const res1 = await createMissedClock(request, token, {
        date: yesterday,
        clock_type: 'clock_in',
        requested_time: yesterdayClockTime(1),
        reason: '補上班卡',
      });
      expect(res1.status()).toBe(201);

      // AND 補下班卡
      const res2 = await createMissedClock(request, token, {
        date: yesterday,
        clock_type: 'clock_out',
        requested_time: yesterdayClockTime(10),
        reason: '補下班卡',
      });

      // THEN 兩筆都成功
      expect(res2.status()).toBe(201);
    });

    test('Scenario: 補打卡時間不合理（凌晨 3 點上班），系統不阻擋', async ({ request }) => {
      const { token } = await createTestEmployee(request, 'unreasonable');
      const yesterday = pastDate(1);

      // WHEN 凌晨 3 點上班（UTC 19:00 前一天）
      const d = new Date();
      d.setDate(d.getDate() - 2);
      d.setHours(19, 0, 0, 0);
      const unreasonableTime = d.toISOString().replace(/\.\d+Z$/, 'Z');

      const res = await createMissedClock(request, token, {
        date: yesterday,
        clock_type: 'clock_in',
        requested_time: unreasonableTime,
        reason: '當日特殊班次',
      });

      // THEN 201 成功（系統不阻擋，由主管判斷）
      expect(res.status()).toBe(201);
    });

    test('Scenario: 篩選特定狀態的補打卡紀錄', async ({ request }) => {
      const { token } = await createTestEmployee(request, 'filter');
      const yesterday = pastDate(1);

      await createMissedClock(request, token, {
        date: yesterday,
        clock_type: 'clock_in',
        requested_time: yesterdayClockTime(1),
        reason: '篩選測試',
      });

      // WHEN 篩選 pending
      const res = await getMissedClocks(request, token, { status: 'pending' });

      // THEN 只回傳 pending
      expect(res.status()).toBe(200);
      const body = await res.json();
      for (const item of body.data) {
        expect(item.status).toBe('pending');
      }
    });
  });
});
