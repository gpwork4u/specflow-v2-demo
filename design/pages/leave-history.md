# 審核歷史列表（主管）

## 對應 Feature

#18 F-003: 主管審核請假

## Layout

```
┌──────────────────────────────────────────────────────┐
│ Header: [≡] 審核歷史                  [Avatar ▼]      │
├────────────┬─────────────────────────────────────────┤
│ Sidebar    │ Main Content                            │
│            │                                         │
│            │ ┌── PageHeader ──────────────────────┐  │
│            │ │ 審核歷史              [待審核 (3)] │  │
│            │ │ 已處理的請假審核紀錄               │  │
│            │ └────────────────────────────────────┘  │
│            │                                         │
│            │ ┌── Filters ─────────────────────────┐  │
│            │ │ [狀態 ▼] [日期範圍 📅]             │  │
│            │ └────────────────────────────────────┘  │
│            │                                         │
│            │ ┌── DataTable ───────────────────────┐  │
│            │ │ |員工  |假別 |日期   |時數|結果  | │  │
│            │ │ |------|-----|-------|----|----- | │  │
│            │ │ |王小明|特休 |04/10  |8h |已核准| │  │
│            │ │ |李小華|事假 |04/08  |4h |已駁回| │  │
│            │ │                                    │  │
│            │ │ [< 1 2 3 >]                       │  │
│            │ └────────────────────────────────────┘  │
└────────────┴─────────────────────────────────────────┘
```

## 頁面規格

| 項目 | 說明 |
|------|------|
| 路由 | `/leaves/history` |
| 認證 | 需要（role: manager 或 admin） |
| Layout | `AppLayout` |
| Breadcrumb | `[請假管理] > [審核歷史]` |

## API 呼叫

使用 `GET /api/v1/leaves/pending` 並加上 status filter（後端需支援，或使用獨立 endpoint）。

實際上此頁面顯示的是主管已審核過的請假單（status = approved / rejected），可由 `GET /api/v1/leaves?reviewer_id=me&status=approved,rejected` 取得。

## DataTable 欄位

| 欄位 | 寬度 | 內容 | 排序 |
|------|------|------|------|
| 員工 | 150px | Avatar + Name + Employee ID | 否 |
| 假別 | 100px | `LeaveTypeBadge` | 否 |
| 日期 | 180px | 日期範圍 + 半天標記 | 是 |
| 時數 | 80px | font-mono | 是 |
| 審核結果 | 100px | `LeaveStatusBadge` | 是 |
| 審核備註 | flex | `line-clamp-1` | 否 |
| 審核時間 | 130px | `yyyy/MM/dd HH:mm` | 是 (預設降序) |

## 篩選器

| 篩選項 | 元件 | 選項 |
|--------|------|------|
| 審核結果 | `Select` | 全部 / 已核准 / 已駁回 |
| 審核日期 | 日期範圍選擇器 | 預設近 30 天 |

## 使用的元件

| 元件 | 來源 |
|------|------|
| AppLayout, PageHeader | `components/layout` |
| DataTable | `components/data-table` |
| LeaveTypeBadge | `components/leave-type-badge` |
| LeaveStatusBadge | `components/leave-status-badge` |
| Avatar | shadcn/ui |
| Select | shadcn/ui |
| EmptyState | `components/empty-state` |

## 響應式行為

| 斷點 | 變化 |
|------|------|
| >= 1024px (lg) | 完整表格 |
| 768-1023px (md) | 隱藏「審核備註」欄 |
| < 768px | Card 列表模式 |
