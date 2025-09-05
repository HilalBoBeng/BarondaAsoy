
"use client";

import Link from "next/link";
import {
  Home,
  Landmark,
  ArrowLeft,
  User as UserIcon,
  Wallet,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useEffect, useState, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import Image from "next/image";
import { onSnapshot, doc, query, collection, where } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { Staff } from "@/lib/types";
import { Badge } from "@/components/ui/badge";

const navItemsList = [
    { href: "/bendahara", icon: Home, label: 'Dasbor', id: 'dashboard' },
    { href: "/bendahara/dues", icon: Landmark, label: 'Iuran', id: 'dues' },
    { href: "/bendahara/finance", icon: Wallet, label: 'Keuangan', id: 'finance' },
    { href: "/bendahara/tools", icon: Wrench, label: 'Lainnya', id: 'tools' },
    { href: "/bendahara/profile", icon: UserIcon, label: 'Profil Saya', id: 'profile', badgeKey: 'unreadNotifications' },
];

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
  );
}

export default function BendaharaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);
  const [staffInfo, setStaffInfo] = useState<Staff | null>(null);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  useEffect(() => {
    setIsClient(true);
    const storedStaffInfo = JSON.parse(localStorage.getItem('staffInfo') || '{}');
    
    if (localStorage.getItem('userRole') !== 'bendahara') {
      router.replace('/auth/staff-login');
      return;
    }
    
    if (storedStaffInfo.id) {
        const staffDocRef = doc(db, "staff", storedStaffInfo.id);
        const unsubStaff = onSnapshot(staffDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const staffData = { id: docSnap.id, ...docSnap.data() } as Staff;
                if (staffData.role !== 'bendahara') {
                    localStorage.removeItem('userRole');
                    localStorage.removeItem('staffInfo');
                    router.replace('/auth/staff-login');
                    return;
                }
                setStaffInfo(staffData);
                localStorage.setItem('staffInfo', JSON.stringify(staffData));
            } else {
                localStorage.removeItem('userRole');
                localStorage.removeItem('staffInfo');
                router.replace('/auth/staff-login');
            }
        });
        
        const notifsQuery = query(collection(db, 'notifications'), where('userId', '==', storedStaffInfo.id), where('read', '==', false));
        const unsubNotifs = onSnapshot(notifsQuery, (snap) => setUnreadNotifications(snap.size));

        return () => {
            unsubStaff();
            unsubNotifs();
        };
    } else {
        router.replace('/auth/staff-login');
        return;
    }
  }, [router]);
  
  
  if (!isClient || !staffInfo) {
      return <LoadingSkeleton />;
  }
  
  const getBadgeCount = (badgeKey?: string) => {
    if (badgeKey === 'unreadNotifications') return unreadNotifications;
    return 0;
  }
  
  const navItems = navItemsList.map(item => ({
      ...item,
      badge: getBadgeCount(item.badgeKey),
  }));

  return (
    <div className="flex h-screen flex-col bg-muted/40">
      <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur-sm sm:px-6">
        <div className="w-full flex justify-between items-center">
           <div className="flex-1">
                 <Link href="/bendahara" className="flex items-center gap-2">
                    <Image 
                    src="https://iili.io/KJ4aGxp.png"
                    alt="Logo" 
                    width={32} 
                    height={32}
                    className="h-8 w-8 rounded-full object-cover"
                    />
                </Link>
           </div>
        </div>
      </header>
      <main className="flex-1 overflow-y-auto p-4 pb-20 animate-fade-in-up">
        <div className="mx-auto w-full max-w-screen-2xl">
          {children}
        </div>
      </main>
        <nav className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background/95 backdrop-blur-sm">
            <div className="grid h-16 grid-cols-5 items-center justify-center gap-2 px-2">
                {navItems.map(item => (
                    <Link key={item.href} href={item.href} passHref>
                        <Button variant="ghost" className={cn(
                            "flex h-full w-full flex-col items-center justify-center gap-1 rounded-lg p-1 text-xs",
                            (pathname.startsWith(item.href) && item.href !== '/bendahara') || (pathname === '/bendahara' && item.href === '/bendahara')
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
