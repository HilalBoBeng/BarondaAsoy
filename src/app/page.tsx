
"use client";

import { useState, type ReactNode } from "react";
import {
  Home as HomeIcon,
  Megaphone,
  ShieldAlert,
  CalendarDays,
  Phone,
  User,
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
  SidebarInset,
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
  dashboard: { title: "Dashboard", icon: HomeIcon },
  announcements: { title: "Announcements", icon: Megaphone },
  report: { title: "Report Activity", icon: ShieldAlert },
  schedule: { title: "Patrol Schedule", icon: CalendarDays },
  contacts: { title: "Emergency Contacts", icon: Phone },
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
          tooltip={viewConfig[view].title}
        >
          <Icon />
          <span>{viewConfig[view].title}</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  return (
    <>
      <Sidebar collapsible="icon" className="bg-sidebar">
        <SidebarHeader className="h-14 items-center justify-center p-2 group-data-[collapsible=icon]:h-auto group-data-[collapsible=icon]:py-2">
          <BarondaLogo className="h-8 w-auto shrink-0 transition-all duration-200 group-data-[collapsible=icon]:h-6" />
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
                <SidebarMenuButton tooltip="Profile">
                    <Avatar className="size-7">
                        <AvatarImage src="https://placehold.co/40x40.png" alt="User" data-ai-hint="person portrait" />
                        <AvatarFallback>U</AvatarFallback>
                    </Avatar>
                    <span>User Profile</span>
                </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <div className="flex flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-4 border-b bg-background/80 px-4 backdrop-blur-sm lg:h-[60px] lg:px-6">
          <div className="flex items-center gap-4">
            <SidebarTrigger />
            <h1 className="text-lg font-semibold md:text-xl">
              {viewConfig[activeView].title}
            </h1>
          </div>
          <Button variant="outline" size="sm">
            <User className="mr-2" />
            Warga
          </Button>
        </header>
        <SidebarInset className="flex-1 overflow-auto">
          <main className="p-4 md:p-8">{renderView()}</main>
        </SidebarInset>
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
