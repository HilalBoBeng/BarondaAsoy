
"use client";

import Link from "next/link";
import {
  Bell,
  Home,
  Users,
  FileText,
  Calendar,
  LogOut,
  ShieldAlert,
  Phone,
  Menu,
  MessageSquare,
  Settings,
  Landmark,
  ArrowLeft,
  QrCode,
  Banknote,
  ClipboardList,
  User as UserIcon,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetHeader } from "@/components/ui/sheet";
import Image from "next/image";
import { collection, onSnapshot, query, where, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();
  const [isClient, setIsClient] = useState(false);
  const [adminName, setAdminName] = useState("Admin");
  const [adminEmail, setAdminEmail] = useState("admin@baronda.app");
  const [badgeCounts, setBadgeCounts] = useState({
    newReports: 0,
    pendingStaff: 0,
  });
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [pageTitle, setPageTitle] = useState("Dasbor Admin");
  const [isDetailPage, setIsDetailPage] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

    const navItems = [
        { href: "/admin", icon: Home, label: "Dasbor" },
        { href: "/admin/profile", icon: UserIcon, label: "Profil Saya" },
        { href: "/admin/reports", icon: ShieldAlert, label: "Laporan Masuk", badge: badgeCounts.newReports },
        { href: "/admin/announcements", icon: FileText, label: "Pengumuman" },
        { href: "/admin/users", icon: Users, label: "Manajemen Pengguna", badge: badgeCounts.pendingStaff },
        { href: "/admin/schedule", icon: Calendar, label: "Jadwal Patroli" },
        { href: "/admin/attendance", icon: ClipboardList, label: "Daftar Hadir" },
        { href: "/admin/dues", icon: Landmark, label: "Iuran Warga" },
        { href: "/admin/honor", icon: Banknote, label: "Honorarium" },
        { href: "/admin/tools", icon: Wrench, label: "Lainnya" },
        { href: "/admin/emergency-contacts", icon: Phone, label: "Kontak Darurat" },
        { href: "/admin/notifications", icon: Bell, label: "Notifikasi" },
    ];

  useEffect(() => {
    setIsClient(true);
    const userRole = localStorage.getItem('userRole');
    const staffInfo = JSON.parse(localStorage.getItem('staffInfo') || '{}');

    if (userRole !== 'admin') {
      router.replace('/auth/staff-login');
    } else {
        if (staffInfo.name) {
            setAdminName(staffInfo.name);
        }
        if (staffInfo.email) {
            setAdminEmail(staffInfo.email);
        }

        const reportsQuery = query(collection(db, 'reports'), where('status', '==', 'new'));
        const staffQuery = query(collection(db, 'staff'), where('status', '==', 'pending'));
        
        const unsubReports = onSnapshot(reportsQuery, (snap) => setBadgeCounts(prev => ({...prev, newReports: snap.size})));
        const unsubStaff = onSnapshot(staffQuery, (snap) => setBadgeCounts(prev => ({...prev, pendingStaff: snap.size})));
        
        return () => {
          unsubReports();
          unsubStaff();
        }
    }
  }, [router]);
  
  useEffect(() => {
    const duesDetailRegex = /^\/admin\/dues\/(.+)$/;
    const scheduleDetailRegex = /^\/admin\/schedule\/(.+)$/;
    const honorDetailRegex = /^\/admin\/honor\/(.+)$/;
    const duesDetailMatch = pathname.match(duesDetailRegex);
    const scheduleDetailMatch = pathname.match(scheduleDetailRegex);
    const honorDetailMatch = pathname.match(honorDetailRegex);

    if (duesDetailMatch) {
      setIsDetailPage(true);
      setPageTitle('Riwayat Iuran');
    } else if (scheduleDetailMatch) {
      setIsDetailPage(true);
      setPageTitle('Detail Jadwal & QR Code');
    } else if (honorDetailMatch) {
        setIsDetailPage(true);
        setPageTitle('Detail Honorarium');
    }
     else {
      setIsDetailPage(false);
      const activeItem = navItems.find(item => pathname === item.href || (pathname.startsWith(item.href) && item.href !== '/admin'));
      setPageTitle(activeItem?.label || 'Dasbor Admin');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const handleLogout = () => {
    setIsLoggingOut(true);
    localStorage.removeItem('userRole');
    localStorage.removeItem('staffInfo');

    setTimeout(() => {
        router.push('/');
    }, 1500); 
  };
  
  if (!isClient || isLoggingOut) {
      return (
        <div className={cn("flex min-h-screen flex-col items-center justify-center bg-background transition-opacity duration-500", isLoggingOut ? "animate-fade-out" : "")}>
            <Image 
                src="https://iili.io/KJ4aGxp.png" 
                alt="Loading Logo" 
                width={120} 
                height={120} 
                className="animate-logo-pulse"
                priority
            />
            {isLoggingOut && <p className="mt-4 text-lg text-muted-foreground animate-fade-in">Anda sedang dialihkan...</p>}
        </div>
      );
  }

  const NavHeader = () => (
    <div className="flex items-center gap-4 p-4 text-left">
        <Avatar className="h-12 w-12">
            <AvatarImage src={undefined} />
            <AvatarFallback className="text-xl bg-primary text-primary-foreground">{adminName.charAt(0).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="flex flex-col">
            <p className="font-bold text-base truncate">{adminName}</p>
            <p className="text-sm text-muted-foreground truncate">{adminEmail}</p>
            <Badge variant="secondary" className="mt-2 w-fit">Administrator</Badge>
        </div>
    </div>
  );

  const NavContent = ({ onLinkClick }: { onLinkClick?: () => void }) => (
    <div className="flex flex-col h-full">
      <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
        {navItems.map((item) => (
          <Link
            key={item.href + item.label}
            href={item.href}
            onClick={onLinkClick}
            className={cn(
              "flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary",
              (pathname === item.href || (pathname.startsWith(item.href) && item.href !== '/admin')) && "bg-muted text-primary"
            )}
          >
            <div className="flex items-center gap-3">
              <item.icon className="h-4 w-4" />
              {item.label}
            </div>
            {item.badge > 0 && <Badge className="h-5">{item.badge}</Badge>}
          </Link>
        ))}
      </nav>
      <div className="mt-auto p-4">
        <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground hover:text-primary" onClick={handleLogout} disabled={isLoggingOut}>
            <LogOut className="mr-2 h-4 w-4" />
            Keluar
        </Button>
      </div>
    </div>
  );

  return (
    <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
      <div className="hidden border-r bg-muted/40 md:flex md:flex-col">
        <div className="flex h-auto items-center border-b px-2 lg:h-auto lg:px-4 py-2">
            <NavHeader />
        </div>
        <div className="flex-1 overflow-auto py-2">
            <NavContent />
        </div>
      </div>
      <div className="flex flex-col">
        <header className="flex h-14 items-center gap-4 border-b bg-muted/40 px-4 lg:h-[60px] lg:px-6">
          <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="shrink-0 md:hidden"
              >
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle navigation menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="flex flex-col p-0">
               <SheetHeader className="p-4 border-b">
                   <SheetTitle className="sr-only">Menu Navigasi</SheetTitle>
                   <NavHeader />
               </SheetHeader>
              <div className="flex-1 overflow-auto py-2">
                <NavContent onLinkClick={() => setIsSheetOpen(false)} />
              </div>
            </SheetContent>
          </Sheet>
          
          <div className="w-full flex-1">
             {isDetailPage ? (
                 <Button variant="ghost" size="sm" className="gap-1 pl-0.5" onClick={() => router.back()}>
                    <ArrowLeft className="h-4 w-4" />
                    <h1 className="text-lg font-semibold md:text-2xl truncate">{pageTitle}</h1>
                 </Button>
             ) : (
                <h1 className="text-lg font-semibold md:text-2xl truncate">{pageTitle}</h1>
             )}
          </div>

          <div className="flex items-center gap-2 text-right">
              <div className="flex flex-col">
                  <span className="text-sm font-bold text-primary leading-tight">Baronda</span>
                  <p className="text-xs text-muted-foreground leading-tight">Kelurahan Kilongan</p>
              </div>
              <Image 
                src="https://iili.io/KJ4aGxp.png" 
                alt="Logo" 
                width={32} 
                height={32}
                className="h-8 w-8 rounded-full object-cover"
              />
          </div>
        </header>
        <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6 bg-gray-100/40 dark:bg-muted/40 overflow-auto">
          <div className="overflow-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
