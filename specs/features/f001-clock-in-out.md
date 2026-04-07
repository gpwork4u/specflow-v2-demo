# F-001: 打卡（上班/下班）

## Status: active
## Sprint: 1
## Priority: P0

## 使用者故事

As a 員工, I want to 用手機或電腦快速打卡上下班, so that 公司可以記錄我的出勤時間。

## API Contract

### `POST /api/v1/clock/in`

Auth: Bearer Token

Request Body:

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| note | string | no | max 500 chars |

Response 201:

```json
{
  "id": "uuid",
  "user_id": "uuid",
  "date": "2026-04-07",
  "clock_in": "2026-04-07T09:00:00Z",
  "clock_out": null,
  "status": "normal",
  "note": null,
  "created_at": "2026-04-07T09:00:00Z"
}
```

Error Responses:

| Status | Code | Condition |
|--------|------|-----------|
| 401 | UNAUTHORIZED | token 無效 |
| 409 | ALREADY_CLOCKED_IN | 今日已打過上班卡 |

---

### `POST /api/v1/clock/out`

Auth: Bearer Token

Request Body:

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| note | string | no | max 500 chars |

Response 200:

```json
{
  "id": "uuid",
  "user_id": "uuid",
  "date": "2026-04-07",
  "clock_in": "2026-04-07T09:00:00Z",
  "clock_out": "2026-04-07T18:00:00Z",
  "status": "normal",
  "note": null,
  "created_at": "2026-04-07T09:00:00Z",
  "updated_at": "2026-04-07T18:00:00Z"
}
```

Error Responses:

| Status | Code | Condition |
|--------|------|-----------|
| 401 | UNAUTHORIZED | token 無效 |
| 422 | NOT_CLOCKED_IN | 今日尚未打上班卡 |
| 409 | ALREADY_CLOCKED_OUT | 今日已打過下班卡 |

---

### `GET /api/v1/clock/today`

Auth: Bearer Token

Response 200:

```json
{
  "id": "uuid",
  "date": "2026-04-07",
  "clock_in": "2026-04-07T09:00:00Z",
  "clock_out": null,
  "status": "normal",
  "note": null
}
```

若今日無打卡紀錄，回傳：

```json
{
  "id": null,
  "date": "2026-04-07",
  "clock_in": null,
  "clock_out": null,
  "status": null,
  "note": null
}
```

---

### `GET /api/v1/clock/records`

Auth: Bearer Token

Query Parameters:

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| start_date | string (date) | yes | ISO 8601 date (YYYY-MM-DD) |
| end_date | string (date) | yes | ISO 8601 date, >= start_date |
| page | integer | no | >= 1, default 1 |
| limit | integer | no | 1-100, default 20 |

Response 200:

```json
{
  "data": [
    {
      "id": "uuid",
      "date": "2026-04-07",
      "clock_in": "2026-04-07T09:00:00Z",
      "clock_out": "2026-04-07T18:00:00Z",
      "status": "normal",
      "note": null
    }
  ],
  "meta": {
    "total": 22,
    "page": 1,
    "limit": 20,
    "totalPages": 2
  }
}
```

Error Responses:

| Status | Code | Condition |
|--------|------|-----------|
| 400 | INVALID_INPUT | 日期格式錯誤或 end_date < start_date |
| 401 | UNAUTHORIZED | token 無效 |

## Data Model

```
ClockRecord {
  id: UUID (PK, auto-generated)
  user_id: UUID (FK -> User) NOT NULL
  date: DATE NOT NULL
  clock_in: TIMESTAMP NOT NULL
  clock_out: TIMESTAMP NULL
  status: ENUM('normal', 'late', 'early_leave', 'absent', 'amended') NOT NULL DEFAULT 'normal'
  note: TEXT NULL
  created_at: TIMESTAMP NOT NULL DEFAULT NOW()
  updated_at: TIMESTAMP NOT NULL DEFAULT NOW()

  UNIQUE(user_id, date)  -- 每人每天最多一筆紀錄
}
```

## Business Rules

1. 每人每天只能有一筆打卡紀錄（上班 + 下班為同一筆）
2. 上班時間預設為 09:00（UTC+8），遲到判定：clock_in > 09:00
3. 下班時間預設為 18:00（UTC+8），早退判定：clock_out < 18:00
4. 打上班卡後才能打下班卡
5. 已打過下班卡不能重複打卡（需透過補打卡流程修正）
6. 打卡時間以 server 時間為準，不接受 client 端傳入時間
7. status 自動計算：
   - clock_in > 09:00 (UTC+8) => "late"
   - clock_out < 18:00 (UTC+8) => "early_leave"
   - 同時遲到和早退 => "late"（以較嚴重的為準）
   - 補打卡核准 => "amended"
8. 查詢紀錄的日期範圍最大不超過 90 天

## Scenarios

### Happy Path

#### Scenario: 上班打卡成功
**GIVEN** 使用者已登入且今日尚未打卡
**WHEN** POST /api/v1/clock/in
**THEN** response status = 201
**AND** response body clock_in 為當前 server 時間
**AND** response body clock_out = null
**AND** database 新增一筆 ClockRecord

#### Scenario: 下班打卡成功
**GIVEN** 使用者已登入且今日已打上班卡但未打下班卡
**WHEN** POST /api/v1/clock/out
**THEN** response status = 200
**AND** response body clock_out 為當前 server 時間
**AND** status 根據打卡時間自動計算

#### Scenario: 查詢今日打卡狀態
**GIVEN** 使用者已登入且今日已打上班卡（09:05 UTC+8）
**WHEN** GET /api/v1/clock/today
**THEN** response status = 200
**AND** response body clock_in 有值
**AND** response body status = "late"

#### Scenario: 查詢月份打卡紀錄
**GIVEN** 使用者有 2026 年 3 月的打卡紀錄
**WHEN** GET /api/v1/clock/records?start_date=2026-03-01&end_date=2026-03-31
**THEN** response status = 200
**AND** response data 包含該月所有打卡紀錄
**AND** response meta 包含正確的分頁資訊

#### Scenario: 準時上班打卡
**GIVEN** 使用者在 08:55 (UTC+8) 打卡
**WHEN** POST /api/v1/clock/in
**THEN** response status = 201
**AND** status = "normal"

### Error Handling

#### Scenario: 重複上班打卡
**GIVEN** 使用者今日已打過上班卡
**WHEN** POST /api/v1/clock/in
**THEN** response status = 409
**AND** response body code = "ALREADY_CLOCKED_IN"

#### Scenario: 未打上班卡就打下班卡
**GIVEN** 使用者今日尚未打上班卡
**WHEN** POST /api/v1/clock/out
**THEN** response status = 422
**AND** response body code = "NOT_CLOCKED_IN"

#### Scenario: 重複下班打卡
**GIVEN** 使用者今日已打過上班卡和下班卡
**WHEN** POST /api/v1/clock/out
**THEN** response status = 409
**AND** response body code = "ALREADY_CLOCKED_OUT"

#### Scenario: 未認證存取
**WHEN** POST /api/v1/clock/in without Authorization header
**THEN** response status = 401
**AND** response body code = "UNAUTHORIZED"

### Edge Cases

#### Scenario: 跨日打卡（午夜後下班）
**GIVEN** 使用者在 2026-04-07 打了上班卡
**AND** 現在是 2026-04-08 01:30 (UTC+8)
**WHEN** POST /api/v1/clock/out
**THEN** response status = 200
**AND** clock_out 記錄為 2026-04-08T01:30:00 的 UTC 時間
**AND** 該筆紀錄的 date 仍為 2026-04-07

#### Scenario: 今日無打卡紀錄時查詢
**GIVEN** 使用者今日尚未打卡
**WHEN** GET /api/v1/clock/today
**THEN** response status = 200
**AND** response body 所有欄位為 null（除了 date）

#### Scenario: 查詢日期範圍超過 90 天
**WHEN** GET /api/v1/clock/records?start_date=2026-01-01&end_date=2026-06-30
**THEN** response status = 400
**AND** response body code = "INVALID_INPUT"
**AND** message 提示日期範圍不可超過 90 天

#### Scenario: 上班打卡帶備註
**WHEN** POST /api/v1/clock/in with { "note": "外出開會晚到" }
**THEN** response status = 201
**AND** response body note = "外出開會晚到"

## UI 頁面

1. **打卡首頁** — 大按鈕（上班打卡/下班打卡），顯示今日打卡狀態、當前時間
2. **打卡紀錄列表** — 月曆/列表切換，顯示每日出勤狀態（正常/遲到/早退/缺席）
