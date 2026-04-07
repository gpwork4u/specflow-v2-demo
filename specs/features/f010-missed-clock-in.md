# F-010: 補打卡申請

## Status: active
## Sprint: 4
## Priority: P0

## 使用者故事

As a 員工, I want to 在忘記打卡時提交補打卡申請, so that 我的出勤紀錄不會因為忘記打卡而顯示為缺勤。

## API Contract

### `POST /api/v1/missed-clocks`

Auth: Bearer Token

Request Body:

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| date | string (date) | yes | ISO 8601 date, <= today, >= today - 7 |
| clock_type | string | yes | enum: clock_in, clock_out |
| requested_time | string (datetime) | yes | ISO 8601 datetime, 必須在 date 的合理時間範圍內 |
| reason | string | yes | min 1 char, max 500 chars |

Response 201:

```json
{
  "id": "uuid",
  "user_id": "uuid",
  "date": "2026-04-06",
  "clock_type": "clock_in",
  "requested_time": "2026-04-06T01:00:00Z",
  "reason": "忘記打卡，當日 9:00 已到辦公室",
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
| 400 | INVALID_INPUT | 格式不正確 |
| 401 | UNAUTHORIZED | token 無效 |
| 409 | ALREADY_EXISTS | 該日期該類型已有 pending/approved 的補打卡申請 |
| 422 | ALREADY_CLOCKED | 該日期已有對應的打卡紀錄（不需要補打卡） |
| 422 | PAST_DATE | 超過 7 天前 |

---

### `GET /api/v1/missed-clocks`

Auth: Bearer Token

Query Parameters:

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| status | string | no | enum: pending, approved, rejected |
| page | integer | no | >= 1, default 1 |
| limit | integer | no | 1-50, default 20 |

Response 200:（同標準分頁格式）

---

### `GET /api/v1/missed-clocks/pending`

Auth: Bearer Token（role: manager 或 admin）

Response 200:（待審核列表，含 user 資訊）

---

### `PUT /api/v1/missed-clocks/:id/approve`

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
  "reviewer": { "id": "uuid", "name": "李大華" },
  "reviewed_at": "2026-04-07T15:00:00Z",
  "review_comment": "核准"
}
```

核准後的副作用：
- 若 clock_type = clock_in：建立或更新該日的 ClockRecord.clock_in
- 若 clock_type = clock_out：更新該日的 ClockRecord.clock_out
- ClockRecord.status 更新為 "amended"

Error Responses:

| Status | Code | Condition |
|--------|------|-----------|
| 403 | FORBIDDEN | 非該員工的主管或 Admin |
| 404 | NOT_FOUND | 申請不存在 |
| 422 | NOT_PENDING | 非 pending 狀態 |

---

### `PUT /api/v1/missed-clocks/:id/reject`

Auth: Bearer Token（role: manager 或 admin）

Request Body:

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| comment | string | yes | min 1 char, max 500 chars |

Response 200: 同 approve 格式（status = "rejected"）

## Business Rules

1. 只能對 7 天內的日期補打卡
2. 不能對未來日期補打卡
3. 如果該日已有對應的打卡紀錄（如已打上班卡就不能補上班卡），回傳錯誤
4. 同一天同類型只能有一筆 pending 或 approved 的補打卡申請
5. 核准後自動更新 ClockRecord：
   - 補上班卡：新建 ClockRecord 或更新 clock_in
   - 補下班卡：更新 ClockRecord.clock_out
   - ClockRecord.status 設為 "amended"
6. 審核規則同 F-003：Manager 審核直屬、Admin 審核全公司、不可自審
7. 駁回必須填原因
8. 審核後通知申請人

## Scenarios

### Happy Path

#### Scenario: 申請補上班打卡
**GIVEN** 使用者昨天忘記打上班卡
**WHEN** POST /api/v1/missed-clocks with { "date": "2026-04-06", "clock_type": "clock_in", "requested_time": "2026-04-06T01:00:00Z", "reason": "忘記打卡" }
**THEN** response status = 201
**AND** status = "pending"

#### Scenario: 核准補打卡
**GIVEN** 主管有一筆 pending 的補打卡申請（補上班卡，requested_time = 09:00）
**WHEN** PUT /api/v1/missed-clocks/{id}/approve
**THEN** response status = 200
**AND** status = "approved"
**AND** 該日 ClockRecord.clock_in = requested_time
**AND** ClockRecord.status = "amended"

#### Scenario: 核准補下班卡
**GIVEN** 員工 2026-04-06 有打上班卡但忘了打下班卡，申請補下班卡（18:00）
**WHEN** PUT /api/v1/missed-clocks/{id}/approve
**THEN** ClockRecord.clock_out = 2026-04-06T10:00:00Z
**AND** ClockRecord.status = "amended"

### Error Handling

#### Scenario: 已有打卡紀錄不需補打
**GIVEN** 使用者 2026-04-06 已打過上班卡
**WHEN** POST /api/v1/missed-clocks with { "date": "2026-04-06", "clock_type": "clock_in", ... }
**THEN** response status = 422
**AND** response body code = "ALREADY_CLOCKED"

#### Scenario: 超過 7 天前
**GIVEN** 今天是 2026-04-07
**WHEN** POST /api/v1/missed-clocks with { "date": "2026-03-30", ... }
**THEN** response status = 422
**AND** response body code = "PAST_DATE"

#### Scenario: 重複申請
**GIVEN** 使用者 2026-04-06 clock_in 已有 pending 的補打卡
**WHEN** POST /api/v1/missed-clocks with { "date": "2026-04-06", "clock_type": "clock_in", ... }
**THEN** response status = 409
**AND** response body code = "ALREADY_EXISTS"

### Edge Cases

#### Scenario: 同天補上班卡和下班卡
**GIVEN** 使用者 2026-04-06 完全沒打卡
**WHEN** POST /api/v1/missed-clocks with { "date": "2026-04-06", "clock_type": "clock_in", ... }
**AND** POST /api/v1/missed-clocks with { "date": "2026-04-06", "clock_type": "clock_out", ... }
**THEN** 兩筆都成功建立（不同 clock_type 不衝突）

#### Scenario: 補打卡時間不合理（凌晨 3 點上班）
**WHEN** POST /api/v1/missed-clocks with { "date": "2026-04-06", "clock_type": "clock_in", "requested_time": "2026-04-05T19:00:00Z" }
**THEN** response status = 201（系統不阻擋，由主管判斷是否合理）

## UI 頁面

1. **補打卡申請表單** — 日期選擇（限 7 天內）、上班/下班選擇、時間選擇、原因
2. **補打卡紀錄列表** — 狀態篩選、結果
3. **（主管）待審核列表** — 同其他審核介面風格
