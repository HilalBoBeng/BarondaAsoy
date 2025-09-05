
"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import ReportActivity from '@/components/dashboard/report-activity';
import ReportHistory from "@/components/dashboard/report-history";
import Schedule from '@/components/dashboard/schedule';
import Announcements from '@/components/dashboard/announcements';
import EmergencyContacts from "@/components/dashboard/emergency-contacts";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged, signOut, type User } from "firebase/auth";
import { app, db } from "@/lib/firebase/client";
import { collection, onSnapshot, query, where, doc, updateDoc, orderBy, Timestamp, getDocs, limit } from 'firebase/firestore';
import { UserNav } from "@/components/dashboard/user-nav";
import { Skeleton } from "@/components/ui/skeleton";
import type { AppUser, PatrolLog } from "@/lib/types";
import { formatDistanceToNow } from 'date-fns';
import { id } from 'date-fns/locale';
import { cn } from "@/lib/utils";

export default function MainDashboardView() {
  const [user, setUser] = useState<User | null>(null);
  const [userInfo, setUserInfo] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [greeting, setGreeting] = useState("Selamat Datang");
  const [currentTime, setCurrentTime] = useState("");
  const [currentDate, setCurrentDate] = useState("");
  const [patrolLogs, setPatrolLogs] = useState<PatrolLog[]>([]);
  const [loadingPatrolLogs, setLoadingPatrolLogs] = useState(true);

  const auth = getAuth(app);
  
  useEffect(() => {
    const getGreeting = () => {
      const hour = new Date().getHours();
      if (hour >= 5 && hour < 12) return "Selamat Pagi";
      if (hour >= 12 && hour < 15) return "Selamat Siang";
      if (hour >= 15 && hour < 19) return "Selamat Sore";
      return "Selamat Malam";
    };

    const timer = setInterval(() => {
      const now = new Date();
      setGreeting(getGreeting());
      setCurrentTime(now.toLocaleTimeString('id-ID'));
      setCurrentDate(now.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }));
    }, 1000);

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const logsQuery = query(
      collection(db, 'patrol_logs'), 
      where('createdAt', '>=', twentyFourHoursAgo), 
      orderBy('createdAt', 'desc')
    );
    const unsubLogs = onSnapshot(logsQuery, (snapshot) => {
      const logs = snapshot.docs.map(d => ({id: d.id, ...d.data()}) as PatrolLog);
      setPatrolLogs(logs);
      setLoadingPatrolLogs(false);
    });

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
      clearInterval(timer);
      unsubLogs();
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
        <div className="flex items-center gap-3">
           <Link href="/" className="flex items-center gap-2 sm:gap-3">
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
          </Link>
        </div>
        <UserNav user={user} userInfo={userInfo} />
      </header>
      <main className="flex-1 overflow-auto p-4 sm:p-6 md:p-8">
        <div className="mx-auto w-full max-w-screen-2xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
                {loading ? (
                    <>
                        <Skeleton className="h-8 w-64 mb-2" />
                        <Skeleton className="h-5 w-72" />
                    </>
                ) : (
                    <h1 className="text-xl sm:text-2xl font-bold tracking-tight break-word">
                        {greeting}, {user?.displayName || 'Warga'}!
                    </h1>
                )}
                <p className="text-muted-foreground text-sm sm:text-base mt-1">
                    {currentDate} | {currentTime}
                </p>
            </div>
          </div>

          <div className="space-y-6">
             <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Pengumuman</CardTitle>
                </CardHeader>
                <CardContent>
                    <Announcements userInfo={userInfo} />
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Lapor Aktivitas</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ReportActivity user={user} userInfo={userInfo} />
                        </CardContent>
                    </Card>
                    
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Riwayat Laporan Publik</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ReportHistory />
                        </CardContent>
                    </Card>
                </div>
                <div className="lg:col-span-1 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Jadwal Patroli</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="max-h-[500px] overflow-auto">
                                <Schedule />
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Kontak Darurat</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <EmergencyContacts />
                        </CardContent>
                    </Card>

                     <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Log Patroli Terbaru (24 Jam Terakhir)</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 max-h-[400px] overflow-auto">
                           {loadingPatrolLogs ? <Skeleton className="h-20 w-full" /> : 
                           patrolLogs.length > 0 ? (
                                patrolLogs.map((log) => (
                                    <div key={log.id} className="border-b pb-2">
                                        <div className="flex justify-between text-xs text-muted-foreground">
                                            <span>Oleh: {log.officerName}</span>
                                            <span>{formatDistanceToNow((log.createdAt as Timestamp).toDate(), { addSuffix: true, locale: id })}</span>
                                        </div>
                                        <p className="font-semibold text-sm mt-1">{log.title}</p>
                                        <p className="text-xs text-muted-foreground">{log.description}</p>
                                    </div>
                                ))
                           ) : (
                               <p className="text-center text-sm text-muted-foreground py-4">Tidak ada log patroli dalam 24 jam terakhir.</p>
                           )}
                        </CardContent>
                    </Card>
                </div>
            </div>
          </div>
        </div>
      </main>
      <footer className="border-t bg-background py-6 text-center text-sm text-muted-foreground px-4">
        <div className="space-y-2">
            <p>© {new Date().getFullYear()} Baronda by BoBeng - Siskamling Digital Kelurahan Kilongan.</p>
        </div>
      </footer>
    </div>
  );
}
