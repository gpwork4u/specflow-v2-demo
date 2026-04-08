# 加班申請頁

## 對應 Feature

#30 F-006: 加班申請

## Layout

```
+------------------------------------------------------+
| Header: [<-] 加班申請                    [Avatar v]    |
+------------+-----------------------------------------+
| Sidebar    | Main Content                            |
|            |                                         |
| Dashboard  | +-- PageHeader ----------------------+  |
| 打卡       | | 加班申請                            |  |
| -----      | | 填寫加班資料並提交申請              |  |
| 請假管理   | +------------------------------------+  |
| -----      |                                         |
| > 加班申請 | +-- OvertimeForm (Card) ------------+  |
|   加班紀錄 | | 本月加班統計                       |  |
| -----      | | [ProgressBar] 20h / 46h            |  |
| 補打卡申請 | |                                    |  |
| 補打卡紀錄 | | 加班日期 *                         |  |
| -----      | | [日曆 2026-04-07]                  |  |
| (主管)     | |                                    |  |
| 待審核     | | 開始時間 *       結束時間 *         |  |
| -----      | | [18:00]          [21:00]            |  |
| 通知中心   | |                                    |  |
|            | | 預估: 3.0 小時                     |  |
|            | | 累計: 23.0 / 46 小時               |  |
|            | |                                    |  |
|            | | 加班原因 *                         |  |
|            | | [textarea]                         |  |
|            | |                         0/500 字  |  |
|            | |                                    |  |
|            | |          [取消] [提交加班申請]      |  |
|            | +------------------------------------+  |
+------------+-----------------------------------------+
```

## 頁面規格

| 項目 | 說明 |
|------|------|
| 路由 | `/overtime/new` |
| 認證 | 需要（任何角色） |
| Layout | `AppLayout` |
| Breadcrumb | `[加班管理] > [加班申請]` |

## API 呼叫

| 時機 | API | 用途 |
|------|-----|------|
| 頁面載入 | `GET /api/v1/overtime?status=pending,approved&start_date={monthStart}&end_date={monthEnd}` | 計算本月已加班時數 + 已申請日期 |
| 提交 | `POST /api/v1/overtime` | 建立加班申請 |

## 互動行為

1. 頁面載入時呼叫 API 取得本月加班紀錄
2. 載入中顯示 `LoadingState` skeleton
3. 計算本月已加班時數（approved 的 hours 加總）並顯示 ProgressBar
4. 已有加班申請的日期（pending 或 approved）在 Calendar 中標記為不可選
5. 選擇日期和時間後，即時計算加班時數（0.5 小時為單位，無條件進位）
6. 若本月累計 > 46 小時，顯示警告並 disable 提交按鈕
7. 若單次 > 12 小時，顯示驗證錯誤
8. 點擊提交後出現確認 Dialog，確認後呼叫 API
9. 成功：Toast "加班申請已送出" + 導向 `/overtime`
10. 失敗：依錯誤碼顯示對應 Toast

## 錯誤處理

| 錯誤碼 | Toast 訊息 |
|--------|-----------|
| DATE_CONFLICT | 該日期已有加班申請 |
| INVALID_TIME_RANGE | 時間範圍不正確或超過上限 |
| MONTHLY_LIMIT_EXCEEDED | 本月加班時數已達上限 |
| PAST_DATE | 超過 7 天前，不可補申請 |

## 範例程式碼

```tsx
import { AppLayout } from "@/components/layout";
import { PageHeader } from "@/components/page-header";
import { OvertimeForm } from "@/components/overtime-form";
import { LoadingState } from "@/components/loading-state";
import { useToast } from "@/components/ui/use-toast";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { startOfMonth, endOfMonth, format } from "date-fns";

export default function OvertimeRequestPage() {
  const router = useRouter();
  const { toast } = useToast();
  const now = new Date();

  const { data: overtimeData, isLoading } = useQuery({
    queryKey: ["overtime", "current-month"],
    queryFn: () =>
      fetch(
        `/api/v1/overtime?start_date=${format(startOfMonth(now), "yyyy-MM-dd")}&end_date=${format(endOfMonth(now), "yyyy-MM-dd")}`
      ).then((r) => r.json()),
  });

  const createOvertime = useMutation({
    mutationFn: (data: OvertimeFormValues) =>
      fetch("/api/v1/overtime", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: format(data.date, "yyyy-MM-dd"),
          start_time: data.start_time,
          end_time: data.end_time,
          reason: data.reason,
        }),
      }).then((r) => {
        if (!r.ok) throw r;
        return r.json();
      }),
    onSuccess: () => {
      toast({ title: "加班申請已送出", description: "等待主管審核" });
      router.push("/overtime");
    },
    onError: async (err: Response) => {
      const body = await err.json();
      const messages: Record<string, string> = {
        DATE_CONFLICT: "該日期已有加班申請",
        INVALID_TIME_RANGE: "時間範圍不正確或超過上限",
        MONTHLY_LIMIT_EXCEEDED: "本月加班時數已達上限",
        PAST_DATE: "超過 7 天前，不可補申請",
      };
      toast({
        title: "申請失敗",
        description: messages[body.code] || "請稍後再試",
        variant: "destructive",
      });
    },
  });

  // 計算本月已加班時數
  const monthlyUsedHours = (overtimeData?.data || [])
    .filter((r: any) => r.status === "approved" || r.status === "pending")
    .reduce((sum: number, r: any) => sum + r.hours, 0);

  // 已有申請的日期
  const disabledDates = (overtimeData?.data || [])
    .filter((r: any) => r.status === "pending" || r.status === "approved")
    .map((r: any) => new Date(r.date));

  if (isLoading) {
    return (
      <AppLayout breadcrumbs={[{ label: "加班管理" }, { label: "加班申請" }]}>
        <LoadingState />
      </AppLayout>
    );
  }

  return (
    <AppLayout breadcrumbs={[{ label: "加班管理" }, { label: "加班申請" }]}>
      <PageHeader title="加班申請" description="填寫加班資料並提交申請" />

      <div className="max-w-2xl">
        <OvertimeForm
          onSubmit={(data) => createOvertime.mutateAsync(data)}
          isSubmitting={createOvertime.isPending}
          monthlyUsedHours={monthlyUsedHours}
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
| < 768px | Sidebar 隱藏（漢堡選單），時間選擇器堆疊為單欄 |

## 使用的元件

| 元件 | 來源 | 用途 |
|------|------|------|
| AppLayout | `components/layout` | 頁面框架 |
| PageHeader | `components/layout` | 頁面標題 |
| OvertimeForm | `components/overtime-form` | 加班表單（核心） |
| ConfirmDialog | `components/confirm-dialog` | 提交確認（OvertimeForm 內部） |
| Toast | `components/toast-notification` | 成功/失敗提示 |
| LoadingState | `components/loading-state` | 載入中 |
