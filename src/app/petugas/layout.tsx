
"use client";

import Link from "next/link";
import {
  Home,
  LogOut,
  ShieldAlert,
  Calendar,
  Menu,
  FileText,
  Landmark,
  Phone,
  ArrowLeft,
  Bell,
  Megaphone,
  Banknote,
  Lock,
  User as UserIcon,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { useToast } from "@/hooks/use-toast";
import { cn, truncateName } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { collection, onSnapshot, query, where, getDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { Badge } from "@/components/ui/badge";
import Image from "next/image";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import NotPermittedPage from "@/app/not-permitted/page";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Staff } from "@/lib/types";


interface MenuConfig {
  id: string;
  label: string;
  visible: boolean;
  locked: boolean;
}

const navItemsList = [
    { id: 'dashboard', href: "/petugas", icon: Home, label: "Dasbor" },
    { id: 'profile', href: "/petugas/profile", icon: UserIcon, label: "Profil Saya" },
    { id: 'reports', href: "/petugas/reports", icon: ShieldAlert, label: "Laporan Warga", badgeKey: 'newReports' },
    { id: 'schedule', href: "/petugas/schedule", icon: Calendar, label: "Jadwal Saya", badgeKey: 'pendingSchedules' },
    { id: 'patrol-log', href: "/petugas/patrol-log", icon: FileText, label: "Patroli & Log" },
    { id: 'dues', href: "/petugas/dues", icon: Landmark, label: "Iuran Warga" },
    { id: 'honor', href: "/petugas/honor", icon: Banknote, label: "Honor Saya", badgeKey: 'newHonors' },
    { id: 'announcements', href: "/petugas/announcements", icon: Megaphone, label: "Pengumuman" },
    { id: 'notifications', href: "/petugas/notifications", icon: Bell, label: "Notifikasi" },
    { id: 'tools', href: "/petugas/tools", icon: Wrench, label: "Lainnya" },
    { id: 'emergency-contacts', href: "/petugas/emergency-contacts", icon: Phone, label: "Kontak Darurat" },
];


function LoadingSkeleton() {
  return (
    <div className={cn("flex min-h-screen flex-col items-center justify-center bg-background")}>
        <Image 
            src="https://iili.io/KJ4aGxp.png" 
            alt="Loading Logo" 
            width={120} 
            height={120} 
            className="animate-logo-pulse"
            priority
        />
    </div>
  )
}

export default function PetugasLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();
  const [isClient, setIsClient] = useState(false);
  const [staffInfo, setStaffInfo] = useState<Staff | null>(null);
  const [badgeCounts, setBadgeCounts] = useState({ newReports: 0, myReports: 0, pendingSchedules: 0, newHonors: 0 });
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [pageTitle, setPageTitle] = useState("Dasbor Petugas");
  const [isDetailPage, setIsDetailPage] = useState(false);
  const [isScanPage, setIsScanPage] = useState(false);
  const [menuConfig, setMenuConfig] = useState<MenuConfig[]>([]);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isAccessDenied, setIsAccessDenied] = useState(false);

  const getBadgeCount = (badgeKey?: string) => {
    if (!badgeKey) return 0;
    if (badgeKey === 'newReports') return badgeCounts.newReports + badgeCounts.myReports;
    return badgeCounts[badgeKey as keyof typeof badgeCounts] || 0;
  }
  
  const navItems = navItemsList
    .map(item => {
      const config = menuConfig.find(c => c.id === item.id);
      return { ...item, ...config, badge: getBadgeCount(item.badgeKey) };
    });

  const visibleNavItems = navItems.filter(item => item.visible);

  useEffect(() => {
    setIsClient(true);
    const storedStaffInfo = JSON.parse(localStorage.getItem('staffInfo') || '{}');
    
    if (localStorage.getItem('userRole') !== 'petugas' || !storedStaffInfo.id) {
      router.replace('/auth/staff-login');
      return;
    }

    const staffDocRef = doc(db, "staff", storedStaffInfo.id);
    const unsubStaff = onSnapshot(staffDocRef, (docSnap) => {
        if (docSnap.exists()) {
            const staffData = { id: docSnap.id, ...docSnap.data() } as Staff;
            setStaffInfo(staffData);
            localStorage.setItem('staffInfo', JSON.stringify(staffData));
        } else {
            toast({ variant: "destructive", title: "Akses Ditolak", description: "Data petugas tidak ditemukan." });
            handleLogout(true);
        }
    });

    const menuConfigRef = doc(db, 'app_settings', 'petugas_menu');
    const unsubMenu = onSnapshot(menuConfigRef, (docSnap) => {
      if (docSnap.exists()) {
        const fullConfig = navItemsList.map(initial => {
          const saved = docSnap.data().config?.find((c: MenuConfig) => c.id === initial.id);
          return { ...initial, ...saved };
        });
        setMenuConfig(fullConfig);
      } else {
        setMenuConfig(navItemsList.map(item => ({...item, visible: true, locked: false})));
      }
      setLoadingConfig(false);
    });

    const reportsRef = collection(db, 'reports');
    const newReportsQuery = query(reportsRef, where('status', '==', 'new'));
    const myReportsQuery = query(reportsRef, where('handlerId', '==', storedStaffInfo.id), where('status', '==', 'in_progress'));
    const scheduleQuery = query(collection(db, 'schedules'), where('officerId', '==', storedStaffInfo.id), where('status', '==', 'Pending'));
    const honorQuery = query(collection(db, 'honorariums'), where('staffId', '==', storedStaffInfo.id), where('status', '==', 'Tertunda'));

    const unsubNewReports = onSnapshot(newReportsQuery, (snap) => setBadgeCounts(prev => ({...prev, newReports: snap.size})));
    const unsubMyReports = onSnapshot(myReportsQuery, (snap) => setBadgeCounts(prev => ({...prev, myReports: snap.size})));
    const unsubSchedules = onSnapshot(scheduleQuery, (snap) => setBadgeCounts(prev => ({...prev, pendingSchedules: snap.size})));
    const unsubHonors = onSnapshot(honorQuery, (snap) => setBadgeCounts(prev => ({...prev, newHonors: snap.size})));
    
    return () => {
      unsubStaff(); unsubNewReports(); unsubMyReports(); unsubSchedules(); unsubHonors(); unsubMenu();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);
  
  useEffect(() => {
    if (loadingConfig) return;

    const currentTopLevelPath = `/petugas/${pathname.split('/')[2] || ''}`;
    const currentNavItem = navItemsList.find(item => item.href === currentTopLevelPath);
    
    if (currentNavItem) {
        const config = menuConfig.find(c => c.id === currentNavItem.id);
        if (config && (config.locked || !config.visible)) {
            setIsAccessDenied(true);
        } else {
            setIsAccessDenied(false);
        }
    } else {
        setIsAccessDenied(false);
    }
    
    setIsScanPage(pathname === '/petugas/scan');
    
    const duesDetailRegex = /^\/petugas\/dues\/(.+)$/;
    const duesDetailMatch = pathname.match(duesDetailRegex);
    const isDuesRecord = pathname === '/petugas/dues/record';

    const isDetail = !!duesDetailMatch || isDuesRecord;
    setIsDetailPage(isDetail);

    let newPageTitle = "Dasbor Petugas";
    if (duesDetailMatch) {
        newPageTitle = "Riwayat Iuran";
    } else if (isDuesRecord) {
        newPageTitle = "Catat Iuran Warga";
    } else {
        const activeItem = navItemsList.find(item => pathname.startsWith(item.href) && item.href !== '/petugas');
        if (activeItem) newPageTitle = activeItem.label;
    }
    setPageTitle(newPageTitle);
  }, [pathname, menuConfig, loadingConfig]);

  const handleLogout = (silent = false) => {
    if (!silent) setIsLoggingOut(true);
    localStorage.removeItem('userRole');
    localStorage.removeItem('staffInfo');
    setTimeout(() => { router.push('/'); }, silent ? 0 : 1500);
  };
  
  if (!isClient || isLoggingOut || loadingConfig || !staffInfo) {
      return <LoadingSkeleton />;
  }

  if (isAccessDenied) {
    return (
      <html lang="id">
        <body>
          <Suspense fallback={<LoadingSkeleton />}>
            <NotPermittedPage />
          </Suspense>
        </body>
      </html>
    );
  }
  
  const NavHeader = () => (
    <div className="flex items-center gap-4 p-4 text-left">
        <Avatar className="h-14 w-14">
            <AvatarImage src={staffInfo?.photoURL || undefined} />
            <AvatarFallback className="text-xl bg-primary text-primary-foreground">{staffInfo?.name?.charAt(0).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="flex flex-col min-w-0">
            <p className="font-bold text-base truncate">{truncateName(staffInfo.name)}</p>
            <p className="text-sm text-muted-foreground truncate">{staffInfo.email}</p>
            <Badge variant="secondary" className="mt-2 w-fit">Petugas</Badge>
        </div>
    </div>
  );


  const NavContent = ({ onLinkClick }: { onLinkClick?: () => void }) => (
    <div className="flex flex-col h-full">
      <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
        {visibleNavItems.map((item) => {
           const linkContent = (
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-3">
                <item.icon className="h-4 w-4" />
                {item.label}
              </div>
              <div className="flex items-center gap-2">
                {item.locked && <Lock className="h-3 w-3 text-muted-foreground" />}
                {item.badge > 0 && <Badge className="h-5">{item.badge}</Badge>}
              </div>
            </div>
          );
          
          if (item.locked) {
            return (
              <button key={item.id} disabled className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all opacity-50 cursor-not-allowed">
                {linkContent}
              </button>
            )
          }

          return (
            <Link
              key={item.id}
              href={item.href}
              onClick={onLinkClick}
              className={cn(
                "flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary",
                 (pathname === item.href || (pathname.startsWith(item.href) && item.href !== '/petugas')) && "bg-muted text-primary"
              )}
            >
              {linkContent}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto p-4">
         <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground hover:text-primary" onClick={() => handleLogout()} disabled={isLoggingOut}>
            <LogOut className="mr-2 h-4 w-4" />
            {isLoggingOut ? 'Keluar...' : 'Keluar'}
          </Button>
      </div>
    </div>
  );
  
  if (isScanPage) {
    return (
        <main className="flex flex-1 flex-col bg-gray-100/40 dark:bg-muted/40 overflow-auto animate-fade-in">
          {children}
        </main>
    )
  }

  return (
    <div className="grid min-h-screen w-full md:grid-cols-[280px_1fr]">
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
              <Button variant="outline" size="icon" className="shrink-0 md:hidden">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle navigation menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="flex flex-col p-0 w-[280px]">
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
                priority
              />
          </div>
        </header>
        <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6 bg-gray-100/40 dark:bg-muted/40 overflow-auto">
           <div className="mx-auto w-full max-w-screen-2xl">
            {children}
          </div>
        </main>
      </div>
       <Dialog open={false}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle className="sr-only">Akun Ditangguhkan</DialogTitle>
                <DialogDescription className="sr-only">Dialog</DialogDescription>
            </DialogHeader>
        </DialogContent>
      </Dialog>
    </div>
  );
}
