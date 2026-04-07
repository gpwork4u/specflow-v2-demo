# F-004: 行事曆檢視

## Status: active
## Sprint: 3
## Priority: P0

## 使用者故事

As a 員工, I want to 在行事曆上查看我的出勤、請假和加班紀錄, so that 我可以一目了然地掌握自己的出勤狀況。

As a 主管, I want to 在行事曆上查看團隊的出勤狀況, so that 我可以了解團隊人力配置。

## API Contract

### `GET /api/v1/calendar/personal`

Auth: Bearer Token

Query Parameters:

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| year | integer | yes | 2020-2099 |
| month | integer | yes | 1-12 |

Response 200:

```json
{
  "year": 2026,
  "month": 4,
  "days": [
    {
      "date": "2026-04-01",
      "is_workday": true,
      "clock": {
        "clock_in": "2026-04-01T01:00:00Z",
        "clock_out": "2026-04-01T10:00:00Z",
        "status": "normal"
      },
      "leaves": [],
      "overtime": null
    },
    {
      "date": "2026-04-02",
      "is_workday": true,
      "clock": null,
      "leaves": [
        {
          "id": "uuid",
          "leave_type": "annual",
          "start_half": "full",
          "end_half": "full",
          "status": "approved"
        }
      ],
      "overtime": null
    },
    {
      "date": "2026-04-05",
      "is_workday": false,
      "clock": null,
      "leaves": [],
      "overtime": {
        "id": "uuid",
        "hours": 4.0,
        "status": "approved"
      }
    }
  ]
}
```

Error Responses:

| Status | Code | Condition |
|--------|------|-----------|
| 400 | INVALID_INPUT | year/month 超出範圍 |
| 401 | UNAUTHORIZED | token 無效 |

---

### `GET /api/v1/calendar/team`

Auth: Bearer Token（role: manager 或 admin）

Query Parameters:

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| year | integer | yes | 2020-2099 |
| month | integer | yes | 1-12 |
| department_id | string (uuid) | no | Admin 可指定；Manager 預設自己部門 |

Response 200:

```json
{
  "year": 2026,
  "month": 4,
  "department": {
    "id": "uuid",
    "name": "工程部"
  },
  "members": [
    {
      "user": {
        "id": "uuid",
        "name": "王小明",
        "employee_id": "EMP001"
      },
      "days": [
        {
          "date": "2026-04-01",
          "status": "present",
          "leave_type": null
        },
        {
          "date": "2026-04-02",
          "status": "leave",
          "leave_type": "annual"
        },
        {
          "date": "2026-04-03",
          "status": "absent",
          "leave_type": null
        }
      ]
    }
  ]
}
```

團隊行事曆的 day status 簡化為：

| status | 說明 |
|--------|------|
| present | 正常出勤 |
| late | 遲到 |
| early_leave | 早退 |
| leave | 請假（含 leave_type） |
| absent | 缺席（無打卡且無請假） |
| holiday | 假日 |
| overtime | 加班 |

Error Responses:

| Status | Code | Condition |
|--------|------|-----------|
| 400 | INVALID_INPUT | year/month 超出範圍 |
| 401 | UNAUTHORIZED | token 無效 |
| 403 | FORBIDDEN | 非 manager 或 admin |

## Business Rules

1. 個人行事曆整合打卡、請假、加班三種資料
2. 團隊行事曆以簡化的 status 呈現（不顯示詳細時間）
3. Manager 只能看自己部門的團隊行事曆
4. Admin 可看任何部門的團隊行事曆
5. 假日判定：週六日 + 國定假日（國定假日資料由系統預設或 Admin 設定）
6. is_workday = true 表示該日為工作日
7. 行事曆以月為單位查詢，回傳整月資料

## Scenarios

### Happy Path

#### Scenario: 查看個人月行事曆
**GIVEN** 使用者在 2026 年 4 月有 20 個工作日的打卡紀錄和 2 天特休
**WHEN** GET /api/v1/calendar/personal?year=2026&month=4
**THEN** response status = 200
**AND** days 包含 30 天的資料
**AND** 工作日有 clock 資料
**AND** 請假日有 leaves 資料

#### Scenario: 主管查看團隊行事曆
**GIVEN** 主管部門有 5 名員工
**WHEN** GET /api/v1/calendar/team?year=2026&month=4
**THEN** response status = 200
**AND** members 包含 5 筆資料
**AND** 每個 member 有 30 天的 status

#### Scenario: Admin 查看指定部門行事曆
**GIVEN** Admin 已登入
**WHEN** GET /api/v1/calendar/team?year=2026&month=4&department_id={dept_id}
**THEN** response status = 200
**AND** department.id = {dept_id}

### Error Handling

#### Scenario: 員工嘗試看團隊行事曆
**GIVEN** 使用者角色為 employee
**WHEN** GET /api/v1/calendar/team?year=2026&month=4
**THEN** response status = 403
**AND** response body code = "FORBIDDEN"

#### Scenario: 無效月份
**WHEN** GET /api/v1/calendar/personal?year=2026&month=13
**THEN** response status = 400
**AND** response body code = "INVALID_INPUT"

### Edge Cases

#### Scenario: 查看未來月份（無資料）
**WHEN** GET /api/v1/calendar/personal?year=2026&month=12
**THEN** response status = 200
**AND** days 包含 31 天，所有 clock/leaves/overtime 為 null

#### Scenario: 同一天既有半天假又有打卡
**GIVEN** 使用者 2026-04-10 請了上午半天假，下午有打卡
**WHEN** GET /api/v1/calendar/personal?year=2026&month=4
**THEN** 2026-04-10 的 leaves 有一筆 morning half 的紀錄
**AND** clock 有下午的打卡紀錄

## UI 頁面

1. **個人行事曆** — 月曆視圖，每日格子顯示出勤狀態（顏色標示）、點擊展開詳情
2. **團隊行事曆** — 成員 x 日期的表格視圖，顏色標示出勤狀態
3. **行事曆篩選** — 月份切換、（團隊）部門切換
