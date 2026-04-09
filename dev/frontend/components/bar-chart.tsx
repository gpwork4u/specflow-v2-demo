"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface BarItem {
  label: string;
  value: number;
  color?: string;
}

interface HorizontalBarChartProps {
  title: string;
  description?: string;
  items: BarItem[];
  maxValue?: number;
  unit?: string;
}

export function HorizontalBarChart({
  title,
  description,
  items,
  maxValue,
  unit = "%",
}: HorizontalBarChartProps) {
  const max = maxValue ?? Math.max(...items.map((i) => i.value), 1);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
            暫無資料
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => {
              const pct = max > 0 ? (item.value / max) * 100 : 0;
              return (
                <div key={item.label} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{item.label}</span>
                    <span className="text-muted-foreground">
                      {item.value}
                      {unit}
                    </span>
                  </div>
                  <div className="h-3 w-full rounded-full bg-muted">
                    <div
                      className={cn(
                        "h-3 rounded-full transition-all duration-500",
                        item.color || "bg-primary"
                      )}
                      style={{
                        width: `${Math.min(pct, 100)}%`,
                        ...(item.color?.startsWith("#") || item.color?.startsWith("hsl")
                          ? { backgroundColor: item.color }
                          : {}),
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
