
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
  MessageSquare,
  Settings,
  Landmark,
  QrCode,
  Banknote,
  ClipboardList,
  User as UserIcon,
  Wrench,
  History,
  Edit,
  Wallet,
  Mail,
  ArrowLeft
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import Image from "next/image";
import { collection, onSnapshot, query, where, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { Badge } from "@/components/ui/badge";
import type { Staff } from "@/lib/types";

const navItemsList = [
    { href: "/admin", icon: Home, label: 'Dasbor', id: 'dashboard', roles: ['admin', 'bendahara'] },
    { href: "/admin/users", icon: Users, label: 'Pengguna', id: 'users', roles: ['admin'] },
    { href: "/admin/schedule", icon: Calendar, label: 'Jadwal', id: 'schedule', roles: ['admin'], badgeKey: 'newReports' },
    { href: "/admin/tools", icon: Wrench, label: 'Alat', id: 'tools', roles: ['admin', 'bendahara'] },
    { href: "/admin/profile", icon: UserIcon, label: 'Profil Saya', id: 'profile', roles: ['admin', 'bendahara'] },
];

// Items that will appear on the tools page
const toolPageItems = [
    { href: "/admin/reports", icon: ShieldAlert, label: 'Laporan', id: 'reports', badgeKey: 'newReports', roles: ['admin'] },
    { href: "/admin/announcements", icon: FileText, label: 'Pengumuman', id: 'announcements', roles: ['admin'] },
    { href: "/admin/attendance", icon: ClipboardList, label: 'Kehadiran', id: 'attendance', roles: ['admin'] },
    { href: "/admin/dues", icon: Landmark, label: 'Iuran', id: 'dues', roles: ['admin', 'bendahara'] },
    { href: "/admin/honor", icon: Banknote, label: 'Honorarium', id: 'honor', roles: ['admin', 'bendahara'] },
    { href: "/admin/honor-saya", icon: Wallet, label: 'Honor Saya', id: 'honor-saya', roles: ['admin', 'bendahara'] },
    { href: "/admin/finance", icon: Wallet, label: 'Keuangan', id: 'finance', roles: ['admin', 'bendahara'] },
    { href: "/admin/activity-log", icon: History, label: 'Log Admin', id: 'activityLog', roles: ['admin'] },
    { href: "/admin/emergency-contacts", icon: Phone, label: 'Kontak Darurat', id: 'emergencyContacts', roles: ['admin'] },
    { href: "/admin/notifications", icon: Bell, label: 'Notifikasi', id: 'notifications', roles: ['admin'] },
]


export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [adminInfo, setAdminInfo] = useState<Staff | null>(null);
  const [badgeCounts, setBadgeCounts] = useState({ newReports: 0 });
  const [pageTitle, setPageTitle] = useState("Dasbor");
  const [isDetailPage, setIsDetailPage] = useState(false);

  const getBadgeCount = (badgeKey?: string) => {
    if (!badgeKey) return 0;
    return badgeCounts[badgeKey as keyof typeof badgeCounts] || 0;
  };
    
  const navItems = navItemsList
    .filter(item => adminInfo?.role && item.roles.includes(adminInfo.role))
    .map(item => ({
      ...item,
      badge: getBadgeCount(item.badgeKey)
    }));

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
        
        return () => {
          unsubStaff();
          unsubReports();
        }
    } else {
        router.replace('/auth/staff-login');
    }
  }, [router]);
  
  useEffect(() => {
    const segments = pathname.split('/').filter(Boolean);
    const detailPage = segments.length > 2;
    setIsDetailPage(detailPage);
    
    let newPageTitle = "Dasbor Admin";
    const allNavItems = [...navItems, ...toolPageItems];
    const activeItem = allNavItems.find(item => pathname.startsWith(item.href) && item.href !== '/admin');

    if (activeItem) {
        newPageTitle = activeItem.label;
    } else if (pathname === '/admin') {
        newPageTitle = "Dasbor Admin";
    }

    setPageTitle(newPageTitle);
  }, [pathname, navItems]);


  return (
    <div className="flex h-screen flex-col bg-muted/40">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/95 px-4 backdrop-blur-sm sm:px-6">
             <div className="flex items-center gap-2">
                {isDetailPage ? (
                     <Button variant="ghost" size="sm" className="gap-1 pl-0.5" onClick={() => router.back()}>
                        <ArrowLeft className="h-4 w-4" />
                        <h1 className="text-lg font-semibold md:text-2xl truncate">{pageTitle}</h1>
                     </Button>
                 ) : (
                    <h1 className="text-lg font-semibold md:text-2xl truncate">{pageTitle}</h1>
                 )}
            </div>
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
        <nav className="fixed bottom-0 left-0 right-0 z-10 grid grid-cols-5 border-t bg-background/95 backdrop-blur-sm">
            {navItems.map(item => (
                <Link key={item.href} href={item.href} passHref>
                    <Button variant="ghost" className={cn(
                        "flex h-full w-full flex-col items-center justify-center gap-1 rounded-none p-2 text-xs",
                        pathname.startsWith(item.href) && item.href !== '/admin' ? "text-primary bg-primary/10" : pathname === '/admin' && item.href === '/admin' ? "text-primary bg-primary/10" : "text-muted-foreground",
                        pathname.startsWith('/admin/reports') && item.href === '/admin/schedule' && 'text-primary bg-primary/10' // Highlight 'Jadwal' for 'Laporan'
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
        </nav>
    </div>
  );
}
