
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
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { cn } from "@/lib/utils";
import { Home, Shield, ScrollText, UserCircle, Bell, MessageSquare, Settings, Megaphone, Calendar } from 'lucide-react';
import { usePathname } from "next/navigation";
import { UserNav } from './user-nav';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '../ui/card';
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from '../ui/drawer';

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
      <div className="space-y-6">
        <Skeleton className="h-8 w-64 mb-2" />
        <div className="space-y-6">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
        <div>
            <h2 className="text-xl sm:text-2xl font-normal tracking-tight">
              {greeting}, <span className="font-bold">{user?.displayName || 'Warga'}!</span>
            </h2>
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
