
"use client";

import { useState, type ReactNode } from "react";
import Link from 'next/link';
import {
  Home as HomeIcon,
  Megaphone,
  ShieldAlert,
  CalendarDays,
  Phone,
  User,
  LogOut,
} from "lucide-react";

import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarTrigger,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import MainDashboardView from "@/components/dashboard/main-dashboard-view";
import Announcements from "@/components/dashboard/announcements";
import ReportActivity from "@/components/dashboard/report-activity";
import Schedule from "@/components/dashboard/schedule";
import EmergencyContacts from "@/components/dashboard/emergency-contacts";
import { BarondaLogo } from "@/components/icons";

type View = "dashboard" | "announcements" | "report" | "schedule" | "contacts";

const viewConfig: Record<View, { title: string; icon: React.ElementType }> = {
  dashboard: { title: "Dasbor", icon: HomeIcon },
  announcements: { title: "Pengumuman", icon: Megaphone },
  report: { title: "Lapor Aktivitas", icon: ShieldAlert },
  schedule: { title: "Jadwal Patroli", icon: CalendarDays },
  contacts: { title: "Kontak Darurat", icon: Phone },
};

function AppLayout() {
  const [activeView, setActiveView] = useState<View>("dashboard");
  const { setOpenMobile, isMobile } = useSidebar();

  const handleViewChange = (view: View) => {
    setActiveView(view);
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  const renderView = (): ReactNode => {
    switch (activeView) {
      case "dashboard":
        return <MainDashboardView />;
      case "announcements":
        return <Announcements />;
      case "report":
        return <ReportActivity />;
      case "schedule":
        return <Schedule />;
      case "contacts":
        return <EmergencyContacts />;
      default:
        return <MainDashboardView />;
    }
  };

  const NavItem = ({ view }: { view: View }) => {
    const Icon = viewConfig[view].icon;
    return (
      <SidebarMenuItem>
        <SidebarMenuButton
          onClick={() => handleViewChange(view)}
          isActive={activeView === view}
        >
          <Icon />
          <span>{viewConfig[view].title}</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  return (
    <>
      <Sidebar collapsible="none" className="bg-sidebar">
        <SidebarHeader className="h-14 items-center justify-center p-2">
          <BarondaLogo className="h-8 w-auto shrink-0" />
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            {(Object.keys(viewConfig) as View[]).map((view) => (
              <NavItem key={view} view={view} />
            ))}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
                <SidebarMenuButton>
                    <Avatar className="size-7">
                        <AvatarImage src="https://placehold.co/40x40.png" alt="User" data-ai-hint="person portrait" />
                        <AvatarFallback>U</AvatarFallback>
                    </Avatar>
                    <span>Profil Pengguna</span>
                </SidebarMenuButton>
            </SidebarMenuItem>
             <SidebarMenuItem>
                <Link href="/auth/login">
                    <SidebarMenuButton>
                        <LogOut />
                        <span>Keluar</span>
                    </SidebarMenuButton>
                </Link>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <div className="flex flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-4 border-b bg-background/80 px-4 backdrop-blur-sm lg:h-[60px] lg:px-6">
          <div className="flex items-center gap-4">
            <SidebarTrigger className="lg:hidden" />
            <h1 className="text-lg font-semibold md:text-xl">
              {viewConfig[activeView].title}
            </h1>
          </div>
          <Button variant="outline" size="sm">
            <User className="mr-2" />
            Warga
          </Button>
        </header>
        <main className="flex-1 overflow-auto">
          <div className="mx-auto max-w-7xl p-4 md:p-8">{renderView()}</div>
        </main>
      </div>
    </>
  );
}

export default function Home() {
  return (
    <SidebarProvider>
      <AppLayout />
    </SidebarProvider>
  );
}
