# 補打卡申請頁

## 對應 Feature

#32 F-010: 補打卡申請

## Layout

```
+------------------------------------------------------+
| Header: [<-] 補打卡申請                  [Avatar v]    |
+------------+-----------------------------------------+
| Sidebar    | Main Content                            |
|            |                                         |
| Dashboard  | +-- PageHeader ----------------------+  |
| 打卡       | | 補打卡申請                          |  |
| -----      | | 忘記打卡時可在此申請補登             |  |
| 請假管理   | +------------------------------------+  |
| -----      |                                         |
| 加班管理   | +-- MissedClockForm (Card) ---------+  |
| -----      | | (i) 補打卡僅適用於忘記打卡的情況，  |  |
| > 補打卡申請| |     申請後需由主管審核。限 7 天內。  |  |
|   補打卡紀錄| |                                    |  |
| -----      | | 補打卡日期 *                       |  |
| (主管)     | | [日曆 2026-04-06]                  |  |
| 待審核     | |                                    |  |
| -----      | | 打卡類型 *                         |  |
| 通知中心   | | [(x) 上班打卡] [( ) 下班打卡]      |  |
|            | |                                    |  |
|            | | 補打卡時間 *                       |  |
|            | | [09:00]                            |  |
|            | |                                    |  |
|            | | 補打卡原因 *                       |  |
|            | | [textarea]                         |  |
|            | |                         0/500 字  |  |
|            | |                                    |  |
|            | |        [取消] [提交補打卡申請]      |  |
|            | +------------------------------------+  |
+------------+-----------------------------------------+
```

## 頁面規格

| 項目 | 說明 |
|------|------|
| 路由 | `/missed-clocks/new` |
| 認證 | 需要（任何角色） |
| Layout | `AppLayout` |
| Breadcrumb | `[補打卡管理] > [補打卡申請]` |

## API 呼叫

| 時機 | API | 用途 |
|------|-----|------|
| 頁面載入 | `GET /api/v1/missed-clocks?status=pending,approved` | 取得已有補打卡的日期/類型 |
| 頁面載入 | `GET /api/v1/clock?start_date={7daysAgo}&end_date={today}` | 取得近 7 天已打卡的日期/類型 |
| 提交 | `POST /api/v1/missed-clocks` | 建立補打卡申請 |

## 互動行為

1. 頁面載入時同時呼叫兩個 API
2. 載入中顯示 `LoadingState` skeleton
3. 合併已打卡和已申請資料為 `disabledEntries`
4. 使用者選擇日期 -> 選擇打卡類型 -> 若日期+類型組合有衝突則顯示警告
5. 選擇補打卡時間（依打卡類型過濾合理時段）
6. 輸入原因，即時字數統計
7. 點擊提交 -> 跳出確認 Dialog
8. 確認後呼叫 API，成功後跳轉至 `/missed-clocks`
9. 失敗時依錯誤碼顯示對應 Toast

## 錯誤處理

| 錯誤碼 | Toast 訊息 |
|--------|-----------|
| ALREADY_EXISTS | 該日期已有相同類型的補打卡申請 |
| ALREADY_CLOCKED | 該日期已有打卡紀錄，無需補打卡 |
| PAST_DATE | 超過 7 天前，不可申請 |

## 範例程式碼

```tsx
import { AppLayout } from "@/components/layout";
import { PageHeader } from "@/components/page-header";
import { MissedClockForm } from "@/components/missed-clock-form";
import { LoadingState } from "@/components/loading-state";
import { useToast } from "@/components/ui/use-toast";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { subDays, format } from "date-fns";

export default function MissedClockRequestPage() {
  const router = useRouter();
  const { toast } = useToast();
  const today = new Date();
  const sevenDaysAgo = subDays(today, 7);

  // 已有的補打卡申請
  const { data: missedClocks, isLoading: mcLoading } = useQuery({
    queryKey: ["missed-clocks", "existing"],
    queryFn: () =>
      fetch("/api/v1/missed-clocks?status=pending,approved").then((r) => r.json()),
  });

  // 近 7 天的打卡紀錄
  const { data: clockRecords, isLoading: crLoading } = useQuery({
    queryKey: ["clock", "recent"],
    queryFn: () =>
      fetch(
        `/api/v1/clock?start_date=${format(sevenDaysAgo, "yyyy-MM-dd")}&end_date=${format(today, "yyyy-MM-dd")}`
      ).then((r) => r.json()),
  });

  const createMissedClock = useMutation({
    mutationFn: (data: MissedClockFormValues) =>
      fetch("/api/v1/missed-clocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: format(data.date, "yyyy-MM-dd"),
          clock_type: data.clock_type,
          requested_time: `${format(data.date, "yyyy-MM-dd")}T${data.requested_time}:00+08:00`,
          reason: data.reason,
        }),
      }).then((r) => {
        if (!r.ok) throw r;
        return r.json();
      }),
    onSuccess: () => {
      toast({ title: "補打卡申請已送出", description: "等待主管審核" });
      router.push("/missed-clocks");
    },
    onError: async (err: Response) => {
      const body = await err.json();
      const messages: Record<string, string> = {
        ALREADY_EXISTS: "該日期已有相同類型的補打卡申請",
        ALREADY_CLOCKED: "該日期已有打卡紀錄，無需補打卡",
        PAST_DATE: "超過 7 天前，不可申請",
      };
      toast({
        title: "申請失敗",
        description: messages[body.code] || "請稍後再試",
        variant: "destructive",
      });
    },
  });

  const isLoading = mcLoading || crLoading;

  // 合併已打卡和已申請為 disabledEntries
  const disabledEntries: DisabledEntry[] = [
    ...(missedClocks?.data || []).map((mc: any) => ({
      date: mc.date,
      clock_type: mc.clock_type,
      reason: "pending_request" as const,
    })),
    ...(clockRecords?.data || []).flatMap((cr: any) => {
      const entries: DisabledEntry[] = [];
      if (cr.clock_in) {
        entries.push({ date: cr.date, clock_type: "clock_in", reason: "already_clocked" });
      }
      if (cr.clock_out) {
        entries.push({ date: cr.date, clock_type: "clock_out", reason: "already_clocked" });
      }
      return entries;
    }),
  ];

  if (isLoading) {
    return (
      <AppLayout breadcrumbs={[{ label: "補打卡管理" }, { label: "補打卡申請" }]}>
        <LoadingState />
      </AppLayout>
    );
  }

  return (
    <AppLayout breadcrumbs={[{ label: "補打卡管理" }, { label: "補打卡申請" }]}>
      <PageHeader title="補打卡申請" description="忘記打卡時可在此申請補登" />

      <div className="max-w-2xl">
        <MissedClockForm
          onSubmit={(data) => createMissedClock.mutateAsync(data)}
          isSubmitting={createMissedClock.isPending}
          disabledEntries={disabledEntries}
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
| < 768px | Sidebar 隱藏（漢堡選單），ToggleGroup 全寬堆疊 |

## 使用的元件

| 元件 | 來源 | 用途 |
|------|------|------|
| AppLayout | `components/layout` | 頁面框架 |
| PageHeader | `components/layout` | 頁面標題 |
| MissedClockForm | `components/missed-clock-form` | 補打卡表單（核心） |
| ConfirmDialog | `components/confirm-dialog` | 提交確認（表單內部） |
| Toast | `components/toast-notification` | 成功/失敗提示 |
| LoadingState | `components/loading-state` | 載入中 |
