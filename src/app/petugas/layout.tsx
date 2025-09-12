
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
import { cn, useInactivityTimeout } from "@/lib/utils";
import { collection, onSnapshot, query, where, getDoc, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { Badge } from "@/components/ui/badge";
import Image from "next/image";
import type { Staff } from "@/lib/types";
import { getAuth } from "firebase/auth";


const navItemsList = [
    { id: 'dashboard', href: "/petugas", icon: Home, label: "Dasbor" },
    { id: 'reports', href: "/petugas/reports", icon: ShieldAlert, label: "Laporan", badgeKey: 'newReports' },
    { id: 'schedule', href: "/petugas/schedule", icon: Calendar, label: "Jadwal", badgeKey: 'pendingSchedules' },
    { id: 'tools', href: "/petugas/tools", icon: Wrench, label: "Lainnya", badgeKey: 'unreadNotifications' },
    { id: 'profile', href: "/petugas/profile", icon: UserIcon, label: "Profil" },
];

const pageTitles: { [key: string]: string } = {
  "/petugas/patrol-log": "Log Patroli",
  "/petugas/honor": "Riwayat Honor",
  "/petugas/announcements": "Pengumuman",
  "/petugas/notifications": "Notifikasi",
  "/petugas/emergency-contacts": "Kontak Darurat",
};

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
  const auth = getAuth();
  const [isClient, setIsClient] = useState(false);
  const [staffInfo, setStaffInfo] = useState<Staff | null>(null);
  const [badgeCounts, setBadgeCounts] = useState({ newReports: 0, myReports: 0, pendingSchedules: 0, unreadNotifications: 0 });
  const [isScanPage, setIsScanPage] = useState(false);

  useInactivityTimeout();

  const getBadgeCount = (badgeKey?: string) => {
    if (!badgeKey) return 0;
    if (badgeKey === 'newReports') return badgeCounts.newReports + badgeCounts.myReports;
    return badgeCounts[badgeKey as keyof typeof badgeCounts] || 0;
  }
  
  const navItems = useMemo(() => navItemsList
    .map(item => ({ ...item, badge: getBadgeCount(item.badgeKey) })), [badgeCounts]);


  useEffect(() => {
    setIsClient(true);
    const storedStaffInfo = JSON.parse(localStorage.getItem('staffInfo') || '{}');
    const OneSignal = (window as any).OneSignal;
    
    if (localStorage.getItem('userRole') !== 'petugas') {
      router.replace('/auth/staff-login');
      return;
    }

    if (storedStaffInfo.id) {
        const staffDocRef = doc(db, "staff", storedStaffInfo.id);
        const unsubStaff = onSnapshot(staffDocRef, async (docSnap) => {
            if (docSnap.exists()) {
                const staffData = { id: docSnap.id, ...docSnap.data() } as Staff;
                if (staffData.role !== 'petugas') {
                    if(OneSignal) OneSignal.logout();
                    router.replace('/auth/staff-login');
                    return;
                }
                setStaffInfo(staffData);
                 try {
                  if(OneSignal) await OneSignal.login(staffData.id);
                } catch (e) {
                  console.error("OneSignal login error:", e);
                }
            } else {
                if(OneSignal) OneSignal.logout();
                router.replace('/auth/staff-login');
            }
        });

        const reportsRef = collection(db, 'reports');
        const newReportsQuery = query(reportsRef, where('status', '==', 'new'));
        const myReportsQuery = query(reportsRef, where('handlerId', '==', storedStaffInfo.id), where('status', '==', 'in_progress'));
        const scheduleQuery = query(collection(db, 'schedules'), where('officerId', '==', storedStaffInfo.id), where('status', '==', 'Pending'));
        const notifsQuery = query(collection(db, 'notifications'), where('userId', '==', storedStaffInfo.id), where('read', '==', false));


        const unsubNewReports = onSnapshot(newReportsQuery, (snap) => setBadgeCounts(prev => ({...prev, newReports: snap.size})));
        const unsubMyReports = onSnapshot(myReportsQuery, (snap) => setBadgeCounts(prev => ({...prev, myReports: snap.size})));
        const unsubSchedules = onSnapshot(scheduleQuery, (snap) => setBadgeCounts(prev => ({...prev, pendingSchedules: snap.size})));
        const unsubNotifs = onSnapshot(notifsQuery, (snap) => setBadgeCounts(prev => ({...prev, unreadNotifications: snap.size})));
        
        return () => {
          unsubStaff(); unsubNewReports(); unsubMyReports(); unsubSchedules(); unsubNotifs();
        }
    } else {
      router.replace('/auth/staff-login');
    }
  }, [router, auth]);
  
  useEffect(() => {
    setIsScanPage(pathname === '/petugas/scan');
  }, [pathname]);

  const isMainPage = useMemo(() => navItems.some(item => item.href === pathname), [pathname, navItems]);
  const pageTitle = pageTitles[pathname] || '';

  
  if (!isClient || !staffInfo) {
      return <LoadingSkeleton />;
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
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/95 px-4 backdrop-blur-sm sm:px-6">
        {isMainPage ? (
            <div className="flex items-center gap-2 text-left">
                <Image 
                src="https://iili.io/KJ4aGxp.png" 
                alt="Logo" 
                width={32} 
                height={32}
                className="h-8 w-8 rounded-full object-cover"
                />
                <div className="flex flex-col">
                    <span className="text-base font-bold text-primary leading-tight">Baronda</span>
                    <p className="text-xs text-muted-foreground leading-tight">Kelurahan Kilongan</p>
                </div>
            </div>
        ) : (
             <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={() => router.back()} className="h-8 w-8">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <h1 className="text-lg font-semibold truncate">{pageTitle}</h1>
            </div>
        )}
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
