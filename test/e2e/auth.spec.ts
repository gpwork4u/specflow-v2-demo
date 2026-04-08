import { test, expect } from '@playwright/test';
import {
  login,
  loginAsAdmin,
  loginAsEmployee,
  refreshToken,
  logout,
  getMe,
  changePassword,
  authHeaders,
} from '../helpers/api-client';
import {
  API,
  ADMIN_USER,
  EMPLOYEE_USER,
  SUSPENDED_USER,
  LOCKOUT_USER,
  PASSWORDS,
} from '../helpers/test-data';

const FEATURE = 'F-000';

test.describe(`[${FEATURE}] 認證系統 - API E2E`, () => {
  // =============================================
  // Happy Path
  // =============================================
  test.describe('Happy Path', () => {
    test('Scenario: 登入成功 - 200 + access_token + refresh_token + user', async ({ request }) => {
      // WHEN
      const res = await request.post(API.AUTH.LOGIN, {
        data: {
          email: EMPLOYEE_USER.email,
          password: EMPLOYEE_USER.password,
        },
      });

      // THEN
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body).toHaveProperty('access_token');
      expect(body).toHaveProperty('refresh_token');
      expect(body).toHaveProperty('token_type', 'Bearer');
      expect(body).toHaveProperty('expires_in', 86400);
      expect(body).toHaveProperty('user');
      expect(body.user).toHaveProperty('id');
      expect(body.user).toHaveProperty('email', EMPLOYEE_USER.email);
      expect(body.user).toHaveProperty('name');
      expect(body.user).toHaveProperty('role');
      expect(body.user).toHaveProperty('department');
    });

    test('Scenario: 取得個人資料 - 200 + user profile（含 department, manager）', async ({ request }) => {
      // GIVEN
      const loginRes = await loginAsEmployee(request);

      // WHEN
      const res = await getMe(request, loginRes.access_token);

      // THEN
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body).toHaveProperty('id');
      expect(body).toHaveProperty('email', EMPLOYEE_USER.email);
      expect(body).toHaveProperty('name');
      expect(body).toHaveProperty('role');
      expect(body).toHaveProperty('department');
      expect(body).toHaveProperty('status', 'active');
      // department 應為物件，含 id 和 name
      expect(body.department).toHaveProperty('id');
      expect(body.department).toHaveProperty('name');
    });

    test('Scenario: 刷新 Token - 200 + 新 tokens，舊 refresh_token 失效', async ({ request }) => {
      // GIVEN
      const loginRes = await loginAsEmployee(request);
      const oldRefreshToken = loginRes.refresh_token;

      // WHEN
      const res = await refreshToken(request, oldRefreshToken);

      // THEN
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body).toHaveProperty('access_token');
      expect(body).toHaveProperty('refresh_token');
      expect(body).toHaveProperty('token_type', 'Bearer');
      expect(body).toHaveProperty('expires_in', 86400);

      // AND 舊的 refresh_token 應失效
      const oldRefreshRes = await refreshToken(request, oldRefreshToken);
      expect(oldRefreshRes.status()).toBe(401);
    });

    test('Scenario: 登出成功 - 204，refresh_token 失效', async ({ request }) => {
      // GIVEN
      const loginRes = await loginAsEmployee(request);

      // WHEN
      const res = await logout(request, loginRes.access_token);

      // THEN
      expect(res.status()).toBe(204);

      // AND refresh_token 應失效
      const refreshRes = await refreshToken(request, loginRes.refresh_token);
      expect(refreshRes.status()).toBe(401);
    });

    test('Scenario: 變更密碼成功 - 200，新密碼可登入、舊密碼不行', async ({ request }) => {
      // GIVEN - 建立一個臨時帳號來測試密碼變更
      // 先用 admin 建立一個測試用的員工帳號
      const adminLogin = await loginAsAdmin(request);
      const tempEmail = `pwd-test-${Date.now()}@company.com`;
      const tempEmpId = `PWD-${Date.now()}`;
      const originalPassword = 'OrigPass123!';
      const newPassword = PASSWORDS.VALID_NEW;

      // 取得部門列表以取得有效的 department_id
      const deptRes = await request.get(API.DEPARTMENTS, {
        headers: authHeaders(adminLogin.access_token),
      });
      const depts = await deptRes.json();
      const deptId = depts.data?.[0]?.id;
      test.skip(!deptId, '無可用部門，跳過此測試');

      // 建立臨時員工
      const createRes = await request.post(API.EMPLOYEES, {
        data: {
          employee_id: tempEmpId,
          email: tempEmail,
          password: originalPassword,
          name: '密碼變更測試',
          role: 'employee',
          department_id: deptId,
          hire_date: '2026-01-01',
        },
        headers: authHeaders(adminLogin.access_token),
      });
      expect(createRes.status()).toBe(201);

      // 用臨時帳號登入
      const tempLogin = await login(request, tempEmail, originalPassword);

      // WHEN
      const res = await changePassword(
        request,
        tempLogin.access_token,
        originalPassword,
        newPassword,
      );

      // THEN
      expect(res.status()).toBe(200);

      // AND 新密碼可以登入
      const newLoginRes = await request.post(API.AUTH.LOGIN, {
        data: { email: tempEmail, password: newPassword },
      });
      expect(newLoginRes.status()).toBe(200);

      // AND 舊密碼不能登入
      const oldLoginRes = await request.post(API.AUTH.LOGIN, {
        data: { email: tempEmail, password: originalPassword },
      });
      expect(oldLoginRes.status()).toBe(401);
    });
  });

  // =============================================
  // Error Handling
  // =============================================
  test.describe('Error Handling', () => {
    test('Scenario: 密碼錯誤 - 401 INVALID_CREDENTIALS', async ({ request }) => {
      // WHEN
      const res = await request.post(API.AUTH.LOGIN, {
        data: {
          email: EMPLOYEE_USER.email,
          password: PASSWORDS.WRONG,
        },
      });

      // THEN
      expect(res.status()).toBe(401);
      const body = await res.json();
      expect(body.code).toBe('INVALID_CREDENTIALS');
    });

    test('Scenario: Email 不存在 - 401 INVALID_CREDENTIALS（不洩漏帳號存在）', async ({ request }) => {
      // WHEN
      const res = await request.post(API.AUTH.LOGIN, {
        data: {
          email: 'nonexistent@company.com',
          password: 'anyPass123!',
        },
      });

      // THEN
      expect(res.status()).toBe(401);
      const body = await res.json();
      expect(body.code).toBe('INVALID_CREDENTIALS');

      // AND message 應與密碼錯誤時相同（不洩漏帳號存在與否）
      const wrongPwdRes = await request.post(API.AUTH.LOGIN, {
        data: {
          email: EMPLOYEE_USER.email,
          password: PASSWORDS.WRONG,
        },
      });
      const wrongPwdBody = await wrongPwdRes.json();
      expect(body.message).toBe(wrongPwdBody.message);
    });

    test('Scenario: 帳號已停用 - 403 ACCOUNT_SUSPENDED', async ({ request }) => {
      // WHEN
      const res = await request.post(API.AUTH.LOGIN, {
        data: {
          email: SUSPENDED_USER.email,
          password: SUSPENDED_USER.password,
        },
      });

      // THEN
      expect(res.status()).toBe(403);
      const body = await res.json();
      expect(body.code).toBe('ACCOUNT_SUSPENDED');
    });

    test('Scenario: Token 過期 - 401 UNAUTHORIZED', async ({ request }) => {
      // GIVEN - 使用一個明確的過期/無效 token
      const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoiZmFrZSIsInJvbGUiOiJlbXBsb3llZSIsImV4cCI6MTAwMDAwMDAwMH0.invalid';

      // WHEN
      const res = await request.get(API.AUTH.ME, {
        headers: { Authorization: `Bearer ${expiredToken}` },
      });

      // THEN
      expect(res.status()).toBe(401);
      const body = await res.json();
      expect(body.code).toBe('UNAUTHORIZED');
    });

    test('Scenario: Refresh Token 過期 - 401 INVALID_TOKEN', async ({ request }) => {
      // GIVEN - 使用一個無效的 refresh token
      const expiredRefreshToken = 'expired-or-invalid-refresh-token';

      // WHEN
      const res = await refreshToken(request, expiredRefreshToken);

      // THEN
      expect(res.status()).toBe(401);
      const body = await res.json();
      expect(body.code).toBe('INVALID_TOKEN');
    });

    test('Scenario: 變更密碼 - 舊密碼錯誤 - 401 INVALID_CREDENTIALS', async ({ request }) => {
      // GIVEN
      const loginRes = await loginAsEmployee(request);

      // WHEN
      const res = await changePassword(
        request,
        loginRes.access_token,
        PASSWORDS.WRONG,
        PASSWORDS.VALID_NEW,
      );

      // THEN
      expect(res.status()).toBe(401);
      const body = await res.json();
      expect(body.code).toBe('INVALID_CREDENTIALS');
    });

    test('Scenario: 變更密碼 - 新舊密碼相同 - 422 SAME_PASSWORD', async ({ request }) => {
      // GIVEN
      const loginRes = await loginAsEmployee(request);

      // WHEN
      const res = await changePassword(
        request,
        loginRes.access_token,
        EMPLOYEE_USER.password,
        EMPLOYEE_USER.password,
      );

      // THEN
      expect(res.status()).toBe(422);
      const body = await res.json();
      expect(body.code).toBe('SAME_PASSWORD');
    });
  });

  // =============================================
  // Edge Cases
  // =============================================
  test.describe('Edge Cases', () => {
    test('Scenario: 連續登入失敗 5 次後鎖定', async ({ request }) => {
      const email = LOCKOUT_USER.email;
      const wrongPassword = 'WrongWrong123!';

      // GIVEN - 連續失敗 5 次
      for (let i = 0; i < 5; i++) {
        const res = await request.post(API.AUTH.LOGIN, {
          data: { email, password: wrongPassword },
        });
        expect(res.status()).toBe(401);
      }

      // WHEN - 第 6 次嘗試（即使密碼正確）
      const lockedRes = await request.post(API.AUTH.LOGIN, {
        data: { email, password: LOCKOUT_USER.password },
      });

      // THEN
      expect(lockedRes.status()).toBe(429);
      const body = await lockedRes.json();
      expect(body.code).toBe('ACCOUNT_LOCKED');
    });

    test('Scenario: 使用已登出的 refresh_token - 401 INVALID_TOKEN', async ({ request }) => {
      // GIVEN - 登入然後登出
      const loginRes = await loginAsEmployee(request);
      await logout(request, loginRes.access_token);

      // WHEN - 使用已登出的 refresh_token
      const res = await refreshToken(request, loginRes.refresh_token);

      // THEN
      expect(res.status()).toBe(401);
      const body = await res.json();
      expect(body.code).toBe('INVALID_TOKEN');
    });

    test('Scenario: 缺少 Authorization header - 401 UNAUTHORIZED', async ({ request }) => {
      // WHEN - 不帶 Authorization header
      const res = await request.get(API.AUTH.ME);

      // THEN
      expect(res.status()).toBe(401);
      const body = await res.json();
      expect(body.code).toBe('UNAUTHORIZED');
    });
  });
});
