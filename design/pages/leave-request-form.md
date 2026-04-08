# 請假申請頁

## 對應 Feature

#17 F-002: 請假申請

## Layout

```
┌──────────────────────────────────────────────────┐
│ Header: [←] 請假申請               [Avatar ▼]    │
├────────────┬─────────────────────────────────────┤
│ Sidebar    │ Main Content                        │
│            │                                     │
│ Dashboard  │ ┌── PageHeader ──────────────────┐  │
│ 打卡       │ │ 請假申請                       │  │
│ ─────      │ │ 填寫請假資料並提交申請         │  │
│ > 請假申請 │ └────────────────────────────────┘  │
│   請假紀錄 │                                     │
│   額度總覽 │ ┌── LeaveForm (Card) ────────────┐  │
│ ─────      │ │ 假別 *                         │  │
│ (主管)     │ │ [▼ 請選擇假別]                 │  │
│ 待審核     │ │                                │  │
│ ─────      │ │ [QuotaProgressBar]             │  │
│ (Admin)    │ │                                │  │
│ 額度管理   │ │ 開始日期 *     結束日期 *      │  │
│            │ │ [📅 ...]       [📅 ...]        │  │
│            │ │                                │  │
│            │ │ 時段選擇                       │  │
│            │ │ ○ 全天 ○ 上午 ○ 下午           │  │
│            │ │                                │  │
│            │ │ 📊 預計: 2 天 (16 小時)        │  │
│            │ │                                │  │
│            │ │ 請假原因 *                     │  │
│            │ │ [textarea]                     │  │
│            │ │                      0/500 字  │  │
│            │ │                                │  │
│            │ │          [取消] [提交請假申請]  │  │
│            │ └────────────────────────────────┘  │
└────────────┴─────────────────────────────────────┘
```

## 頁面規格

| 項目 | 說明 |
|------|------|
| 路由 | `/leaves/new` |
| 認證 | 需要（任何角色） |
| Layout | `AppLayout` |
| Breadcrumb | `[請假管理] > [請假申請]` |

## API 呼叫

| 時機 | API | 用途 |
|------|-----|------|
| 頁面載入 | `GET /api/v1/leave-quotas/me` | 取得額度資料 |
| 頁面載入 | `GET /api/v1/leaves?status=pending,approved` | 取得已有假的日期 |
| 選擇假別後 | 前端計算 | 顯示對應假別的額度 |
| 提交 | `POST /api/v1/leaves` | 建立請假單 |

## 互動行為

1. 頁面載入時同時呼叫額度 API 和已有假 API
2. 載入中顯示 `LoadingState` skeleton
3. 選擇假別後，下方即時顯示該假別的 `QuotaProgressBar`
4. 選擇日期後，即時計算時數並顯示
5. 若計算時數 > 剩餘額度，顯示警告並 disable 提交按鈕
6. 病假允許選擇 today - 3 的日期
7. 已有假的日期在 Calendar 中標記為不可選
8. 點擊提交後出現確認 Dialog，確認後呼叫 API
9. 成功：Toast "請假申請已送出" + 導向 `/leaves`
10. 失敗：依錯誤碼顯示對應 Toast（DATE_CONFLICT / INSUFFICIENT_QUOTA 等）

## 使用的元件

| 元件 | 來源 | 用途 |
|------|------|------|
| AppLayout | `components/layout` | 頁面框架 |
| PageHeader | `components/layout` | 頁面標題 |
| LeaveForm | `components/leave-form` | 請假表單（核心） |
| QuotaProgressBar | `components/quota-progress-bar` | 額度即時提示 |
| DateRangePicker | `components/date-range-picker` | 日期選擇 |
| LeaveTypeBadge | `components/leave-type-badge` | Select 選項中的假別標示 |
| ConfirmDialog | `components/confirm-dialog` | 提交確認 |
| Toast | `components/toast-notification` | 成功/失敗提示 |
| LoadingState | `components/loading-state` | 載入中 |

## 範例程式碼

```tsx
import { AppLayout } from "@/components/layout";
import { PageHeader } from "@/components/page-header";
import { LeaveForm } from "@/components/leave-form";
import { LoadingState } from "@/components/loading-state";
import { useToast } from "@/components/ui/use-toast";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";

export default function LeaveRequestPage() {
  const router = useRouter();
  const { toast } = useToast();

  const { data: quotas, isLoading: quotasLoading } = useQuery({
    queryKey: ["leave-quotas", "me"],
    queryFn: () => fetch("/api/v1/leave-quotas/me").then((r) => r.json()),
  });

  const { data: existingLeaves, isLoading: leavesLoading } = useQuery({
    queryKey: ["leaves", "existing"],
    queryFn: () =>
      fetch("/api/v1/leaves?status=pending,approved").then((r) => r.json()),
  });

  const createLeave = useMutation({
    mutationFn: (data: LeaveFormValues) =>
      fetch("/api/v1/leaves", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then((r) => {
        if (!r.ok) throw r;
        return r.json();
      }),
    onSuccess: () => {
      toast({ title: "請假申請已送出", description: "等待主管審核" });
      router.push("/leaves");
    },
    onError: async (err: Response) => {
      const body = await err.json();
      const messages: Record<string, string> = {
        DATE_CONFLICT: "該日期已有請假紀錄",
        INSUFFICIENT_QUOTA: "假別額度不足",
        PAST_DATE: "不可申請過去日期",
      };
      toast({
        title: "申請失敗",
        description: messages[body.code] || "請稍後再試",
        variant: "destructive",
      });
    },
  });

  if (quotasLoading || leavesLoading) {
    return (
      <AppLayout breadcrumbs={[{ label: "請假管理" }, { label: "請假申請" }]}>
        <LoadingState />
      </AppLayout>
    );
  }

  // 從已有假紀錄中提取日期
  const disabledDates = (existingLeaves?.data || []).flatMap((leave: any) => {
    // 展開 start_date ~ end_date 的所有日期
    const dates: Date[] = [];
    let d = new Date(leave.start_date);
    const end = new Date(leave.end_date);
    while (d <= end) {
      dates.push(new Date(d));
      d.setDate(d.getDate() + 1);
    }
    return dates;
  });

  return (
    <AppLayout breadcrumbs={[{ label: "請假管理" }, { label: "請假申請" }]}>
      <PageHeader
        title="請假申請"
        description="填寫請假資料並提交申請"
      />

      <div className="max-w-2xl">
        <LeaveForm
          onSubmit={(data) => createLeave.mutateAsync(data)}
          isSubmitting={createLeave.isPending}
          quotas={quotas?.quotas || []}
          disabledDates={disabledDates}
        />
      </div>
    </AppLayout>
  );
}
```

## 響應式行為

| 斷點 | 變化 |
|------|------|
| >= 1024px (lg) | Sidebar 固定，表單 max-w-2xl 置中 |
| 768-1023px (md) | Sidebar 可收合，表單佔滿 |
| < 768px | Sidebar 隱藏（漢堡選單），日期選擇器堆疊為單欄 |
