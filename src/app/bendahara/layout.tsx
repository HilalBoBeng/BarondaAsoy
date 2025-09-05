
"use client";

import Link from "next/link";
import {
  Bell,
  Home,
  LogOut,
  Menu,
  Landmark,
  ArrowLeft,
  Banknote,
  User as UserIcon,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePathname, useRouter } from "next/navigation";
import { cn, truncateName } from "@/lib/utils";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetHeader } from "@/components/ui/sheet";
import Image from "next/image";
import { collection, onSnapshot, query, where, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { Staff } from "@/lib/types";

const navItemsList = [
    { href: "/bendahara", icon: Home, label: 'Dasbor', id: 'dashboard' },
    { href: "/bendahara/profile", icon: UserIcon, label: 'Profil Saya', id: 'profile' },
    { href: "/bendahara/dues", icon: Landmark, label: 'Iuran Warga', id: 'dues' },
    { href: "/bendahara/honor", icon: Banknote, label: 'Honorarium', id: 'honor' },
    { href: "/bendahara/honor-saya", icon: Wallet, label: 'Honor Saya', id: 'honor-saya' },
    { href: "/bendahara/finance", icon: Wallet, label: 'Keuangan', id: 'finance' },
    { href: "/bendahara/notifications", icon: Bell, label: 'Notifikasi', id: 'notifications' },
];


export default function BendaharaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();
  const [isClient, setIsClient] = useState(false);
  const [staffInfo, setStaffInfo] = useState<Staff | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [pageTitle, setPageTitle] = useState("Dasbor Bendahara");
  const [isDetailPage, setIsDetailPage] = useState(false);
  
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
                    handleLogout(true);
                    return;
                }
                setStaffInfo(staffData);
                localStorage.setItem('staffInfo', JSON.stringify(staffData));
            } else {
                toast({ variant: "destructive", title: "Akses Ditolak", description: "Data bendahara tidak ditemukan." });
                handleLogout(true);
            }
        });
        return () => unsubStaff();
    } else {
        router.replace('/auth/staff-login');
        return;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);
  
  useEffect(() => {
    const detailPage = pathname.split('/').filter(Boolean).length > 2;
    setIsDetailPage(detailPage);
    
    const activeItem = navItemsList.find(item => pathname.startsWith(item.href) && item.href !== '/bendahara');
    setPageTitle(activeItem?.label || "Dasbor Bendahara");
    
  }, [pathname]);

  const handleLogout = (silent = false) => {
    if (!silent) setIsLoggingOut(true);
    localStorage.removeItem('userRole');
    localStorage.removeItem('staffInfo');

    setTimeout(() => {
        router.push('/');
    }, silent ? 0 : 1500); 
  };
  
  if (!isClient || isLoggingOut || !staffInfo) {
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

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur-sm sm:px-6">
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
      </header>
      <main className="flex-1 overflow-y-auto bg-gray-100/40 dark:bg-muted/40 p-4 pb-20 animate-fade-in">
        <div className="mx-auto w-full max-w-screen-2xl">
          {children}
        </div>
      </main>
      <nav className="fixed bottom-0 left-0 right-0 z-40 grid grid-cols-5 items-center justify-center gap-1 border-t bg-background/95 p-1 backdrop-blur-sm">
          {navItemsList.slice(0, 5).map(item => (
              <Link key={item.href} href={item.href} passHref>
                   <Button variant="ghost" className={cn(
                      "flex h-full w-full flex-col items-center justify-center gap-1 rounded-lg p-1 text-xs",
                      pathname.startsWith(item.href) && item.href !== '/bendahara' ? "text-primary bg-primary/10" : pathname === '/bendahara' && item.href === '/bendahara' ? "text-primary bg-primary/10" : "text-muted-foreground"
                   )}>
                      <item.icon className="h-5 w-5" />
                      <span className="truncate">{item.label}</span>
                  </Button>
              </Link>
          ))}
      </nav>
    </div>
  );
}
