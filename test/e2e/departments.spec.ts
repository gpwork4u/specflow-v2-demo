import { test, expect } from '@playwright/test';
import {
  loginAsAdmin,
  loginAsManager,
  createDepartment,
  createEmployee,
  authHeaders,
} from '../helpers/api-client';
import { API, TEST_DEPARTMENT, MANAGER_USER } from '../helpers/test-data';

const FEATURE = 'F-008';

test.describe(`[${FEATURE}] 部門管理 - API E2E`, () => {
  let adminToken: string;

  test.beforeAll(async ({ request }) => {
    const loginRes = await loginAsAdmin(request);
    adminToken = loginRes.access_token;
  });

  // =============================================
  // Happy Path
  // =============================================
  test.describe('Happy Path', () => {
    test('Scenario: 建立部門 - 201', async ({ request }) => {
      const uniqueName = `測試部門-${Date.now()}`;
      const uniqueCode = `DEPT-${Date.now()}`;

      // WHEN
      const res = await createDepartment(request, adminToken, {
        name: uniqueName,
        code: uniqueCode,
      });

      // THEN
      expect(res.status()).toBe(201);
      const body = await res.json();
      expect(body).toHaveProperty('id');
      expect(body).toHaveProperty('name', uniqueName);
      expect(body).toHaveProperty('code', uniqueCode);
      expect(body).toHaveProperty('created_at');
    });

    test('Scenario: 取得部門列表 - 200 + 分頁', async ({ request }) => {
      // WHEN
      const res = await request.get(API.DEPARTMENTS, {
        headers: authHeaders(adminToken),
      });

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

    test('Scenario: 取得部門詳情 - 200 + members', async ({ request }) => {
      // GIVEN - 先建立一個部門
      const deptName = `詳情測試-${Date.now()}`;
      const createRes = await createDepartment(request, adminToken, {
        name: deptName,
        code: `DET-${Date.now()}`,
      });
      expect(createRes.status()).toBe(201);
      const dept = await createRes.json();

      // WHEN
      const res = await request.get(`${API.DEPARTMENTS}/${dept.id}`, {
        headers: authHeaders(adminToken),
      });

      // THEN
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body).toHaveProperty('id', dept.id);
      expect(body).toHaveProperty('name', deptName);
      expect(body).toHaveProperty('members');
      expect(Array.isArray(body.members)).toBe(true);
    });

    test('Scenario: 更新部門 - 200', async ({ request }) => {
      // GIVEN
      const createRes = await createDepartment(request, adminToken, {
        name: `更新前-${Date.now()}`,
        code: `UPD-${Date.now()}`,
      });
      const dept = await createRes.json();
      const newName = `更新後-${Date.now()}`;

      // WHEN
      const res = await request.put(`${API.DEPARTMENTS}/${dept.id}`, {
        data: { name: newName },
        headers: authHeaders(adminToken),
      });

      // THEN
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.name).toBe(newName);
    });

    test('Scenario: 刪除空部門 - 204', async ({ request }) => {
      // GIVEN - 建立一個沒有員工的部門
      const createRes = await createDepartment(request, adminToken, {
        name: `待刪除-${Date.now()}`,
        code: `DEL-${Date.now()}`,
      });
      const dept = await createRes.json();

      // WHEN
      const res = await request.delete(`${API.DEPARTMENTS}/${dept.id}`, {
        headers: authHeaders(adminToken),
      });

      // THEN
      expect(res.status()).toBe(204);

      // AND 確認已刪除
      const getRes = await request.get(`${API.DEPARTMENTS}/${dept.id}`, {
        headers: authHeaders(adminToken),
      });
      expect(getRes.status()).toBe(404);
    });
  });

  // =============================================
  // Error Handling
  // =============================================
  test.describe('Error Handling', () => {
    test('Scenario: 重複部門名稱 - 409 DUPLICATE_NAME', async ({ request }) => {
      const name = `重複測試-${Date.now()}`;
      // GIVEN - 先建立一個部門
      const createRes = await createDepartment(request, adminToken, {
        name,
        code: `DUP1-${Date.now()}`,
      });
      expect(createRes.status()).toBe(201);

      // WHEN - 用同名建立另一個
      const res = await createDepartment(request, adminToken, {
        name,
        code: `DUP2-${Date.now()}`,
      });

      // THEN
      expect(res.status()).toBe(409);
      const body = await res.json();
      expect(body.code).toBe('DUPLICATE_NAME');
    });

    test('Scenario: 刪除有員工的部門 - 422 HAS_MEMBERS', async ({ request }) => {
      // GIVEN - 建立部門並加入員工
      const deptRes = await createDepartment(request, adminToken, {
        name: `有員工-${Date.now()}`,
        code: `HAS-${Date.now()}`,
      });
      expect(deptRes.status()).toBe(201);
      const dept = await deptRes.json();

      const empRes = await createEmployee(request, adminToken, {
        employee_id: `EMP-HAS-${Date.now()}`,
        email: `has-member-${Date.now()}@company.com`,
        password: 'TestPass123!',
        name: '有部門員工',
        role: 'employee',
        department_id: dept.id,
        hire_date: '2026-01-01',
      });
      expect(empRes.status()).toBe(201);

      // WHEN
      const res = await request.delete(`${API.DEPARTMENTS}/${dept.id}`, {
        headers: authHeaders(adminToken),
      });

      // THEN
      expect(res.status()).toBe(422);
      const body = await res.json();
      expect(body.code).toBe('HAS_MEMBERS');
    });

    test('Scenario: 非 Admin 嘗試管理部門 - 403 FORBIDDEN', async ({ request }) => {
      // GIVEN - 以 manager 身份登入
      let managerToken: string;
      try {
        const managerLogin = await loginAsManager(request);
        managerToken = managerLogin.access_token;
      } catch {
        test.skip(true, '主管帳號不存在，跳過此測試');
        return;
      }

      // WHEN
      const res = await createDepartment(request, managerToken, {
        name: `非admin測試-${Date.now()}`,
        code: `NOADM-${Date.now()}`,
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
    test('Scenario: 部門名稱恰好 100 字 - 201（邊界）', async ({ request }) => {
      const name100 = 'a'.repeat(100);

      // WHEN
      const res = await createDepartment(request, adminToken, {
        name: name100,
        code: `L100-${Date.now()}`,
      });

      // THEN
      expect(res.status()).toBe(201);
      const body = await res.json();
      expect(body.name).toBe(name100);
      expect(body.name.length).toBe(100);
    });

    test('Scenario: 部門名稱 101 字 - 400（超過）', async ({ request }) => {
      const name101 = 'a'.repeat(101);

      // WHEN
      const res = await createDepartment(request, adminToken, {
        name: name101,
        code: `L101-${Date.now()}`,
      });

      // THEN
      expect(res.status()).toBe(400);
      const body = await res.json();
      expect(body.code).toBe('INVALID_INPUT');
    });
  });
});
