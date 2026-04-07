# F-000: 認證系統

## Status: active
## Sprint: 1
## Priority: P0

## 使用者故事

As a 使用者, I want to 使用 email 和密碼登入系統, so that 我可以安全地存取我的工時相關功能。

## API Contract

### `POST /api/v1/auth/login`

Auth: 無（公開 API）

Request Body:

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| email | string | yes | valid email format, max 255 chars |
| password | string | yes | min 8 chars, max 100 chars |

Response 200:

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "Bearer",
  "expires_in": 86400,
  "user": {
    "id": "uuid",
    "employee_id": "EMP001",
    "email": "user@company.com",
    "name": "王小明",
    "role": "employee",
    "department": {
      "id": "uuid",
      "name": "工程部"
    }
  }
}
```

Error Responses:

| Status | Code | Condition |
|--------|------|-----------|
| 400 | INVALID_INPUT | email 或 password 格式不正確 |
| 401 | INVALID_CREDENTIALS | email 不存在或密碼錯誤 |
| 403 | ACCOUNT_SUSPENDED | 帳號已停用 |

---

### `POST /api/v1/auth/refresh`

Auth: 無（使用 refresh_token）

Request Body:

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| refresh_token | string | yes | valid JWT refresh token |

Response 200:

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "Bearer",
  "expires_in": 86400
}
```

Error Responses:

| Status | Code | Condition |
|--------|------|-----------|
| 401 | INVALID_TOKEN | refresh_token 無效或已過期 |

---

### `POST /api/v1/auth/logout`

Auth: Bearer Token

Request Body: 無

Response 204: No Content

Error Responses:

| Status | Code | Condition |
|--------|------|-----------|
| 401 | UNAUTHORIZED | token 無效或缺失 |

---

### `GET /api/v1/auth/me`

Auth: Bearer Token

Response 200:

```json
{
  "id": "uuid",
  "employee_id": "EMP001",
  "email": "user@company.com",
  "name": "王小明",
  "role": "employee",
  "department": {
    "id": "uuid",
    "name": "工程部"
  },
  "manager": {
    "id": "uuid",
    "name": "李大華"
  },
  "hire_date": "2024-03-01",
  "status": "active"
}
```

Error Responses:

| Status | Code | Condition |
|--------|------|-----------|
| 401 | UNAUTHORIZED | token 無效或缺失 |

---

### `PUT /api/v1/auth/password`

Auth: Bearer Token

Request Body:

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| current_password | string | yes | min 8 chars |
| new_password | string | yes | min 8 chars, max 100 chars, 不可與 current_password 相同 |

Response 200:

```json
{
  "message": "密碼變更成功"
}
```

Error Responses:

| Status | Code | Condition |
|--------|------|-----------|
| 400 | INVALID_INPUT | new_password 格式不正確 |
| 401 | INVALID_CREDENTIALS | current_password 不正確 |
| 422 | SAME_PASSWORD | 新舊密碼相同 |

## Business Rules

1. 密碼使用 bcrypt 加密（cost factor >= 10）
2. Access Token 有效期 24 小時
3. Refresh Token 有效期 7 天
4. 登出時 invalidate 該 refresh_token（server-side blacklist 或 DB 紀錄）
5. 連續登入失敗 5 次，帳號鎖定 15 分鐘
6. 登入失敗不洩漏帳號是否存在（統一回傳 INVALID_CREDENTIALS）
7. JWT payload 包含：user_id, role, department_id, exp, iat
8. 帳號狀態為 suspended 或 inactive 時不允許登入

## Scenarios

### Happy Path

#### Scenario: 登入成功
**GIVEN** 使用者帳號存在且狀態為 active
**WHEN** POST /api/v1/auth/login with { "email": "user@company.com", "password": "validPass123" }
**THEN** response status = 200
**AND** response body contains access_token, refresh_token, user object
**AND** access_token 有效期為 86400 秒
**AND** user.role 正確反映資料庫中的角色

#### Scenario: 取得個人資料
**GIVEN** 使用者已登入，持有有效 access_token
**WHEN** GET /api/v1/auth/me with Authorization: Bearer {access_token}
**THEN** response status = 200
**AND** response body 包含完整的 user profile（含 department, manager）

#### Scenario: 刷新 Token
**GIVEN** 使用者持有有效的 refresh_token
**WHEN** POST /api/v1/auth/refresh with { "refresh_token": "{valid_refresh_token}" }
**THEN** response status = 200
**AND** response body 包含新的 access_token 和 refresh_token
**AND** 舊的 refresh_token 失效

#### Scenario: 登出成功
**GIVEN** 使用者已登入
**WHEN** POST /api/v1/auth/logout with Authorization: Bearer {access_token}
**THEN** response status = 204
**AND** 該 refresh_token 失效，無法再用於刷新

#### Scenario: 變更密碼成功
**GIVEN** 使用者已登入
**WHEN** PUT /api/v1/auth/password with { "current_password": "oldPass123", "new_password": "newPass456" }
**THEN** response status = 200
**AND** 使用新密碼可以登入
**AND** 使用舊密碼無法登入

### Error Handling

#### Scenario: 密碼錯誤
**WHEN** POST /api/v1/auth/login with { "email": "user@company.com", "password": "wrongPassword" }
**THEN** response status = 401
**AND** response body code = "INVALID_CREDENTIALS"
**AND** response body message 不透露帳號是否存在

#### Scenario: Email 不存在
**WHEN** POST /api/v1/auth/login with { "email": "nonexistent@company.com", "password": "anyPass123" }
**THEN** response status = 401
**AND** response body code = "INVALID_CREDENTIALS"
**AND** response message 與密碼錯誤時相同（不洩漏帳號存在與否）

#### Scenario: 帳號已停用
**GIVEN** 使用者帳號狀態為 suspended
**WHEN** POST /api/v1/auth/login with { "email": "suspended@company.com", "password": "validPass123" }
**THEN** response status = 403
**AND** response body code = "ACCOUNT_SUSPENDED"

#### Scenario: Token 過期
**GIVEN** access_token 已超過 24 小時
**WHEN** GET /api/v1/auth/me with Authorization: Bearer {expired_token}
**THEN** response status = 401
**AND** response body code = "UNAUTHORIZED"

#### Scenario: Refresh Token 過期
**GIVEN** refresh_token 已超過 7 天
**WHEN** POST /api/v1/auth/refresh with { "refresh_token": "{expired_refresh_token}" }
**THEN** response status = 401
**AND** response body code = "INVALID_TOKEN"

#### Scenario: 變更密碼 - 舊密碼錯誤
**GIVEN** 使用者已登入
**WHEN** PUT /api/v1/auth/password with { "current_password": "wrongOldPass", "new_password": "newPass456" }
**THEN** response status = 401
**AND** response body code = "INVALID_CREDENTIALS"

#### Scenario: 變更密碼 - 新舊密碼相同
**GIVEN** 使用者已登入
**WHEN** PUT /api/v1/auth/password with { "current_password": "samePass123", "new_password": "samePass123" }
**THEN** response status = 422
**AND** response body code = "SAME_PASSWORD"

### Edge Cases

#### Scenario: 連續登入失敗 5 次後鎖定
**GIVEN** 使用者已連續登入失敗 4 次
**WHEN** POST /api/v1/auth/login with { "email": "user@company.com", "password": "wrongAgain" }
**THEN** response status = 401
**AND** 第 6 次嘗試（即使密碼正確）回傳 429 + code = "ACCOUNT_LOCKED"
**AND** 鎖定 15 分鐘後可再嘗試

#### Scenario: 使用已登出的 refresh_token
**GIVEN** 使用者已成功登出
**WHEN** POST /api/v1/auth/refresh with { "refresh_token": "{logged_out_refresh_token}" }
**THEN** response status = 401
**AND** response body code = "INVALID_TOKEN"

#### Scenario: 缺少 Authorization header
**WHEN** GET /api/v1/auth/me without Authorization header
**THEN** response status = 401
**AND** response body code = "UNAUTHORIZED"

## UI 頁面

1. **登入頁** — email + password 表單，錯誤提示
2. **變更密碼 Modal** — 目前密碼 + 新密碼表單
