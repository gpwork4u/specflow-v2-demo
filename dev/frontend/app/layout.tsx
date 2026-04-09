"use client";

import "./globals.css";
import { QueryProvider } from "@/lib/query-provider";
import { Toaster } from "sonner";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-TW">
      <head>
        <title>HR 工時管理系統</title>
        <meta name="description" content="HR 工時管理系統" />
      </head>
      <body>
        <QueryProvider>
          {children}
          <Toaster richColors position="top-right" />
        </QueryProvider>
      </body>
    </html>
  );
}
