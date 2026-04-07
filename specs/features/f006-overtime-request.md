# F-006: 加班申請

## Status: active
## Sprint: 4
## Priority: P0

## 使用者故事

As a 員工, I want to 在系統上提交加班申請, so that 加班時數可以被正式記錄並由主管核准。

## API Contract

### `POST /api/v1/overtime`

Auth: Bearer Token

Request Body:

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| date | string (date) | yes | ISO 8601 date |
| start_time | string (time) | yes | HH:mm format |
| end_time | string (time) | yes | HH:mm format, > start_time |
| reason | string | yes | min 1 char, max 500 chars |

Response 201:

```json
{
  "id": "uuid",
  "user_id": "uuid",
  "date": "2026-04-07",
  "start_time": "18:00",
  "end_time": "21:00",
  "hours": 3.0,
  "reason": "趕專案 deadline",
  "status": "pending",
  "reviewer_id": null,
  "reviewed_at": null,
  "review_comment": null,
  "created_at": "2026-04-07T10:00:00Z"
}
```

Error Responses:

| Status | Code | Condition |
|--------|------|-----------|
| 400 | INVALID_INPUT | 欄位格式不正確 |
| 401 | UNAUTHORIZED | token 無效 |
| 409 | DATE_CONFLICT | 該日期已有加班申請（pending 或 approved） |
| 422 | INVALID_TIME_RANGE | end_time <= start_time 或時數超過上限 |

---

### `GET /api/v1/overtime`

Auth: Bearer Token

Query Parameters:

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| status | string | no | enum: pending, approved, rejected, cancelled |
| start_date | string (date) | no | ISO 8601 date |
| end_date | string (date) | no | ISO 8601 date |
| page | integer | no | >= 1, default 1 |
| limit | integer | no | 1-50, default 20 |

Response 200:

```json
{
  "data": [
    {
      "id": "uuid",
      "date": "2026-04-07",
      "start_time": "18:00",
      "end_time": "21:00",
      "hours": 3.0,
      "reason": "趕專案 deadline",
      "status": "pending",
      "created_at": "2026-04-07T10:00:00Z"
    }
  ],
  "meta": {
    "total": 2,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

---

### `PUT /api/v1/overtime/:id/cancel`

Auth: Bearer Token（只能取消自己的）

Response 200:

```json
{
  "id": "uuid",
  "status": "cancelled"
}
```

Error Responses:

| Status | Code | Condition |
|--------|------|-----------|
| 403 | FORBIDDEN | 不是申請人 |
| 404 | NOT_FOUND | 申請不存在 |
| 422 | CANNOT_CANCEL | 非 pending 狀態 |

---

### `GET /api/v1/overtime/pending`

Auth: Bearer Token（role: manager 或 admin）

Query Parameters:（同 leaves/pending）

Response 200:（同 leaves/pending 格式，包含 user 資訊）

---

### `PUT /api/v1/overtime/:id/approve`

Auth: Bearer Token（role: manager 或 admin）

Request Body:

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| comment | string | no | max 500 chars |

Response 200:（同 leaves approve 格式）

---

### `PUT /api/v1/overtime/:id/reject`

Auth: Bearer Token（role: manager 或 admin）

Request Body:

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| comment | string | yes | min 1 char, max 500 chars |

Response 200:（同 leaves reject 格式）

## Business Rules

1. 加班時數 = end_time - start_time，以 0.5 小時為最小單位（無條件進位到 0.5）
2. 單次加班上限 12 小時
3. 每月加班上限 46 小時（勞基法）
4. 同一天不可重複申請加班
5. 加班日期可以是過去的日期（事後補申請，限 7 天內）
6. 只有 pending 狀態可以取消
7. 審核規則同請假審核（F-003）：Manager 審核直屬、Admin 審核全公司、不可自審
8. 駁回必須填原因
9. 審核後通知申請人

## Scenarios

### Happy Path

#### Scenario: 申請加班成功
**GIVEN** 使用者已登入，本月加班累計 20 小時
**WHEN** POST /api/v1/overtime with { "date": "2026-04-07", "start_time": "18:00", "end_time": "21:00", "reason": "趕專案 deadline" }
**THEN** response status = 201
**AND** hours = 3.0
**AND** status = "pending"

#### Scenario: 核准加班
**GIVEN** 主管已登入，有一筆 pending 加班申請
**WHEN** PUT /api/v1/overtime/{id}/approve
**THEN** response status = 200
**AND** status = "approved"

### Error Handling

#### Scenario: 同日重複申請
**GIVEN** 使用者在 2026-04-07 已有 pending 加班
**WHEN** POST /api/v1/overtime with { "date": "2026-04-07", ... }
**THEN** response status = 409
**AND** response body code = "DATE_CONFLICT"

#### Scenario: 月加班超過 46 小時
**GIVEN** 使用者本月已核准加班 44 小時
**WHEN** POST /api/v1/overtime with hours = 3
**THEN** response status = 422
**AND** response body code = "MONTHLY_LIMIT_EXCEEDED"
**AND** message 包含剩餘可申請時數

#### Scenario: 單次加班超過 12 小時
**WHEN** POST /api/v1/overtime with { "start_time": "18:00", "end_time": "07:00" }（13 小時）
**THEN** response status = 422
**AND** response body code = "INVALID_TIME_RANGE"

### Edge Cases

#### Scenario: 事後補申請加班（7 天內）
**GIVEN** 今天是 2026-04-07
**WHEN** POST /api/v1/overtime with { "date": "2026-04-01", ... }
**THEN** response status = 201

#### Scenario: 事後補申請超過 7 天
**GIVEN** 今天是 2026-04-07
**WHEN** POST /api/v1/overtime with { "date": "2026-03-30", ... }
**THEN** response status = 422
**AND** response body code = "PAST_DATE"

#### Scenario: 加班時數非整數（進位到 0.5）
**WHEN** POST /api/v1/overtime with { "start_time": "18:00", "end_time": "19:20" }
**THEN** hours = 1.5（1 小時 20 分 -> 進位到 1.5）

## UI 頁面

1. **加班申請表單** — 日期、時間選擇器、原因、本月已加班時數提示
2. **加班紀錄列表** — 篩選（狀態、日期）、取消按鈕
3. **（主管）待審核列表** — 同請假審核介面風格
