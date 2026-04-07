# F-002: 請假申請

## Status: active
## Sprint: 2
## Priority: P0

## 使用者故事

As a 員工, I want to 在系統上提交請假申請, so that 我不需要填寫紙本假單，主管也能即時收到通知。

## API Contract

### `POST /api/v1/leaves`

Auth: Bearer Token

Request Body:

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| leave_type | string | yes | enum: personal, sick, annual, marriage, bereavement, maternity, paternity, official |
| start_date | string (date) | yes | ISO 8601 date, >= today |
| end_date | string (date) | yes | ISO 8601 date, >= start_date |
| start_half | string | no | enum: full, morning, afternoon; default: full |
| end_half | string | no | enum: full, morning, afternoon; default: full |
| reason | string | yes | min 1 char, max 500 chars |

Response 201:

```json
{
  "id": "uuid",
  "user_id": "uuid",
  "leave_type": "annual",
  "start_date": "2026-04-10",
  "end_date": "2026-04-11",
  "start_half": "full",
  "end_half": "full",
  "hours": 16.0,
  "reason": "家庭旅遊",
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
| 400 | INVALID_INPUT | 欄位格式不正確、必填欄位缺失 |
| 401 | UNAUTHORIZED | token 無效 |
| 409 | DATE_CONFLICT | 該日期已有請假或已核准的申請 |
| 422 | INSUFFICIENT_QUOTA | 假別額度不足 |
| 422 | PAST_DATE | start_date 在今天之前 |

---

### `GET /api/v1/leaves`

Auth: Bearer Token

Query Parameters:

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| status | string | no | enum: pending, approved, rejected, cancelled |
| leave_type | string | no | enum: personal, sick, annual, ... |
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
      "leave_type": "annual",
      "start_date": "2026-04-10",
      "end_date": "2026-04-11",
      "start_half": "full",
      "end_half": "full",
      "hours": 16.0,
      "reason": "家庭旅遊",
      "status": "pending",
      "reviewer": null,
      "created_at": "2026-04-07T10:00:00Z"
    }
  ],
  "meta": {
    "total": 5,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

---

### `GET /api/v1/leaves/:id`

Auth: Bearer Token（只能查看自己的，主管/Admin 可查看部屬的）

Response 200:

```json
{
  "id": "uuid",
  "user_id": "uuid",
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
  "reviewer": null,
  "reviewed_at": null,
  "review_comment": null,
  "created_at": "2026-04-07T10:00:00Z"
}
```

Error Responses:

| Status | Code | Condition |
|--------|------|-----------|
| 401 | UNAUTHORIZED | token 無效 |
| 403 | FORBIDDEN | 無權查看此請假單 |
| 404 | NOT_FOUND | 請假單不存在 |

---

### `PUT /api/v1/leaves/:id/cancel`

Auth: Bearer Token（只能取消自己的）

Request Body: 無

Response 200:

```json
{
  "id": "uuid",
  "status": "cancelled",
  "updated_at": "2026-04-07T11:00:00Z"
}
```

Error Responses:

| Status | Code | Condition |
|--------|------|-----------|
| 401 | UNAUTHORIZED | token 無效 |
| 403 | FORBIDDEN | 不是申請人 |
| 404 | NOT_FOUND | 請假單不存在 |
| 422 | CANNOT_CANCEL | 狀態不是 pending 或 approved（已駁回或已取消不可再取消） |
| 422 | LEAVE_STARTED | 請假日期已開始，無法取消（已 approved 且 start_date <= today） |

## Data Model

參見 `specs/overview.md` 中的 LeaveRequest entity。

## Business Rules

1. 請假時數計算：
   - full day = 8 hours
   - morning half = 4 hours (09:00-13:00)
   - afternoon half = 4 hours (13:00-18:00)
   - 跨多天：中間天數 * 8 + 首日 half + 末日 half
2. 不可申請過去日期的請假（start_date >= today）
3. 病假例外：可申請前 3 天內的病假（start_date >= today - 3）
4. 同一日期不可重複申請（已有 pending 或 approved 的請假）
5. 提交後狀態為 pending，等待主管審核
6. 只有 pending 狀態可以取消
7. 已 approved 且 start_date > today 可以取消（會退還額度）
8. 已 approved 且 start_date <= today 不可取消
9. 額度不足時不可申請（檢查 LeaveQuota）
10. 提交後自動通知直屬主管（F-007）

## Scenarios

### Happy Path

#### Scenario: 申請特休一天
**GIVEN** 使用者已登入且特休額度充足（剩餘 >= 8 小時）
**WHEN** POST /api/v1/leaves with { "leave_type": "annual", "start_date": "2026-04-10", "end_date": "2026-04-10", "reason": "個人事務" }
**THEN** response status = 201
**AND** response body status = "pending"
**AND** hours = 8.0
**AND** 直屬主管收到通知

#### Scenario: 申請半天假
**GIVEN** 使用者已登入且事假額度充足
**WHEN** POST /api/v1/leaves with { "leave_type": "personal", "start_date": "2026-04-10", "end_date": "2026-04-10", "start_half": "morning", "end_half": "morning", "reason": "看診" }
**THEN** response status = 201
**AND** hours = 4.0

#### Scenario: 申請跨多天假
**GIVEN** 使用者已登入
**WHEN** POST /api/v1/leaves with { "leave_type": "annual", "start_date": "2026-04-10", "end_date": "2026-04-14", "start_half": "afternoon", "end_half": "full", "reason": "出國旅遊" }
**THEN** response status = 201
**AND** hours = 36.0 (4 + 8 + 8 + 8 + 8)

#### Scenario: 查詢個人請假紀錄
**GIVEN** 使用者有 3 筆請假紀錄
**WHEN** GET /api/v1/leaves
**THEN** response status = 200
**AND** data 包含 3 筆紀錄

#### Scenario: 取消 pending 的請假
**GIVEN** 使用者有一筆 pending 狀態的請假單
**WHEN** PUT /api/v1/leaves/{id}/cancel
**THEN** response status = 200
**AND** status = "cancelled"

#### Scenario: 取消已核准但未開始的請假
**GIVEN** 使用者有一筆 approved 狀態的請假單，start_date = 2026-04-15（未來）
**WHEN** PUT /api/v1/leaves/{id}/cancel
**THEN** response status = 200
**AND** status = "cancelled"
**AND** 假別額度退還

### Error Handling

#### Scenario: 額度不足
**GIVEN** 使用者特休剩餘 4 小時
**WHEN** POST /api/v1/leaves with { "leave_type": "annual", "start_date": "2026-04-10", "end_date": "2026-04-10", "reason": "旅遊" }
**THEN** response status = 422
**AND** response body code = "INSUFFICIENT_QUOTA"
**AND** message 包含剩餘額度資訊

#### Scenario: 日期衝突
**GIVEN** 使用者在 2026-04-10 已有一筆 approved 的假
**WHEN** POST /api/v1/leaves with { "leave_type": "personal", "start_date": "2026-04-10", "end_date": "2026-04-10", "reason": "事務" }
**THEN** response status = 409
**AND** response body code = "DATE_CONFLICT"

#### Scenario: 申請過去日期
**WHEN** POST /api/v1/leaves with { "leave_type": "annual", "start_date": "2026-04-01", "end_date": "2026-04-01", "reason": "旅遊" }（假設今天是 2026-04-07）
**THEN** response status = 422
**AND** response body code = "PAST_DATE"

#### Scenario: 缺少必填欄位
**WHEN** POST /api/v1/leaves with { "leave_type": "annual", "start_date": "2026-04-10" }
**THEN** response status = 400
**AND** response body code = "INVALID_INPUT"
**AND** details 列出缺少的欄位

#### Scenario: 取消非自己的請假單
**GIVEN** 使用者 A 嘗試取消使用者 B 的請假單
**WHEN** PUT /api/v1/leaves/{B_leave_id}/cancel
**THEN** response status = 403
**AND** response body code = "FORBIDDEN"

### Edge Cases

#### Scenario: 病假可追溯 3 天
**GIVEN** 今天是 2026-04-07
**WHEN** POST /api/v1/leaves with { "leave_type": "sick", "start_date": "2026-04-04", "end_date": "2026-04-04", "reason": "身體不適" }
**THEN** response status = 201
**AND** 成功建立請假單

#### Scenario: 病假追溯超過 3 天被拒
**GIVEN** 今天是 2026-04-07
**WHEN** POST /api/v1/leaves with { "leave_type": "sick", "start_date": "2026-04-03", "end_date": "2026-04-03", "reason": "身體不適" }
**THEN** response status = 422
**AND** response body code = "PAST_DATE"

#### Scenario: 取消已開始的 approved 假
**GIVEN** 使用者有一筆 approved 假，start_date = 2026-04-07（今天）
**WHEN** PUT /api/v1/leaves/{id}/cancel
**THEN** response status = 422
**AND** response body code = "LEAVE_STARTED"

#### Scenario: reason 恰好 500 字
**WHEN** POST /api/v1/leaves with reason = "a" * 500, 其餘欄位合法
**THEN** response status = 201

#### Scenario: reason 501 字
**WHEN** POST /api/v1/leaves with reason = "a" * 501
**THEN** response status = 400
**AND** response body code = "INVALID_INPUT"

## UI 頁面

1. **請假申請表單** — 假別選擇、日期選擇器（含半天選項）、原因輸入、剩餘額度顯示
2. **請假紀錄列表** — 篩選（狀態、假別、日期）、取消按鈕
3. **請假單詳情** — 完整資訊 + 審核結果
