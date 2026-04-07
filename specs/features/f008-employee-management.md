# F-008: 員工/部門管理

## Status: active
## Sprint: 1
## Priority: P0

## 使用者故事

As a HR 管理員, I want to 在系統中管理員工和部門資料, so that 出勤系統能正確反映公司的組織架構。

## API Contract

### 部門管理

#### `POST /api/v1/departments`

Auth: Bearer Token（role: admin）

Request Body:

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| name | string | yes | max 100 chars, unique |
| code | string | yes | max 20 chars, unique, alphanumeric + hyphen |
| manager_id | string (uuid) | no | 必須是 active 的 User |
| parent_id | string (uuid) | no | 必須是已存在的 Department |

Response 201:

```json
{
  "id": "uuid",
  "name": "工程部",
  "code": "ENG",
  "manager": null,
  "parent": null,
  "created_at": "2026-04-07T10:00:00Z"
}
```

Error Responses:

| Status | Code | Condition |
|--------|------|-----------|
| 400 | INVALID_INPUT | 欄位格式不正確 |
| 401 | UNAUTHORIZED | token 無效 |
| 403 | FORBIDDEN | 非 admin |
| 409 | DUPLICATE_NAME | 部門名稱已存在 |
| 409 | DUPLICATE_CODE | 部門代碼已存在 |

---

#### `GET /api/v1/departments`

Auth: Bearer Token（role: admin）

Query Parameters:

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| search | string | no | 模糊搜尋 name 或 code |
| page | integer | no | >= 1, default 1 |
| limit | integer | no | 1-100, default 20 |

Response 200:

```json
{
  "data": [
    {
      "id": "uuid",
      "name": "工程部",
      "code": "ENG",
      "manager": { "id": "uuid", "name": "李大華" },
      "parent": null,
      "member_count": 15,
      "created_at": "2026-04-07T10:00:00Z"
    }
  ],
  "meta": { "total": 5, "page": 1, "limit": 20, "totalPages": 1 }
}
```

---

#### `GET /api/v1/departments/:id`

Auth: Bearer Token（role: admin）

Response 200: 單一部門詳情（含 members 列表）

```json
{
  "id": "uuid",
  "name": "工程部",
  "code": "ENG",
  "manager": { "id": "uuid", "name": "李大華" },
  "parent": null,
  "members": [
    { "id": "uuid", "name": "王小明", "employee_id": "EMP001", "role": "employee" }
  ],
  "created_at": "2026-04-07T10:00:00Z"
}
```

---

#### `PUT /api/v1/departments/:id`

Auth: Bearer Token（role: admin）

Request Body: 同 POST（所有欄位皆為選填，partial update）

Response 200: 更新後的 Department

Error Responses: 同 POST + 404 NOT_FOUND

---

#### `DELETE /api/v1/departments/:id`

Auth: Bearer Token（role: admin）

Response 204: No Content

Error Responses:

| Status | Code | Condition |
|--------|------|-----------|
| 403 | FORBIDDEN | 非 admin |
| 404 | NOT_FOUND | 部門不存在 |
| 422 | HAS_MEMBERS | 部門仍有員工，不可刪除 |

---

### 員工管理

#### `POST /api/v1/employees`

Auth: Bearer Token（role: admin）

Request Body:

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| employee_id | string | yes | max 20 chars, unique |
| email | string | yes | valid email, max 255 chars, unique |
| password | string | yes | min 8 chars, max 100 chars |
| name | string | yes | max 100 chars |
| role | string | yes | enum: employee, manager, admin |
| department_id | string (uuid) | yes | 必須是已存在的 Department |
| manager_id | string (uuid) | no | 必須是 role=manager 的 User |
| hire_date | string (date) | yes | ISO 8601 date |

Response 201:

```json
{
  "id": "uuid",
  "employee_id": "EMP001",
  "email": "wang@company.com",
  "name": "王小明",
  "role": "employee",
  "department": { "id": "uuid", "name": "工程部" },
  "manager": { "id": "uuid", "name": "李大華" },
  "hire_date": "2024-03-01",
  "status": "active",
  "created_at": "2026-04-07T10:00:00Z"
}
```

Error Responses:

| Status | Code | Condition |
|--------|------|-----------|
| 400 | INVALID_INPUT | 欄位格式不正確 |
| 403 | FORBIDDEN | 非 admin |
| 409 | DUPLICATE_EMPLOYEE_ID | 員工編號已存在 |
| 409 | DUPLICATE_EMAIL | Email 已存在 |
| 404 | DEPARTMENT_NOT_FOUND | department_id 不存在 |

---

#### `GET /api/v1/employees`

Auth: Bearer Token（role: admin）

Query Parameters:

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| search | string | no | 模糊搜尋 name, employee_id, email |
| department_id | string (uuid) | no | 篩選部門 |
| role | string | no | enum: employee, manager, admin |
| status | string | no | enum: active, inactive, suspended |
| page | integer | no | >= 1, default 1 |
| limit | integer | no | 1-100, default 20 |

Response 200:

```json
{
  "data": [
    {
      "id": "uuid",
      "employee_id": "EMP001",
      "email": "wang@company.com",
      "name": "王小明",
      "role": "employee",
      "department": { "id": "uuid", "name": "工程部" },
      "manager": { "id": "uuid", "name": "李大華" },
      "hire_date": "2024-03-01",
      "status": "active"
    }
  ],
  "meta": { "total": 50, "page": 1, "limit": 20, "totalPages": 3 }
}
```

---

#### `GET /api/v1/employees/:id`

Auth: Bearer Token（role: admin）

Response 200: 單一員工詳情

---

#### `PUT /api/v1/employees/:id`

Auth: Bearer Token（role: admin）

Request Body: 同 POST（除 password 外，所有欄位選填）

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| name | string | no | max 100 chars |
| role | string | no | enum: employee, manager, admin |
| department_id | string (uuid) | no | |
| manager_id | string (uuid) | no | |
| status | string | no | enum: active, inactive, suspended |

Response 200: 更新後的 Employee

---

#### `PUT /api/v1/employees/:id/reset-password`

Auth: Bearer Token（role: admin）

Request Body:

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| new_password | string | yes | min 8 chars, max 100 chars |

Response 200:

```json
{
  "message": "密碼已重設"
}
```

## Business Rules

1. 員工編號（employee_id）和 email 全域唯一
2. 部門代碼（code）全域唯一，僅允許英數字和連字號
3. 部門仍有員工時不可刪除（需先將員工轉移到其他部門）
4. 設定 manager_id 時，該 User 必須 role = manager
5. 員工 status 設為 inactive 或 suspended 時，無法登入
6. 不可物理刪除員工（只能設為 inactive）
7. Admin 可重設任何員工的密碼
8. 建立員工時自動建立該年度的假別額度（F-009 連動）
9. 部門支援階層結構（parent_id），但最多 3 層

## Scenarios

### Happy Path

#### Scenario: 建立部門
**GIVEN** Admin 已登入
**WHEN** POST /api/v1/departments with { "name": "工程部", "code": "ENG" }
**THEN** response status = 201
**AND** response body 包含新建的部門資料

#### Scenario: 建立員工
**GIVEN** Admin 已登入，部門 "工程部" 已存在
**WHEN** POST /api/v1/employees with { "employee_id": "EMP001", "email": "wang@company.com", "password": "initPass123", "name": "王小明", "role": "employee", "department_id": "{eng_dept_id}", "hire_date": "2024-03-01" }
**THEN** response status = 201
**AND** status = "active"

#### Scenario: 搜尋員工
**GIVEN** 系統有員工 "王小明"（EMP001）
**WHEN** GET /api/v1/employees?search=王小明
**THEN** response status = 200
**AND** data 包含匹配的員工

#### Scenario: 更新員工部門
**GIVEN** 員工 A 在工程部
**WHEN** PUT /api/v1/employees/{A}/with { "department_id": "{new_dept_id}" }
**THEN** response status = 200
**AND** department 更新為新部門

#### Scenario: 停用員工帳號
**WHEN** PUT /api/v1/employees/{id} with { "status": "inactive" }
**THEN** response status = 200
**AND** status = "inactive"
**AND** 該員工無法再登入

### Error Handling

#### Scenario: 重複員工編號
**GIVEN** 已有 employee_id = "EMP001"
**WHEN** POST /api/v1/employees with { "employee_id": "EMP001", ... }
**THEN** response status = 409
**AND** response body code = "DUPLICATE_EMPLOYEE_ID"

#### Scenario: 重複部門名稱
**GIVEN** 已有部門 "工程部"
**WHEN** POST /api/v1/departments with { "name": "工程部", "code": "ENG2" }
**THEN** response status = 409
**AND** response body code = "DUPLICATE_NAME"

#### Scenario: 刪除有員工的部門
**GIVEN** 工程部有 5 名員工
**WHEN** DELETE /api/v1/departments/{eng_id}
**THEN** response status = 422
**AND** response body code = "HAS_MEMBERS"

#### Scenario: 非 Admin 嘗試管理員工
**GIVEN** 使用者角色為 manager
**WHEN** POST /api/v1/employees with { ... }
**THEN** response status = 403
**AND** response body code = "FORBIDDEN"

### Edge Cases

#### Scenario: 部門名稱恰好 100 字
**WHEN** POST /api/v1/departments with { "name": "a" * 100, "code": "LONG" }
**THEN** response status = 201

#### Scenario: 部門名稱 101 字
**WHEN** POST /api/v1/departments with { "name": "a" * 101, "code": "LONG" }
**THEN** response status = 400
**AND** response body code = "INVALID_INPUT"

#### Scenario: 設定 manager_id 為非主管角色的 User
**GIVEN** User B 的 role = employee
**WHEN** POST /api/v1/employees with { ..., "manager_id": "{B_id}" }
**THEN** response status = 400
**AND** response body code = "INVALID_INPUT"
**AND** message 提示 manager_id 必須是 manager 角色

## UI 頁面

1. **員工列表** — 搜尋、篩選（部門、角色、狀態）、新增按鈕
2. **員工新增/編輯表單** — 所有欄位、部門下拉、主管下拉
3. **部門列表** — 樹狀結構展示、成員數
4. **部門新增/編輯表單** — 名稱、代碼、主管選擇、上級部門選擇
