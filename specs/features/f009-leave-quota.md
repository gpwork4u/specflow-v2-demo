# F-009: 假別額度管理

## Status: active
## Sprint: 2
## Priority: P0

## 使用者故事

As a HR 管理員, I want to 設定每位員工各假別的年度額度, so that 系統可以在員工請假時自動檢查額度。

As a 員工, I want to 查看我各假別的剩餘額度, so that 我知道還能請多少假。

## API Contract

### `GET /api/v1/leave-quotas/me`

Auth: Bearer Token

Query Parameters:

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| year | integer | no | default: 當年度 |

Response 200:

```json
{
  "user_id": "uuid",
  "year": 2026,
  "quotas": [
    {
      "id": "uuid",
      "leave_type": "annual",
      "leave_type_label": "特休",
      "total_hours": 80.0,
      "used_hours": 16.0,
      "remaining_hours": 64.0
    },
    {
      "id": "uuid",
      "leave_type": "personal",
      "leave_type_label": "事假",
      "total_hours": 56.0,
      "used_hours": 0.0,
      "remaining_hours": 56.0
    },
    {
      "id": "uuid",
      "leave_type": "sick",
      "leave_type_label": "病假",
      "total_hours": 240.0,
      "used_hours": 8.0,
      "remaining_hours": 232.0
    }
  ]
}
```

---

### `GET /api/v1/leave-quotas/employees/:userId`

Auth: Bearer Token（role: admin）

Query Parameters:

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| year | integer | no | default: 當年度 |

Response 200: 同 /me 格式

Error Responses:

| Status | Code | Condition |
|--------|------|-----------|
| 403 | FORBIDDEN | 非 admin |
| 404 | NOT_FOUND | 員工不存在 |

---

### `PUT /api/v1/leave-quotas/employees/:userId`

Auth: Bearer Token（role: admin）

Request Body:

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| year | integer | yes | 2020-2099 |
| quotas | array | yes | 至少一筆 |
| quotas[].leave_type | string | yes | valid leave_type enum |
| quotas[].total_hours | number | yes | >= 0, 精度到 0.5 |

Request Body Example:

```json
{
  "year": 2026,
  "quotas": [
    { "leave_type": "annual", "total_hours": 80.0 },
    { "leave_type": "personal", "total_hours": 56.0 },
    { "leave_type": "sick", "total_hours": 240.0 }
  ]
}
```

Response 200:

```json
{
  "user_id": "uuid",
  "year": 2026,
  "quotas": [
    {
      "id": "uuid",
      "leave_type": "annual",
      "total_hours": 80.0,
      "used_hours": 16.0,
      "remaining_hours": 64.0
    }
  ],
  "updated_at": "2026-04-07T10:00:00Z"
}
```

Error Responses:

| Status | Code | Condition |
|--------|------|-----------|
| 400 | INVALID_INPUT | 格式不正確 |
| 403 | FORBIDDEN | 非 admin |
| 404 | NOT_FOUND | 員工不存在 |
| 422 | QUOTA_BELOW_USED | 新額度低於已使用時數 |

---

### `POST /api/v1/leave-quotas/batch`

Auth: Bearer Token（role: admin）

批次設定多位員工的額度（用於年度初始化）。

Request Body:

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| year | integer | yes | 2020-2099 |
| department_id | string (uuid) | no | 指定部門，與 user_ids 二擇一 |
| user_ids | array of uuid | no | 指定員工列表，與 department_id 二擇一 |
| quotas | array | yes | 同上 |

Response 200:

```json
{
  "updated_count": 15,
  "year": 2026
}
```

Error Responses:

| Status | Code | Condition |
|--------|------|-----------|
| 400 | INVALID_INPUT | 必須指定 department_id 或 user_ids 之一 |
| 403 | FORBIDDEN | 非 admin |

## 假別預設額度

| leave_type | 中文名稱 | 預設年度時數 | 說明 |
|-----------|---------|-------------|------|
| annual | 特休 | 依年資計算 | 0.5-1 年: 24h, 1-2 年: 56h, 2-3 年: 80h, 3-5 年: 112h, 5-10 年: 120h, 10+ 年: 128h+ |
| personal | 事假 | 56h (7 天) | 勞基法規定 |
| sick | 病假 | 240h (30 天) | 勞基法規定，半薪 |
| marriage | 婚假 | 64h (8 天) | |
| bereavement | 喪假 | 24-64h | 依親等不同 |
| maternity | 產假 | 448h (56 天) | |
| paternity | 陪產假 | 56h (7 天) | |
| official | 公假 | 無上限 | 不扣額度 |

## Business Rules

1. 員工建立時自動產生當年度所有假別的額度
2. 特休額度依年資自動計算（到職日起算）
3. 其他假別使用預設額度
4. Admin 可手動調整任一員工的額度
5. 額度不可低於已使用時數
6. 每年 1 月 1 日自動產生新年度額度（排程任務）
7. 公假不受額度限制（total_hours 設為一個很大的值或特殊處理）
8. used_hours 在請假核准時增加，請假取消時減少
9. 額度以小時為單位，最小單位 0.5 小時

## Scenarios

### Happy Path

#### Scenario: 員工查看自己的額度
**GIVEN** 使用者已登入，2026 年度有各假別額度
**WHEN** GET /api/v1/leave-quotas/me?year=2026
**THEN** response status = 200
**AND** quotas 包含所有假別的 total_hours, used_hours, remaining_hours

#### Scenario: Admin 設定員工額度
**GIVEN** Admin 已登入
**WHEN** PUT /api/v1/leave-quotas/employees/{userId} with { "year": 2026, "quotas": [{ "leave_type": "annual", "total_hours": 120.0 }] }
**THEN** response status = 200
**AND** annual 的 total_hours = 120.0

#### Scenario: Admin 批次設定部門額度
**GIVEN** Admin 已登入，工程部有 15 名員工
**WHEN** POST /api/v1/leave-quotas/batch with { "year": 2026, "department_id": "{eng_id}", "quotas": [{ "leave_type": "personal", "total_hours": 56.0 }] }
**THEN** response status = 200
**AND** updated_count = 15

### Error Handling

#### Scenario: 額度低於已使用
**GIVEN** 員工 annual used_hours = 24
**WHEN** PUT /api/v1/leave-quotas/employees/{userId} with { "year": 2026, "quotas": [{ "leave_type": "annual", "total_hours": 16.0 }] }
**THEN** response status = 422
**AND** response body code = "QUOTA_BELOW_USED"
**AND** message 包含已使用時數

#### Scenario: 非 Admin 嘗試設定額度
**GIVEN** 使用者角色為 manager
**WHEN** PUT /api/v1/leave-quotas/employees/{userId}
**THEN** response status = 403

### Edge Cases

#### Scenario: 新員工自動產生額度
**GIVEN** Admin 建立新員工，到職日 2026-04-07
**THEN** 系統自動建立 2026 年度所有假別額度
**AND** annual 額度依到職日到年底的比例計算

#### Scenario: 查看往年額度
**WHEN** GET /api/v1/leave-quotas/me?year=2025
**THEN** response status = 200
**AND** quotas 為 2025 年度的額度資料

## UI 頁面

1. **個人額度總覽** — 各假別進度條（已用/總額）
2. **Admin 額度管理** — 搜尋員工、編輯額度表單
3. **批次設定** — 選擇部門或多位員工，批次設定年度額度
