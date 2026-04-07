# F-007: 通知功能

## Status: active
## Sprint: 4
## Priority: P1

## 使用者故事

As a 員工, I want to 在審核結果出來時收到通知, so that 我不用反覆查看請假/加班的審核狀態。

As a 主管, I want to 在部屬提交申請時收到通知, so that 我能及時處理審核。

## API Contract

### `GET /api/v1/notifications`

Auth: Bearer Token

Query Parameters:

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| is_read | boolean | no | true/false |
| page | integer | no | >= 1, default 1 |
| limit | integer | no | 1-50, default 20 |

Response 200:

```json
{
  "data": [
    {
      "id": "uuid",
      "type": "leave_approved",
      "title": "請假已核准",
      "content": "您的特休申請（2026/04/10 - 2026/04/11）已由 李大華 核准。",
      "reference_type": "leave_request",
      "reference_id": "uuid",
      "is_read": false,
      "created_at": "2026-04-07T14:00:00Z"
    }
  ],
  "meta": {
    "total": 10,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

---

### `GET /api/v1/notifications/unread-count`

Auth: Bearer Token

Response 200:

```json
{
  "count": 3
}
```

---

### `PUT /api/v1/notifications/:id/read`

Auth: Bearer Token

Response 200:

```json
{
  "id": "uuid",
  "is_read": true
}
```

Error Responses:

| Status | Code | Condition |
|--------|------|-----------|
| 404 | NOT_FOUND | 通知不存在或非自己的 |

---

### `PUT /api/v1/notifications/read-all`

Auth: Bearer Token

Response 200:

```json
{
  "updated_count": 5
}
```

## 通知類型

| type | 觸發時機 | 接收者 | content 範例 |
|------|---------|--------|-------------|
| leave_approved | 請假被核准 | 申請人 | 您的{假別}申請（{日期}）已由 {審核者} 核准。 |
| leave_rejected | 請假被駁回 | 申請人 | 您的{假別}申請（{日期}）已被 {審核者} 駁回。原因：{comment} |
| overtime_approved | 加班被核准 | 申請人 | 您的加班申請（{日期}）已由 {審核者} 核准。 |
| overtime_rejected | 加班被駁回 | 申請人 | 您的加班申請（{日期}）已被 {審核者} 駁回。原因：{comment} |
| missed_clock_approved | 補打卡被核准 | 申請人 | 您的補打卡申請（{日期}）已由 {審核者} 核准。 |
| missed_clock_rejected | 補打卡被駁回 | 申請人 | 您的補打卡申請（{日期}）已被 {審核者} 駁回。原因：{comment} |
| new_leave_request | 部屬送出請假 | 直屬主管 | {員工姓名} 送出了{假別}申請（{日期}），請審核。 |
| new_overtime_request | 部屬送出加班 | 直屬主管 | {員工姓名} 送出了加班申請（{日期}），請審核。 |
| new_missed_clock_request | 部屬送出補打卡 | 直屬主管 | {員工姓名} 送出了補打卡申請（{日期}），請審核。 |
| reminder_clock_in | 忘記打卡提醒 | 該員工 | 提醒：您今日尚未打上班卡。 |
| reminder_leave_expiry | 假單即將到期 | 直屬主管 | 提醒：{員工姓名} 的{假別}申請（{日期}）已待審超過 3 天。 |

## Business Rules

1. 通知在對應事件發生時自動建立（由後端 service 產生）
2. 每個使用者只能看到自己的通知
3. 忘記打卡提醒：工作日 10:00 (UTC+8) 若尚未打卡則發送
4. 假單到期提醒：pending 狀態超過 3 天未審核，提醒主管
5. 通知不可刪除，只能標記已讀
6. PWA 支援 Web Push Notification（需使用者授權）
7. 未讀數量需要即時更新（可用 polling 或 WebSocket，由 Tech Lead 決定）

## Scenarios

### Happy Path

#### Scenario: 查看通知列表
**GIVEN** 使用者有 10 筆通知，其中 3 筆未讀
**WHEN** GET /api/v1/notifications
**THEN** response status = 200
**AND** data 包含 10 筆通知，按 created_at 降序排列

#### Scenario: 查看未讀數量
**GIVEN** 使用者有 3 筆未讀通知
**WHEN** GET /api/v1/notifications/unread-count
**THEN** response status = 200
**AND** count = 3

#### Scenario: 標記單則已讀
**GIVEN** 使用者有一筆未讀通知
**WHEN** PUT /api/v1/notifications/{id}/read
**THEN** response status = 200
**AND** is_read = true

#### Scenario: 全部標記已讀
**GIVEN** 使用者有 5 筆未讀通知
**WHEN** PUT /api/v1/notifications/read-all
**THEN** response status = 200
**AND** updated_count = 5
**AND** 所有通知的 is_read = true

#### Scenario: 請假核准時自動建立通知
**GIVEN** 主管核准了員工 A 的請假
**THEN** 員工 A 收到 type = "leave_approved" 的通知
**AND** reference_type = "leave_request"
**AND** reference_id = 該請假單的 id

### Error Handling

#### Scenario: 標記不存在的通知
**WHEN** PUT /api/v1/notifications/{nonexistent_id}/read
**THEN** response status = 404
**AND** response body code = "NOT_FOUND"

#### Scenario: 標記他人的通知
**GIVEN** 通知 X 屬於使用者 B
**WHEN** 使用者 A 呼叫 PUT /api/v1/notifications/{X}/read
**THEN** response status = 404
**AND** response body code = "NOT_FOUND"（不洩漏通知存在與否）

### Edge Cases

#### Scenario: 篩選未讀通知
**GIVEN** 使用者有 10 筆通知，3 筆未讀
**WHEN** GET /api/v1/notifications?is_read=false
**THEN** response status = 200
**AND** data 包含 3 筆通知

#### Scenario: 忘記打卡提醒觸發
**GIVEN** 使用者在工作日 10:00 (UTC+8) 尚未打上班卡
**THEN** 系統自動建立 type = "reminder_clock_in" 的通知

#### Scenario: 假單到期提醒觸發
**GIVEN** 請假單 status = pending 且 created_at 超過 3 天
**THEN** 系統自動建立 type = "reminder_leave_expiry" 的通知給直屬主管

## UI 頁面

1. **通知鈴鐺** — Header 右上角，顯示未讀數量 badge
2. **通知下拉選單/頁面** — 通知列表，點擊跳轉到對應的申請詳情
3. **全部已讀按鈕** — 一鍵清除未讀標記
