
"use client";

import Link from "next/link";
import {
  Home,
  Users,
  Calendar,
  User as UserIcon,
  Wrench,
  ArrowLeft,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import Image from "next/image";
import { collection, onSnapshot, query, where, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { Badge } from "@/components/ui/badge";
import type { Staff } from "@/lib/types";
import { cn } from "@/lib/utils";


const navItemsList = [
    { href: "/admin", icon: Home, label: 'Dasbor', id: 'dashboard', roles: ['admin', 'bendahara'] },
    { href: "/admin/reports", icon: ShieldAlert, label: 'Laporan', id: 'reports', roles: ['admin'], badgeKey: 'newReports' },
    { href: "/admin/schedule", icon: Calendar, label: 'Jadwal', id: 'schedule', roles: ['admin'], badgeKey: 'newReports' },
    { href: "/admin/tools", icon: Wrench, label: 'Alat', id: 'tools', roles: ['admin', 'bendahara'] },
    { href: "/admin/profile", icon: UserIcon, label: 'Profil Saya', id: 'profile', roles: ['admin', 'bendahara'], badgeKey: 'unreadNotifications' },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [adminInfo, setAdminInfo] = useState<Staff | null>(null);
  const [badgeCounts, setBadgeCounts] = useState({ newReports: 0, unreadNotifications: 0 });

  const getBadgeCount = (badgeKey?: string) => {
    if (!badgeKey) return 0;
    return badgeCounts[badgeKey as keyof typeof badgeCounts] || 0;
  };
    
  const navItems = useMemo(() => navItemsList
    .filter(item => adminInfo?.role && item.roles.includes(adminInfo.role))
    .map(item => ({
      ...item,
      badge: getBadgeCount(item.badgeKey)
    })), [adminInfo, badgeCounts]);


  useEffect(() => {
    const storedStaffInfo = JSON.parse(localStorage.getItem('staffInfo') || '{}');
    
    const validRoles = ['admin', 'bendahara'];
    if (!validRoles.includes(localStorage.getItem('userRole') || '')) {
      router.replace('/auth/staff-login');
      return;
    }
    
    if (storedStaffInfo.id) {
        const staffDocRef = doc(db, "staff", storedStaffInfo.id);
        const unsubStaff = onSnapshot(staffDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const staffData = { id: docSnap.id, ...docSnap.data() } as Staff;
                if (!validRoles.includes(staffData.role || '')) {
                    router.replace('/auth/staff-login');
                    return;
                }
                setAdminInfo(staffData);
            } else {
                router.replace('/auth/staff-login');
            }
        });

        const reportsQuery = query(collection(db, 'reports'), where('status', '==', 'new'));
        const unsubReports = onSnapshot(reportsQuery, (snap) => setBadgeCounts(prev => ({...prev, newReports: snap.size})));
        
        const notifsQuery = query(collection(db, 'notifications'), where('userId', '==', storedStaffInfo.id), where('read', '==', false));
        const unsubNotifs = onSnapshot(notifsQuery, (snap) => setBadgeCounts(prev => ({...prev, unreadNotifications: snap.size})));

        return () => {
          unsubStaff();
          unsubReports();
          unsubNotifs();
        }
    } else {
        router.replace('/auth/staff-login');
    }
  }, [router]);
  
  return (
    <div className="flex h-screen flex-col bg-muted/40">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/95 px-4 backdrop-blur-sm sm:px-6">
             <Link href="/admin" className="flex items-center gap-2">
                 <Image 
                    src="https://iili.io/KJ4aGxp.png" 
                    alt="Logo" 
                    width={32} 
                    height={32}
                    className="h-8 w-8 rounded-full object-cover"
                />
            </Link>
        </header>
        <main className="flex-1 overflow-y-auto p-4 pb-20 animate-fade-in-up">
            {children}
        </main>
         <nav className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background/95 backdrop-blur-sm">
            <div className="grid h-16 grid-cols-5 items-center justify-center gap-2 px-2">
                {navItems.map(item => (
                    <Link key={item.href} href={item.href} passHref>
                        <Button variant="ghost" className={cn(
                            "flex h-full w-full flex-col items-center justify-center gap-1 rounded-lg p-1 text-xs",
                            (pathname.startsWith(item.href) && item.href !== '/admin') || (pathname === '/admin' && item.href === '/admin') 
                            ? "text-primary bg-primary/10" 
                            : "text-muted-foreground",
                             (pathname.startsWith('/admin/reports') && item.id === 'reports') && 'text-primary bg-primary/10' 
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
