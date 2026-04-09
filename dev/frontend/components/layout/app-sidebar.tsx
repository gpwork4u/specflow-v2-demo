"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  Clock,
  CalendarDays,
  Users,
  Building2,
  KeyRound,
  LogOut,
  FileText,
  CalendarCheck,
  BarChart3,
  ClipboardList,
  Timer,
  FileClock,
  Bell,
  Calendar,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  title: string;
  icon: LucideIcon;
  href: string;
  roles: string[];
}

const mainNavItems: NavItem[] = [
  { title: "Dashboard", icon: LayoutDashboard, href: "/", roles: ["employee", "manager", "admin"] },
  { title: "打卡", icon: Clock, href: "/clock", roles: ["employee", "manager", "admin"] },
  { title: "打卡紀錄", icon: CalendarDays, href: "/clock/records", roles: ["employee", "manager", "admin"] },
  { title: "請假申請", icon: FileText, href: "/leave/request", roles: ["employee", "manager", "admin"] },
  { title: "我的請假", icon: CalendarCheck, href: "/leave/my", roles: ["employee", "manager", "admin"] },
  { title: "個人行事曆", icon: Calendar, href: "/calendar", roles: ["employee", "manager", "admin"] },
  { title: "個人報表", icon: BarChart3, href: "/reports/personal", roles: ["employee", "manager", "admin"] },
  { title: "加班申請", icon: Timer, href: "/overtime", roles: ["employee", "manager", "admin"] },
  { title: "補打卡", icon: FileClock, href: "/missed-clock", roles: ["employee", "manager", "admin"] },
  { title: "通知", icon: Bell, href: "/notifications", roles: ["employee", "manager", "admin"] },
];

const managerNavItems: NavItem[] = [
  { title: "待審核 - 請假", icon: ClipboardList, href: "/approval/leave", roles: ["manager", "admin"] },
  { title: "待審核 - 加班", icon: ClipboardList, href: "/approval/overtime", roles: ["manager", "admin"] },
  { title: "待審核 - 補打卡", icon: ClipboardList, href: "/approval/missed-clock", roles: ["manager", "admin"] },
  { title: "團隊行事曆", icon: Calendar, href: "/calendar/team", roles: ["manager", "admin"] },
  { title: "團隊報表", icon: BarChart3, href: "/reports/team", roles: ["manager", "admin"] },
];

const adminNavItems: NavItem[] = [
  { title: "員工管理", icon: Users, href: "/employees", roles: ["admin"] },
  { title: "部門管理", icon: Building2, href: "/departments", roles: ["admin"] },
  { title: "假別額度", icon: FileText, href: "/quota", roles: ["admin"] },
  { title: "全公司報表", icon: BarChart3, href: "/reports/company", roles: ["admin"] },
];

interface AppSidebarProps {
  role: string;
  onChangePassword: () => void;
  onLogout: () => void;
}

export function AppSidebar({ role, onChangePassword, onLogout }: AppSidebarProps) {
  const pathname = usePathname();

  const filteredMain = mainNavItems.filter((item) => item.roles.includes(role));
  const filteredManager = managerNavItems.filter((item) => item.roles.includes(role));
  const filteredAdmin = adminNavItems.filter((item) => item.roles.includes(role));

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-2 px-4 py-2">
          <Clock className="h-6 w-6 text-primary" />
          <span className="text-lg font-semibold">HR 工時系統</span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>主選單</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredMain.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.href}
                  >
                    <Link href={item.href}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {filteredManager.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>審核管理</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {filteredManager.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname === item.href}
                    >
                      <Link href={item.href}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {filteredAdmin.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>系統管理</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {filteredAdmin.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname === item.href}
                    >
                      <Link href={item.href}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={onChangePassword}>
              <KeyRound className="h-4 w-4" />
              <span>變更密碼</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={onLogout}>
              <LogOut className="h-4 w-4" />
              <span>登出</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
