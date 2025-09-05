
"use client";

import ReportHistory from '@/components/profile/report-history';
import WelcomeAnnouncement from "@/components/dashboard/welcome-announcement";
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
import type { AppUser, PatrolLog, Announcement } from "@/lib/types";
import { format, formatDistanceToNow } from 'date-fns';
import { id } from 'date-fns/locale';
import { cn } from "@/lib/utils";
import { Home, Shield, ScrollText, UserCircle, Bell, MessageSquare, Settings, Megaphone, Calendar } from 'lucide-react';
import { usePathname } from "next/navigation";
import { UserNav } from './user-nav';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '../ui/card';
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from '../ui/drawer';

const navItems = [
    { href: "/", icon: Home, label: "Beranda" },
    { href: "/report", icon: Shield, label: "Laporan" },
    { href: "/profile", icon: UserCircle, label: "Profil" },
    { href: "/settings", icon: Settings, label: "Pengaturan" },
]

export default function MainDashboardView() {
  const [user, setUser] = useState<User | null>(null);
  const [userInfo, setUserInfo] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [greeting, setGreeting] = useState("Selamat Datang");
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(true);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const announcementsPerPage = 7;
  
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
    
    const q = query(collection(db, 'announcements'), orderBy('date', 'desc'));
    const unsubscribeAnnouncements = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => {
        const docData = doc.data();
        return {
          id: doc.id,
          ...docData,
          date: docData.date instanceof Timestamp ? docData.date.toDate() : docData.date,
        } as Announcement;
      });
      setAnnouncements(data);
      setLoadingAnnouncements(false);
    });


    return () => {
      unsubscribeAuth();
      unsubscribeAnnouncements();
    };
  }, [auth]);

  const indexOfLastAnnouncement = currentPage * announcementsPerPage;
  const indexOfFirstAnnouncement = indexOfLastAnnouncement - announcementsPerPage;
  const currentAnnouncements = announcements.slice(indexOfFirstAnnouncement, indexOfLastAnnouncement);
  const totalPages = Math.ceil(announcements.length / announcementsPerPage);

  const handleNextPage = () => {
      if (currentPage < totalPages) {
          setCurrentPage(currentPage + 1);
      }
  }
  const handlePrevPage = () => {
      if (currentPage > 1) {
          setCurrentPage(currentPage - 1);
      }
  }

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
        <WelcomeAnnouncement />
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/95 px-4 backdrop-blur-sm sm:px-6">
            <div className="flex items-center gap-2 text-right">
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
             <div className="flex items-center gap-1">
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
                             <h2 className="text-xl sm:text-2xl font-normal tracking-tight">
                                {greeting}, <span className="font-bold">{user?.displayName || 'Warga'}!</span>
                            </h2>
                        )}
                    </div>
                </div>

                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Pengumuman Terbaru</CardTitle>
                        </CardHeader>
                        <CardContent>
                             {loadingAnnouncements ? (
                                Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-20 w-full mb-2" />)
                            ) : currentAnnouncements.length > 0 ? (
                                currentAnnouncements.map((ann) => (
                                    <div key={ann.id} className="border-b last:border-b-0 py-3 cursor-pointer" onClick={() => setSelectedAnnouncement(ann)}>
                                        <p className="font-semibold text-sm">{ann.title}</p>
                                        <p className="text-xs text-muted-foreground line-clamp-2">{ann.content}</p>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center text-muted-foreground py-4">
                                    Tidak ada pengumuman.
                                </div>
                            )}
                        </CardContent>
                         {announcements.length > announcementsPerPage && (
                            <CardFooter className="flex justify-end space-x-2">
                                <Button variant="outline" size="sm" onClick={handlePrevPage} disabled={currentPage === 1}>
                                    Sebelumnya
                                </Button>
                                <Button variant="outline" size="sm" onClick={handleNextPage} disabled={currentPage === totalPages}>
                                    Berikutnya
                                </Button>
                            </CardFooter>
                        )}
                    </Card>
                    <Schedule />
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
        
        <Drawer open={!!selectedAnnouncement} onOpenChange={(open) => !open && setSelectedAnnouncement(null)}>
            <DrawerContent>
                {selectedAnnouncement && (
                    <div className="mx-auto w-full max-w-sm">
                    <DrawerHeader className="text-left">
                        <DrawerTitle className="flex items-center gap-2">
                            <Megaphone className="h-5 w-5 text-primary" />
                            <span>{selectedAnnouncement.title}</span>
                        </DrawerTitle>
                        <DrawerDescription className="flex items-center gap-2 text-xs pt-1">
                           <Calendar className="h-4 w-4" />
                           <span>{selectedAnnouncement.date instanceof Date ? format(selectedAnnouncement.date, 'PPP', { locale: id }) : 'N/A'}</span>
                        </DrawerDescription>
                    </DrawerHeader>
                    <div className="p-4 pt-0">
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{selectedAnnouncement.content}</p>
                    </div>
                    <DrawerFooter>
                        <DrawerClose asChild>
                        <Button>Tutup</Button>
                        </DrawerClose>
                    </DrawerFooter>
                    </div>
                )}
            </DrawerContent>
        </Drawer>
    </div>
  );
}
