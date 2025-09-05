
"use client";

import ReportActivity from '@/components/dashboard/report-activity';
import ReportHistory from "@/components/profile/report-history";
import Schedule from '@/components/dashboard/schedule';
import EmergencyContacts from "@/components/dashboard/emergency-contacts";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged, type User } from "firebase/auth";
import { app, db } from "@/lib/firebase/client";
import { collection, onSnapshot, query, where, doc, orderBy, Timestamp, getDocs, limit } from 'firebase/firestore';
import { Skeleton } from "@/components/ui/skeleton";
import type { AppUser, PatrolLog } from "@/lib/types";
import { formatDistanceToNow } from 'date-fns';
import { id } from 'date-fns/locale';
import { cn } from "@/lib/utils";
import { Home, Shield, ScrollText, UserCircle, Bell, MessageSquare, Settings, Megaphone } from 'lucide-react';
import { usePathname } from "next/navigation";
import { UserNav } from './user-nav';

const navItems = [
    { href: "/", icon: Home, label: "Beranda" },
    { href: "/profile", icon: UserCircle, label: "Profil" },
    { href: "/profile#laporan", icon: ScrollText, label: "Laporan" },
    { href: "/settings", icon: Settings, label: "Pengaturan" },
]

export default function MainDashboardView() {
  const [user, setUser] = useState<User | null>(null);
  const [userInfo, setUserInfo] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [greeting, setGreeting] = useState("Selamat Datang");
  
  const pathname = usePathname();
  const auth = getAuth(app);
  
  useEffect(() => {
    const getGreeting = () => {
      const hour = new Date().getHours();
      if (hour >= 5 && hour < 12) return "Selamat Pagi";
      if (hour >= 12 && hour < 15) return "Selamat Siang";
      if (hour >= 15 && hour < 19) return "Selamat Sore";
      return "Selamat Malam";
    };

    setGreeting(getGreeting());

    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const userDocRef = doc(db, 'users', currentUser.uid);
        const unsubscribeUser = onSnapshot(userDocRef, (userDocSnap) => {
          if (userDocSnap.exists()) {
            setUserInfo({ uid: currentUser.uid, ...userDocSnap.data() } as AppUser);
          } else {
            setUserInfo(null);
          }
          setLoading(false);
        });
        return () => unsubscribeUser();
      } else {
        setUserInfo(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
    };
  }, [auth]);

  if (loading) {
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
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-muted/40">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/95 px-4 backdrop-blur-sm sm:px-6">
            <h1 className="text-xl font-bold text-primary">Baronda</h1>
             <div className="flex items-center gap-1">
                <Link href="/announcements" className="flex items-center gap-2 text-sm font-medium text-primary">
                    <Button variant="ghost" size="icon"><Megaphone className="h-5 w-5" /></Button>
                </Link>
                <UserNav user={user} userInfo={userInfo} />
             </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 pb-20 animate-fade-in-up">
            <div className="mx-auto w-full max-w-screen-2xl space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        {loading ? (
                             <Skeleton className="h-8 w-64 mb-2" />
                        ) : (
                            <h2 className="text-xl sm:text-2xl font-bold tracking-tight break-word">
                                {greeting}, {user?.displayName || 'Warga'}!
                            </h2>
                        )}
                    </div>
                </div>

                <div className="space-y-6">
                    <Schedule />
                    <ReportActivity user={user} userInfo={userInfo} />
                    <ReportHistory />
                    <EmergencyContacts />
                </div>
            </div>
        </main>

        <nav className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background/95 backdrop-blur-sm">
            <div className="grid h-16 grid-cols-4 items-center justify-center gap-2 px-2">
                {navItems.map(item => (
                    <Link key={item.href} href={item.href} passHref>
                        <Button variant="ghost" className={cn(
                            "flex h-full w-full flex-col items-center justify-center gap-1 rounded-lg p-1 text-xs",
                            pathname === item.href ? "text-primary bg-primary/10" : "text-muted-foreground"
                            )}>
                            <item.icon className="h-5 w-5" />
                            <span>{item.label}</span>
                        </Button>
                    </Link>
                ))}
            </div>
        </nav>
    </div>
  );
}
