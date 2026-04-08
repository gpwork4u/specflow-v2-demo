# 請假單詳情

## 對應 Feature

#17 F-002: 請假申請

## Layout

```
┌──────────────────────────────────────────────────────┐
│ Header: [←] 請假單詳情                [Avatar ▼]     │
├────────────┬─────────────────────────────────────────┤
│ Sidebar    │ Main Content                            │
│            │                                         │
│            │ ┌── PageHeader ──────────────────────┐  │
│            │ │ 請假單詳情          [已核准] badge  │  │
│            │ │ #LV-2026-0001                      │  │
│            │ └────────────────────────────────────┘  │
│            │                                         │
│            │ ┌── 申請資訊 Card ───────────────────┐  │
│            │ │ 申請人   王小明 (EMP001) 工程部     │  │
│            │ │ 假別     [特休]                     │  │
│            │ │ 日期     2026/04/10 (下午) ~ 04/14 │  │
│            │ │ 時數     36 小時 (4.5 天)           │  │
│            │ │ 原因     出國旅遊                   │  │
│            │ │ 申請時間  2026/04/07 10:00          │  │
│            │ └────────────────────────────────────┘  │
│            │                                         │
│            │ ┌── 審核結果 Card ───────────────────┐  │
│            │ │ 審核人   李大華（主管）             │  │
│            │ │ 審核結果  [已核准]                  │  │
│            │ │ 審核備註  核准                      │  │
│            │ │ 審核時間  2026/04/07 14:00          │  │
│            │ └────────────────────────────────────┘  │
│            │                                         │
│            │ ┌── 狀態 Timeline ───────────────────┐  │
│            │ │ ● 申請提交    2026/04/07 10:00     │  │
│            │ │ │                                  │  │
│            │ │ ● 主管核准    2026/04/07 14:00     │  │
│            │ └────────────────────────────────────┘  │
│            │                                         │
│            │ (pending 狀態顯示 [取消申請] 按鈕)       │
└────────────┴─────────────────────────────────────────┘
```

## 頁面規格

| 項目 | 說明 |
|------|------|
| 路由 | `/leaves/:id` |
| 認證 | 需要（申請人本人、主管、Admin） |
| Layout | `AppLayout` |
| Breadcrumb | `[請假管理] > [請假紀錄] > [詳情]` |

## API 呼叫

| 時機 | API | 用途 |
|------|-----|------|
| 頁面載入 | `GET /api/v1/leaves/:id` | 取得請假單詳情 |
| 取消 | `PUT /api/v1/leaves/:id/cancel` | 取消請假 |

## 內容區塊

### 1. 申請資訊 Card

| 欄位 | 元件 | 說明 |
|------|------|------|
| 申請人 | Avatar + Name + Employee ID + Department | 僅主管/Admin 視角顯示 |
| 假別 | `LeaveTypeBadge` | |
| 日期 | 文字 | 含半天標記 |
| 時數 | 文字 `font-mono font-medium` | |
| 原因 | 文字（完整顯示，不截斷） | |
| 申請時間 | 文字 `text-muted-foreground` | |

### 2. 審核結果 Card（僅 approved / rejected 顯示）

| 欄位 | 元件 | 說明 |
|------|------|------|
| 審核人 | Avatar + Name | |
| 審核結果 | `LeaveStatusBadge` | |
| 審核備註 | 文字 | 無備註顯示 "-" |
| 審核時間 | 文字 `text-muted-foreground` | |

### 3. 狀態 Timeline

垂直時間軸，顯示請假單的生命周期事件。

```tsx
// Timeline 項目
const timelineItems = [
  { label: "申請提交", time: leave.created_at, icon: Send, color: "blue" },
  // 若已審核
  leave.reviewed_at && {
    label: leave.status === "approved" ? "主管核准" : "主管駁回",
    time: leave.reviewed_at,
    icon: leave.status === "approved" ? CheckCircle2 : XCircle,
    color: leave.status === "approved" ? "green" : "red",
  },
  // 若已取消
  leave.status === "cancelled" && {
    label: "已取消",
    time: leave.updated_at,
    icon: Ban,
    color: "gray",
  },
].filter(Boolean);
```

## 外觀規格

| 部位 | 樣式 |
|------|------|
| 資訊 Card | `Card p-6 space-y-4` |
| 欄位 Row | `flex justify-between items-center py-2 border-b last:border-0` |
| Label | `text-sm text-muted-foreground w-[100px] shrink-0` |
| Value | `text-sm text-right` |
| Timeline 線 | `border-l-2 border-muted ml-3 pl-6` |
| Timeline 點 | `absolute -left-[9px] h-4 w-4 rounded-full` 對應顏色 |
| 取消按鈕 | `Button variant="outline"` + 紅色 hover |

## 範例程式碼

```tsx
import { AppLayout } from "@/components/layout";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { LeaveTypeBadge } from "@/components/leave-type-badge";
import { LeaveStatusBadge } from "@/components/leave-status-badge";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  Send, CheckCircle2, XCircle, Ban, ArrowLeft,
} from "lucide-react";
import { format, parseISO, isAfter } from "date-fns";
import Link from "next/link";

export default function LeaveDetailPage({ params }: { params: { id: string } }) {
  const { data: leave, isLoading } = useQuery({
    queryKey: ["leave", params.id],
    queryFn: () => fetch(`/api/v1/leaves/${params.id}`).then((r) => r.json()),
  });

  const canCancel =
    leave?.status === "pending" ||
    (leave?.status === "approved" &&
      isAfter(parseISO(leave.start_date), new Date()));

  return (
    <AppLayout
      breadcrumbs={[
        { label: "請假管理" },
        { label: "請假紀錄", href: "/leaves" },
        { label: "詳情" },
      ]}
    >
      <PageHeader
        title="請假單詳情"
        description={`#${leave?.id?.slice(0, 8)}`}
        actions={<LeaveStatusBadge status={leave?.status} />}
        backLink="/leaves"
      />

      <div className="max-w-2xl space-y-6">
        {/* 申請資訊 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">申請資訊</CardTitle>
          </CardHeader>
          <CardContent className="space-y-0">
            <DetailRow label="假別">
              <LeaveTypeBadge leaveType={leave.leave_type} />
            </DetailRow>
            <DetailRow label="日期">
              {formatDateRange(leave)}
            </DetailRow>
            <DetailRow label="時數">
              <span className="font-mono font-medium">
                {leave.hours} 小時 ({leave.hours / 8} 天)
              </span>
            </DetailRow>
            <DetailRow label="原因">{leave.reason}</DetailRow>
            <DetailRow label="申請時間">
              {format(parseISO(leave.created_at), "yyyy/MM/dd HH:mm")}
            </DetailRow>
          </CardContent>
        </Card>

        {/* 審核結果 */}
        {leave.reviewer && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">審核結果</CardTitle>
            </CardHeader>
            <CardContent className="space-y-0">
              <DetailRow label="審核人">{leave.reviewer.name}</DetailRow>
              <DetailRow label="結果">
                <LeaveStatusBadge status={leave.status} />
              </DetailRow>
              <DetailRow label="備註">
                {leave.review_comment || "-"}
              </DetailRow>
              <DetailRow label="審核時間">
                {format(parseISO(leave.reviewed_at), "yyyy/MM/dd HH:mm")}
              </DetailRow>
            </CardContent>
          </Card>
        )}

        {/* 取消按鈕 */}
        {canCancel && (
          <div className="flex justify-end">
            <Button
              variant="outline"
              className="hover:border-destructive hover:text-destructive"
              onClick={() => setShowCancelDialog(true)}
            >
              <XCircle className="mr-2 h-4 w-4" />
              取消申請
            </Button>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between border-b py-3 last:border-0">
      <span className="w-[100px] shrink-0 text-sm text-muted-foreground">
        {label}
      </span>
      <div className="text-sm">{children}</div>
    </div>
  );
}
```

## 響應式行為

| 斷點 | 變化 |
|------|------|
| >= 768px (md) | Card max-w-2xl，Label-Value 水平排列 |
| < 768px | Card 全寬，Label-Value 堆疊 |

## 使用的元件

| 元件 | 來源 |
|------|------|
| AppLayout, PageHeader | `components/layout` |
| Card | shadcn/ui |
| Avatar | shadcn/ui |
| Button | shadcn/ui |
| LeaveTypeBadge | `components/leave-type-badge` |
| LeaveStatusBadge | `components/leave-status-badge` |
| ConfirmDialog | `components/confirm-dialog` |
