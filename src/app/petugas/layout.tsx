
"use client";

import Link from "next/link";
import {
  Home,
  ShieldAlert,
  Calendar,
  User as UserIcon,
  Wrench,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, Suspense, useMemo } from "react";
import { cn } from "@/lib/utils";
import { collection, onSnapshot, query, where, getDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { Badge } from "@/components/ui/badge";
import Image from "next/image";
import NotPermittedPage from "@/app/not-permitted/page";
import type { Staff } from "@/lib/types";

interface MenuConfig {
  id: string;
  label: string;
  visible: boolean;
  locked: boolean;
}

const navItemsList = [
    { id: 'dashboard', href: "/petugas", icon: Home, label: "Dasbor" },
    { id: 'reports', href: "/petugas/reports", icon: ShieldAlert, label: "Laporan", badgeKey: 'newReports' },
    { id: 'schedule', href: "/petugas/schedule", icon: Calendar, label: "Jadwal", badgeKey: 'pendingSchedules' },
    { id: 'tools', href: "/petugas/tools", icon: Wrench, label: "Lainnya" },
    { id: 'profile', href: "/petugas/profile", icon: UserIcon, label: "Profil" },
];


function HeaderContent() {
    const pathname = usePathname();
    const router = useRouter();

    const [pageTitle, setPageTitle] = useState("Dasbor Petugas");
    const [isDetailPage, setIsDetailPage] = useState(false);

    useEffect(() => {
        const detailPage = pathname.split('/').filter(Boolean).length > 2;
        setIsDetailPage(detailPage);
        
        let newPageTitle = "Dasbor Petugas";
        const allNavItems = [...navItemsList, { href: "/petugas/patrol-log", label: "Patroli & Log" }, { href: "/petugas/honor", label: "Honor Saya" }, { href: "/petugas/announcements", label: "Pengumuman" }, { href: "/petugas/notifications", label: "Notifikasi" }, { href: "/petugas/emergency-contacts", label: "Kontak Darurat" }];
        const activeItem = allNavItems.find(item => pathname.startsWith(item.href) && item.href !== '/petugas');
        if (activeItem) newPageTitle = activeItem.label;
        
        setPageTitle(newPageTitle);
    }, [pathname]);

    return (
        <div className="flex w-full items-center justify-between">
            <div className="flex-1">
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
                 <Link href="/petugas" className="flex items-center gap-2">
                     <Image
                      src="https://iili.io/KJ4aGxp.png"
                      alt="Logo"
                      width={32}
                      height={32}
                      className="h-8 w-8 rounded-full object-cover"
                      priority
                    />
                </Link>
            </div>
        </div>
    );
}

function LoadingSkeleton() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background">
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
  const [isClient, setIsClient] = useState(false);
  const [staffInfo, setStaffInfo] = useState<Staff | null>(null);
  const [badgeCounts, setBadgeCounts] = useState({ newReports: 0, myReports: 0, pendingSchedules: 0, newHonors: 0 });
  const [menuConfig, setMenuConfig] = useState<MenuConfig[]>([]);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [isAccessDenied, setIsAccessDenied] = useState(false);
  const [isScanPage, setIsScanPage] = useState(false);

  const getBadgeCount = (badgeKey?: string) => {
    if (!badgeKey) return 0;
    if (badgeKey === 'newReports') return badgeCounts.newReports + badgeCounts.myReports;
    return badgeCounts[badgeKey as keyof typeof badgeCounts] || 0;
  }
  
  const navItems = useMemo(() => navItemsList
    .map(item => {
      const config = menuConfig.find(c => c.id === item.id);
      return { ...item, ...config, badge: getBadgeCount(item.badgeKey) };
    })
    .filter(item => item.visible), [menuConfig, badgeCounts]);


  useEffect(() => {
    setIsClient(true);
    const storedStaffInfo = JSON.parse(localStorage.getItem('staffInfo') || '{}');
    
    if (localStorage.getItem('userRole') !== 'petugas') {
      router.replace('/auth/staff-login');
      return;
    }

    if (storedStaffInfo.id) {
        const staffDocRef = doc(db, "staff", storedStaffInfo.id);
        const unsubStaff = onSnapshot(staffDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const staffData = { id: docSnap.id, ...docSnap.data() } as Staff;
                setStaffInfo(staffData);
                localStorage.setItem('staffInfo', JSON.stringify(staffData));
            } else {
                localStorage.removeItem('userRole');
                localStorage.removeItem('staffInfo');
                router.replace('/auth/staff-login');
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
    } else {
      router.replace('/auth/staff-login');
    }
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
  }, [pathname, menuConfig, loadingConfig]);
  
  if (!isClient || loadingConfig || !staffInfo) {
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
  
  if (isScanPage) {
    return (
        <main className="flex flex-1 flex-col bg-gray-100/40 dark:bg-muted/40 overflow-auto animate-fade-in-up">
          {children}
        </main>
    )
  }

  return (
    <div className="flex h-screen flex-col bg-muted/40">
      <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur-sm sm:px-6">
        <HeaderContent />
      </header>
      <main className="flex-1 overflow-y-auto p-4 lg:p-6 pb-20 animate-fade-in-up">
         <div className="mx-auto w-full max-w-screen-2xl">
          {children}
        </div>
      </main>
        <nav className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background/95 backdrop-blur-sm">
            <div className="grid h-16 grid-cols-5 items-center justify-center gap-2 px-2">
                {navItems.slice(0, 5).map(item => (
                    <Link key={item.id} href={item.href} passHref>
                        <Button variant="ghost" className={cn(
                            "flex h-full w-full flex-col items-center justify-center gap-1 rounded-lg p-1 text-xs",
                            (pathname.startsWith(item.href) && item.href !== '/petugas') || (pathname === '/petugas' && item.href === '/petugas')
                            ? "text-primary bg-primary/10" 
                            : "text-muted-foreground"
                            )}>
                            <div className="relative">
                                <item.icon className="h-5 w-5" />
                                {item.badge > 0 && (
                                    <Badge className="absolute -top-2 -right-2 h-4 w-4 justify-center rounded-full p-0 text-xs">{item.badge}</Badge>
                                )}
                            </div>
                            <span className="truncate">{item.label}</span>
                        </Button>
                    </Link>
                ))}
            </div>
        </nav>
    </div>
  );
}
