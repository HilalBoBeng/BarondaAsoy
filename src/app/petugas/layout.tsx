
"use client";

import Link from "next/link";
import {
  Home,
  LogOut,
  ShieldAlert,
  Calendar,
  Menu,
  FileText,
  Settings,
  Landmark,
  Phone
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetHeader } from "@/components/ui/sheet";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { Badge } from "@/components/ui/badge";
import Image from "next/image";

export default function PetugasLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();
  const [isClient, setIsClient] = useState(false);
  const [staffName, setStaffName] = useState("Petugas");
  const [staffEmail, setStaffEmail] = useState("petugas@baronda.app");
  const [badgeCounts, setBadgeCounts] = useState({ newReports: 0, myReports: 0, pendingSchedules: 0 });
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [pageTitle, setPageTitle] = useState("Dasbor Petugas");

  useEffect(() => {
    setIsClient(true);
    const userRole = localStorage.getItem('userRole');
    const staffInfo = JSON.parse(localStorage.getItem('staffInfo') || '{}');

    if (userRole !== 'petugas') {
      router.replace('/auth/staff-login');
       toast({
        variant: "destructive",
        title: "Akses Ditolak",
        description: "Anda harus masuk sebagai petugas untuk mengakses halaman ini.",
      });
    } else {
        if (staffInfo.name) {
            setStaffName(staffInfo.name);
        }
        if (staffInfo.email) {
            setStaffEmail(staffInfo.email);
        }

        // Badge listeners
        const reportsRef = collection(db, 'reports');
        const newReportsQuery = query(reportsRef, where('status', '==', 'new'));
        const myReportsQuery = query(reportsRef, where('handlerId', '==', staffInfo.id), where('status', '==', 'in_progress'));
        
        const scheduleQuery = query(collection(db, 'schedules'), where('officerId', '==', staffInfo.id), where('status', '==', 'Pending'));
        
        const unsubNewReports = onSnapshot(newReportsQuery, (snap) => setBadgeCounts(prev => ({...prev, newReports: snap.size})));
        const unsubMyReports = onSnapshot(myReportsQuery, (snap) => setBadgeCounts(prev => ({...prev, myReports: snap.size})));
        const unsubSchedules = onSnapshot(scheduleQuery, (snap) => setBadgeCounts(prev => ({...prev, pendingSchedules: snap.size})));
        
        return () => {
          unsubNewReports();
          unsubMyReports();
          unsubSchedules();
        }
    }
  }, [router, toast]);
  
  useEffect(() => {
    const duesDetailRegex = /^\/petugas\/dues\/(.+)$/;
    const match = pathname.match(duesDetailRegex);
    if (match && match[1]) {
      const userId = match[1];
      const storedName = localStorage.getItem(`userName-${userId}`);
      setPageTitle(storedName ? `Riwayat Iuran: ${storedName}` : "Memuat...");
    } else if (pathname === '/petugas/dues/record') {
        setPageTitle('Catat Iuran Warga');
    } else {
      const activeItem = navItems.find(item => pathname.startsWith(item.href));
      setPageTitle(activeItem?.label || 'Dasbor Petugas');
    }
  }, [pathname]);

  const handleLogout = () => {
    setIsLoggingOut(true);
    localStorage.removeItem('userRole');
    localStorage.removeItem('staffInfo');
    toast({ title: "Berhasil Keluar", description: "Anda telah keluar." });
    router.push('/');
  };

  const navItems = [
    { href: "/petugas/reports", icon: ShieldAlert, label: "Laporan Warga", badge: badgeCounts.newReports + badgeCounts.myReports },
    { href: "/petugas/schedule", icon: Calendar, label: "Jadwal Saya", badge: badgeCounts.pendingSchedules },
    { href: "/petugas/patrol-log", icon: FileText, label: "Patroli & Log" },
    { href: "/petugas/dues", icon: Landmark, label: "Iuran Warga" },
    { href: "/petugas/emergency-contacts", icon: Phone, label: "Kontak Darurat" },
    { href: "/petugas/settings", icon: Settings, label: "Pengaturan" },
  ];

  if (!isClient) {
    return null;
  }
  
  const NavHeader = () => (
    <div className="flex flex-col items-start p-4 text-left">
        <p className="font-bold text-base">{staffName}</p>
        <p className="text-sm text-muted-foreground">{staffEmail}</p>
        <p className="text-xs text-muted-foreground mt-1">Petugas</p>
    </div>
  );


  const NavContent = () => (
    <div className="flex flex-col h-full">
      <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
         <Link
            href="/petugas"
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary",
              pathname === "/petugas" && "bg-muted text-primary"
            )}
          >
            <Home className="h-4 w-4" />
            Dasbor
          </Link>
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary",
              pathname.startsWith(item.href) && !pathname.includes('/dues/') && "bg-muted text-primary"
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
            {isLoggingOut ? 'Keluar...' : 'Keluar'}
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
            <Sheet>
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
                  <SheetHeader className="p-0 border-b">
                    <SheetTitle className="sr-only">Menu Navigasi</SheetTitle>
                    <NavHeader />
                  </SheetHeader>
                <div className="flex-1 overflow-auto py-2">
                    <NavContent />
                </div>
              </SheetContent>
            </Sheet>

           <div className="w-full flex-1">
             <h1 className="text-lg font-semibold md:text-2xl truncate">
              {pageTitle}
            </h1>
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
                priority
              />
          </div>
        </header>
        <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6 bg-gray-100/40 dark:bg-muted/40 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
