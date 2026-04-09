"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export interface DonutSegment {
  label: string;
  value: number;
  color: string; // Tailwind color class or hex
}

interface DonutChartProps {
  title: string;
  description?: string;
  segments: DonutSegment[];
  centerLabel?: string;
  centerValue?: string | number;
  size?: number;
}

export function DonutChart({
  title,
  description,
  segments,
  centerLabel,
  centerValue,
  size = 200,
}: DonutChartProps) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const radius = size / 2;
  const strokeWidth = size * 0.15;
  const innerRadius = radius - strokeWidth;
  const circumference = 2 * Math.PI * innerRadius;

  let cumulativeOffset = 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
            暫無資料
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div className="relative" style={{ width: size, height: size }}>
              <svg
                width={size}
                height={size}
                viewBox={`0 0 ${size} ${size}`}
                className="-rotate-90"
              >
                {/* Background circle */}
                <circle
                  cx={radius}
                  cy={radius}
                  r={innerRadius}
                  fill="none"
                  stroke="hsl(var(--muted))"
                  strokeWidth={strokeWidth}
                />
                {/* Segments */}
                {segments
                  .filter((s) => s.value > 0)
                  .map((segment) => {
                    const segmentLength = (segment.value / total) * circumference;
                    const offset = cumulativeOffset;
                    cumulativeOffset += segmentLength;
                    return (
                      <circle
                        key={segment.label}
                        cx={radius}
                        cy={radius}
                        r={innerRadius}
                        fill="none"
                        stroke={segment.color}
                        strokeWidth={strokeWidth}
                        strokeDasharray={`${segmentLength} ${circumference - segmentLength}`}
                        strokeDashoffset={-offset}
                        strokeLinecap="butt"
                        className="transition-all duration-500"
                      />
                    );
                  })}
              </svg>
              {/* Center text */}
              {(centerLabel || centerValue !== undefined) && (
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  {centerValue !== undefined && (
                    <span className="text-2xl font-bold">{centerValue}</span>
                  )}
                  {centerLabel && (
                    <span className="text-xs text-muted-foreground">{centerLabel}</span>
                  )}
                </div>
              )}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-1">
              {segments
                .filter((s) => s.value > 0)
                .map((segment) => (
                  <div key={segment.label} className="flex items-center gap-1.5">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: segment.color }}
                      aria-hidden="true"
                    />
                    <span className="text-xs text-muted-foreground">
                      {segment.label} {segment.value}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
