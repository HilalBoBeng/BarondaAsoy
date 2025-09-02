
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
  ArrowLeft
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

  useEffect(() => {
    setIsClient(true);
    const userRole = localStorage.getItem('userRole');
    const staffInfo = JSON.parse(localStorage.getItem('staffInfo') || '{}');

    if (userRole !== 'admin') {
      router.replace('/auth/staff-login');
      toast({
        variant: "destructive",
        title: "Akses Ditolak",
        description: "Anda harus masuk sebagai admin untuk mengakses halaman ini.",
      });
    } else {
        if (staffInfo.name) {
            setAdminName(staffInfo.name);
        }
        if (staffInfo.email) {
            setAdminEmail(staffInfo.email);
        }

        // Setup badge listeners
        const reportsQuery = query(collection(db, 'reports'), where('status', '==', 'new'));
        const staffQuery = query(collection(db, 'staff'), where('status', '==', 'pending'));
        
        const unsubReports = onSnapshot(reportsQuery, (snap) => setBadgeCounts(prev => ({...prev, newReports: snap.size})));
        const unsubStaff = onSnapshot(staffQuery, (snap) => setBadgeCounts(prev => ({...prev, pendingStaff: snap.size})));
        
        return () => {
          unsubReports();
          unsubStaff();
        }
    }
  }, [router, toast]);
  
  useEffect(() => {
    const duesDetailRegex = /^\/admin\/dues\/(.+)$/;
    const duesDetailMatch = pathname.match(duesDetailRegex);

    if (duesDetailMatch) {
        setIsDetailPage(true);
        setPageTitle('Riwayat Iuran');
    } else {
        setIsDetailPage(false);
        const activeItem = navItems.find(item => pathname.startsWith(item.href));
        setPageTitle(activeItem?.label || 'Dasbor Admin');
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
    { href: "/admin/reports", icon: ShieldAlert, label: "Laporan Masuk", badge: badgeCounts.newReports },
    { href: "/admin/announcements", icon: FileText, label: "Pengumuman" },
    { href: "/admin/users", icon: Users, label: "Manajemen Pengguna", badge: badgeCounts.pendingStaff },
    { href: "/admin/schedule", icon: Calendar, label: "Jadwal Patroli" },
    { href: "/admin/dues", icon: Landmark, label: "Iuran Warga" },
    { href: "/admin/emergency-contacts", icon: Phone, label: "Kontak Darurat" },
    { href: "/admin/notifications", icon: Bell, label: "Notifikasi" },
    { href: "/admin/settings", icon: Settings, label: "Pengaturan" },
  ];
  
  if (!isClient) {
      return null;
  }

  const NavHeader = () => (
    <div className="flex flex-col items-start p-4 text-left">
        <p className="font-bold text-base">{adminName}</p>
        <p className="text-sm text-muted-foreground">{adminEmail}</p>
        <p className="text-xs text-muted-foreground mt-1">Admin</p>
    </div>
  );

  const NavContent = () => (
    <div className="flex flex-col h-full">
      <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
         <Link
            href="/admin"
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary",
              pathname === "/admin" && "bg-muted text-primary"
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
              pathname.startsWith(item.href) && "bg-muted text-primary"
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
          {isDetailPage ? (
             <Button variant="outline" size="icon" className="shrink-0" onClick={() => router.back()}>
                <ArrowLeft className="h-5 w-5" />
                <span className="sr-only">Kembali</span>
              </Button>
          ) : (
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
          )}

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
