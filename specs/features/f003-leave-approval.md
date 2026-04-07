# F-003: 主管審核請假

## Status: active
## Sprint: 2
## Priority: P0

## 使用者故事

As a 主管, I want to 在系統上審核部屬的請假申請, so that 我可以快速核准或駁回假單，不需要簽紙本。

## API Contract

### `GET /api/v1/leaves/pending`

Auth: Bearer Token（role: manager 或 admin）

Query Parameters:

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| department_id | string (uuid) | no | Admin 可指定部門；Manager 預設自己部門 |
| page | integer | no | >= 1, default 1 |
| limit | integer | no | 1-50, default 20 |

Response 200:

```json
{
  "data": [
    {
      "id": "uuid",
      "user": {
        "id": "uuid",
        "name": "王小明",
        "employee_id": "EMP001",
        "department": { "id": "uuid", "name": "工程部" }
      },
      "leave_type": "annual",
      "start_date": "2026-04-10",
      "end_date": "2026-04-11",
      "start_half": "full",
      "end_half": "full",
      "hours": 16.0,
      "reason": "家庭旅遊",
      "status": "pending",
      "created_at": "2026-04-07T10:00:00Z"
    }
  ],
  "meta": {
    "total": 3,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

Error Responses:

| Status | Code | Condition |
|--------|------|-----------|
| 401 | UNAUTHORIZED | token 無效 |
| 403 | FORBIDDEN | 角色非 manager 或 admin |

---

### `PUT /api/v1/leaves/:id/approve`

Auth: Bearer Token（role: manager 或 admin）

Request Body:

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| comment | string | no | max 500 chars |

Response 200:

```json
{
  "id": "uuid",
  "status": "approved",
  "reviewer": {
    "id": "uuid",
    "name": "李大華"
  },
  "reviewed_at": "2026-04-07T14:00:00Z",
  "review_comment": "核准",
  "updated_at": "2026-04-07T14:00:00Z"
}
```

Error Responses:

| Status | Code | Condition |
|--------|------|-----------|
| 401 | UNAUTHORIZED | token 無效 |
| 403 | FORBIDDEN | 非該員工的主管或 Admin |
| 404 | NOT_FOUND | 請假單不存在 |
| 422 | NOT_PENDING | 請假單狀態不是 pending |

---

### `PUT /api/v1/leaves/:id/reject`

Auth: Bearer Token（role: manager 或 admin）

Request Body:

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| comment | string | yes | min 1 char, max 500 chars（駁回必須填原因） |

Response 200:

```json
{
  "id": "uuid",
  "status": "rejected",
  "reviewer": {
    "id": "uuid",
    "name": "李大華"
  },
  "reviewed_at": "2026-04-07T14:00:00Z",
  "review_comment": "該週有重要會議，請改期",
  "updated_at": "2026-04-07T14:00:00Z"
}
```

Error Responses:

| Status | Code | Condition |
|--------|------|-----------|
| 400 | INVALID_INPUT | comment 為空 |
| 401 | UNAUTHORIZED | token 無效 |
| 403 | FORBIDDEN | 非該員工的主管或 Admin |
| 404 | NOT_FOUND | 請假單不存在 |
| 422 | NOT_PENDING | 請假單狀態不是 pending |

## Business Rules

1. Manager 只能審核直屬部屬的請假單（同部門且 user.manager_id = reviewer.id）
2. Admin 可審核全公司任何人的請假單
3. 只能審核 status = pending 的請假單
4. 駁回時必須填寫原因（comment 必填）
5. 核准時 comment 為選填
6. 核准後扣除員工對應的假別額度（更新 LeaveQuota.used_hours）
7. 駁回後不扣除額度
8. 審核後自動通知申請人（F-007）
9. 不可審核自己的請假單

## Scenarios

### Happy Path

#### Scenario: 查看待審核清單
**GIVEN** 主管已登入，部門有 3 筆 pending 請假
**WHEN** GET /api/v1/leaves/pending
**THEN** response status = 200
**AND** data 包含 3 筆紀錄
**AND** 所有紀錄的 user 都是該主管的直屬部屬

#### Scenario: 核准請假
**GIVEN** 主管已登入，有一筆直屬部屬的 pending 請假（annual, 8 hours）
**WHEN** PUT /api/v1/leaves/{id}/approve with { "comment": "核准" }
**THEN** response status = 200
**AND** status = "approved"
**AND** reviewer 為該主管
**AND** 員工的 annual LeaveQuota.used_hours 增加 8
**AND** 申請人收到核准通知

#### Scenario: 駁回請假
**GIVEN** 主管已登入，有一筆直屬部屬的 pending 請假
**WHEN** PUT /api/v1/leaves/{id}/reject with { "comment": "該週有重要專案 deadline" }
**THEN** response status = 200
**AND** status = "rejected"
**AND** review_comment = "該週有重要專案 deadline"
**AND** 額度不變
**AND** 申請人收到駁回通知

### Error Handling

#### Scenario: 員工嘗試審核
**GIVEN** 使用者角色為 employee
**WHEN** PUT /api/v1/leaves/{id}/approve
**THEN** response status = 403
**AND** response body code = "FORBIDDEN"

#### Scenario: 主管審核非直屬部屬
**GIVEN** 主管 A 嘗試審核部門 B 員工的請假
**WHEN** PUT /api/v1/leaves/{id}/approve
**THEN** response status = 403
**AND** response body code = "FORBIDDEN"

#### Scenario: 駁回不填原因
**WHEN** PUT /api/v1/leaves/{id}/reject with { "comment": "" }
**THEN** response status = 400
**AND** response body code = "INVALID_INPUT"

#### Scenario: 審核已處理的請假單
**GIVEN** 請假單狀態為 approved
**WHEN** PUT /api/v1/leaves/{id}/approve
**THEN** response status = 422
**AND** response body code = "NOT_PENDING"

#### Scenario: 審核不存在的請假單
**WHEN** PUT /api/v1/leaves/{nonexistent_id}/approve
**THEN** response status = 404
**AND** response body code = "NOT_FOUND"

### Edge Cases

#### Scenario: 主管審核自己的請假
**GIVEN** 主管提交了一筆請假
**WHEN** PUT /api/v1/leaves/{own_leave_id}/approve
**THEN** response status = 403
**AND** response body code = "FORBIDDEN"
**AND** message 提示不可自行審核

#### Scenario: Admin 審核任意部門
**GIVEN** Admin 已登入
**WHEN** GET /api/v1/leaves/pending?department_id={any_dept_id}
**THEN** response status = 200
**AND** data 包含該部門的 pending 請假

#### Scenario: 核准後額度剛好歸零
**GIVEN** 員工特休剩餘 8 小時，申請 8 小時特休（pending）
**WHEN** PUT /api/v1/leaves/{id}/approve
**THEN** response status = 200
**AND** LeaveQuota.used_hours = total_hours（額度歸零）

## UI 頁面

1. **待審核列表** — 顯示所有 pending 請假單，含員工姓名、假別、日期、時數
2. **審核操作** — 核准/駁回按鈕，駁回時必填原因 textarea
3. **審核歷史** — 已審核的請假單列表（含審核結果和備註）
