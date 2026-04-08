# Sprint 3 依賴圖譜

## 調查日期
2026-04-08

## Feature 清單

| 編號 | 功能 | 說明 |
|------|------|------|
| F-004 | 行事曆檢視 | 個人/團隊月行事曆，整合打卡+請假+加班資料 |
| F-005 | 出席報表/統計 | 個人/團隊/全公司月報，匯出 CSV |

## 依賴關係

```
Sprint 1+2 已完成的 Models（ClockRecord, LeaveRequest）
├── F-004 行事曆（讀取 ClockRecord + LeaveRequest）
└── F-005 報表（聚合統計 ClockRecord + LeaveRequest）
```

F-004 和 F-005 互不依賴，都是「讀取型」功能。

## 拓撲排序

### Wave 0（全部並行）

| 任務 | 負責 | 說明 |
|------|------|------|
| F-004: 行事曆檢視 | Engineer | Calendar module（personal + team） |
| F-005: 出席報表 | Engineer | Reports module（personal + team + company + export） |
| UI Design | UI Designer | 行事曆 + 報表頁面設計 |
| QA | QA Engineer | 撰寫所有 test scripts |

## 並行策略

```
時間軸 ──────────────────────────────>

Wave 0:  [UI Design ────────────]
         [F-004 行事曆 ─────────]
         [F-005 報表 ───────────]
         [QA test scripts ─────]
```

無 Wave 1，全部可在 Wave 0 並行完成。
