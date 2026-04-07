# F-005: 出席報表/統計

## Status: active
## Sprint: 3
## Priority: P0

## 使用者故事

As a 主管, I want to 查看團隊的月出席報表, so that 我可以掌握團隊的出勤率和異常狀況。

As a HR 管理員, I want to 查看全公司的出席統計, so that 我可以產出月報給管理層。

## API Contract

### `GET /api/v1/reports/personal`

Auth: Bearer Token

Query Parameters:

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| year | integer | yes | 2020-2099 |
| month | integer | yes | 1-12 |

Response 200:

```json
{
  "user": {
    "id": "uuid",
    "name": "王小明",
    "employee_id": "EMP001"
  },
  "year": 2026,
  "month": 4,
  "summary": {
    "workdays": 22,
    "present_days": 20,
    "absent_days": 0,
    "late_days": 2,
    "early_leave_days": 0,
    "leave_days": 2,
    "overtime_hours": 8.0,
    "attendance_rate": 90.9
  },
  "leave_summary": [
    { "leave_type": "annual", "hours": 16.0 },
    { "leave_type": "sick", "hours": 0.0 }
  ]
}
```

---

### `GET /api/v1/reports/team`

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
  "department": {
    "id": "uuid",
    "name": "工程部"
  },
  "year": 2026,
  "month": 4,
  "team_summary": {
    "total_members": 10,
    "avg_attendance_rate": 95.5,
    "total_late_count": 5,
    "total_leave_days": 12
  },
  "members": [
    {
      "user": {
        "id": "uuid",
        "name": "王小明",
        "employee_id": "EMP001"
      },
      "present_days": 20,
      "absent_days": 0,
      "late_days": 2,
      "early_leave_days": 0,
      "leave_days": 2,
      "overtime_hours": 8.0,
      "attendance_rate": 90.9
    }
  ]
}
```

Error Responses:

| Status | Code | Condition |
|--------|------|-----------|
| 401 | UNAUTHORIZED | token 無效 |
| 403 | FORBIDDEN | 非 manager 或 admin |

---

### `GET /api/v1/reports/company`

Auth: Bearer Token（role: admin）

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
  "company_summary": {
    "total_employees": 100,
    "avg_attendance_rate": 94.2,
    "total_late_count": 35,
    "total_leave_days": 80,
    "total_overtime_hours": 120.0
  },
  "departments": [
    {
      "department": {
        "id": "uuid",
        "name": "工程部"
      },
      "total_members": 30,
      "avg_attendance_rate": 96.0,
      "total_late_count": 8,
      "total_leave_days": 20
    }
  ]
}
```

Error Responses:

| Status | Code | Condition |
|--------|------|-----------|
| 401 | UNAUTHORIZED | token 無效 |
| 403 | FORBIDDEN | 非 admin |

---

### `GET /api/v1/reports/export`

Auth: Bearer Token（role: manager 或 admin）

Query Parameters:

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| year | integer | yes | 2020-2099 |
| month | integer | yes | 1-12 |
| scope | string | yes | enum: team, company |
| department_id | string (uuid) | no | scope=team 時使用 |
| format | string | no | enum: csv, xlsx; default: csv |

Response 200: 檔案下載（Content-Type: text/csv 或 application/vnd.openxmlformats-officedocument.spreadsheetml.sheet）

Error Responses:

| Status | Code | Condition |
|--------|------|-----------|
| 401 | UNAUTHORIZED | token 無效 |
| 403 | FORBIDDEN | 權限不足 |

## Business Rules

1. 出勤率 = (present_days / workdays) * 100，四捨五入到小數第一位
2. workdays 排除週六日和國定假日
3. present_days = 有打卡且非全天請假的天數
4. late_days = clock_in 晚於 09:00 (UTC+8) 的天數
5. early_leave_days = clock_out 早於 18:00 (UTC+8) 的天數
6. leave_days = 有核准假單的天數（半天假算 0.5 天）
7. Manager 只能查看/匯出自己部門的報表
8. Admin 可查看/匯出全公司報表
9. 員工只能查看自己的個人報表
10. 匯出格式支援 CSV 和 XLSX

## Scenarios

### Happy Path

#### Scenario: 查看個人月報
**GIVEN** 使用者在 2026 年 4 月有出勤紀錄
**WHEN** GET /api/v1/reports/personal?year=2026&month=4
**THEN** response status = 200
**AND** summary 包含正確的出勤統計
**AND** attendance_rate 為正確的百分比

#### Scenario: 主管查看團隊報表
**GIVEN** 主管部門有 10 名員工
**WHEN** GET /api/v1/reports/team?year=2026&month=4
**THEN** response status = 200
**AND** members 包含 10 筆資料
**AND** team_summary.total_members = 10

#### Scenario: Admin 查看全公司報表
**GIVEN** 公司有 3 個部門
**WHEN** GET /api/v1/reports/company?year=2026&month=4
**THEN** response status = 200
**AND** departments 包含 3 筆資料
**AND** company_summary 正確加總

#### Scenario: 匯出團隊報表 CSV
**GIVEN** 主管已登入
**WHEN** GET /api/v1/reports/export?year=2026&month=4&scope=team&format=csv
**THEN** response status = 200
**AND** Content-Type = "text/csv"
**AND** 檔案包含所有團隊成員的出勤資料

### Error Handling

#### Scenario: 員工嘗試看團隊報表
**GIVEN** 使用者角色為 employee
**WHEN** GET /api/v1/reports/team?year=2026&month=4
**THEN** response status = 403
**AND** response body code = "FORBIDDEN"

#### Scenario: Manager 嘗試看全公司報表
**GIVEN** 使用者角色為 manager
**WHEN** GET /api/v1/reports/company?year=2026&month=4
**THEN** response status = 403
**AND** response body code = "FORBIDDEN"

### Edge Cases

#### Scenario: 新進員工月中到職
**GIVEN** 員工 4 月 15 日到職，4 月工作日 22 天，到職後工作日 12 天
**WHEN** GET /api/v1/reports/personal?year=2026&month=4
**THEN** workdays = 12（只計算到職後）
**AND** attendance_rate 以 12 天為分母計算

#### Scenario: 查看未來月份
**WHEN** GET /api/v1/reports/personal?year=2026&month=12
**THEN** response status = 200
**AND** 所有數值為 0

## UI 頁面

1. **個人出勤摘要** — 月份選擇、出勤率圓餅圖、各項數據卡片
2. **團隊報表** — 成員列表（可排序）、團隊平均出勤率
3. **全公司報表** — 部門列表、部門出勤率比較圖表
4. **匯出按鈕** — 選擇格式（CSV/XLSX）下載
