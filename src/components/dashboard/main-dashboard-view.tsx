
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
import { collection, onSnapshot, query, where, doc, updateDoc, orderBy, Timestamp, deleteDoc, writeBatch, getDocs, getDoc } from 'firebase/firestore';
import { LogIn, LogOut, UserPlus, UserCircle, Settings, Bell, X, Mail, Trash, ShieldBan, FileText, User as UserIcon, ArrowLeft, ArrowRight, Loader2, ShieldAlert, Phone, Download, HardHat } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose, DialogBody } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import type { Notification, AppUser, PatrolLog } from "@/lib/types";
import { formatDistanceToNow, intervalToDuration } from 'date-fns';
import { id } from 'date-fns/locale';
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { nanoid } from 'nanoid';

const NOTIFICATIONS_PER_PAGE = 5;

type SuspensionInfo = {
    user: AppUser;
    reason: string;
    endDate: Date | null;
    isBlocked: boolean;
};

const formatDuration = (start: Date, end: Date) => {
    const duration = intervalToDuration({ start, end });
    const parts = [];
    if (duration.days) parts.push(`${duration.days} hari`);
    if (duration.hours) parts.push(`${duration.hours} jam`);
    if (duration.minutes) parts.push(`${duration.minutes} menit`);
    if (duration.seconds) parts.push(`${duration.seconds} detik`);
    return parts.join(' ');
};

export default function MainDashboardView() {
  const [user, setUser] = useState<User | null>(null);
  const [userInfo, setUserInfo] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [allNotifications, setAllNotifications] = useState<Notification[]>([]);
  const [paginatedNotifications, setPaginatedNotifications] = useState<Notification[]>([]);
  const [notificationPage, setNotificationPage] = useState(1);
  const [greeting, setGreeting] = useState("Selamat Datang");
  const [currentTime, setCurrentTime] = useState("");
  const [currentDate, setCurrentDate] = useState("");
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  const [patrolLogs, setPatrolLogs] = useState<PatrolLog[]>([]);
  const [loadingPatrolLogs, setLoadingPatrolLogs] = useState(true);
  const [suspensionInfo, setSuspensionInfo] = useState<SuspensionInfo | null>(null);
  const [countdown, setCountdown] = useState('');

  const auth = getAuth(app);
  const { toast } = useToast();
  const router = useRouter();
  
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (suspensionInfo && suspensionInfo.endDate) {
        timer = setInterval(() => {
            const now = new Date();
            if (now > suspensionInfo.endDate!) {
                setCountdown("Selesai");
                clearInterval(timer);
            } else {
                setCountdown(formatDuration(now, suspensionInfo.endDate!));
            }
        }, 1000);
    }
    return () => clearInterval(timer);
  }, [suspensionInfo]);

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

    return () => {
      clearInterval(timer);
      unsubLogs();
    };
  }, []);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const userDocRef = doc(db, 'users', currentUser.uid);
        const unsubscribeUser = onSnapshot(userDocRef, (userDocSnap) => {
          if (userDocSnap.exists()) {
            const userData = userDocSnap.data() as AppUser;
            const fullUserData = { uid: currentUser.uid, ...userData };

             if (userData.isBlocked) {
                setSuspensionInfo({ user: fullUserData, reason: userData.suspensionReason || 'Akun Anda telah diblokir oleh admin.', endDate: null, isBlocked: true });
                auth.signOut();
                return;
            }
             if (userData.isSuspended) {
                 const endDate = (userData.suspensionEndDate as Timestamp)?.toDate() || null;
                 setSuspensionInfo({ user: fullUserData, reason: userData.suspensionReason || 'Tidak ada alasan yang diberikan.', endDate, isBlocked: false });
                 auth.signOut();
                 return;
             }
            setUserInfo(userData);
          } else {
            setUserInfo(null);
          }
          setTimeout(() => setLoading(false), 3000);
        });

        const q = query(collection(db, "notifications"), where("userId", "==", currentUser.uid));
        const unsubscribeNotifications = onSnapshot(q, (snapshot) => {
          const notifsData: Notification[] = [];
           snapshot.forEach(doc => {
            notifsData.push({ id: doc.id, ...doc.data() } as Notification)
           });
          
          const sortedNotifs = notifsData.sort((a, b) => {
            const timeA = (a.createdAt as Timestamp)?.toMillis() || 0;
            const timeB = (b.createdAt as Timestamp)?.toMillis() || 0;
            return timeB - timeA;
          });
          setAllNotifications(sortedNotifs);
        }, (error) => {
          console.error("Error fetching notifications: ", error);
        });

        return () => {
          unsubscribeUser();
          unsubscribeNotifications();
        };
      } else {
        setUserInfo(null);
        setAllNotifications([]);
        setTimeout(() => setLoading(false), 3000);
      }
    });

    return () => unsubscribeAuth();
  }, [auth, router, toast]);
  
  useEffect(() => {
      const start = (notificationPage - 1) * NOTIFICATIONS_PER_PAGE;
      const end = start + NOTIFICATIONS_PER_PAGE;
      setPaginatedNotifications(allNotifications.slice(start, end));
  }, [notificationPage, allNotifications]);

    const handleNotificationClick = async (notif: Notification) => {
      if (userInfo?.isBlocked) {
        toast({ variant: 'destructive', title: 'Akun Diblokir', description: 'Anda tidak dapat melihat detail pemberitahuan.' });
        return;
      };
      setSelectedNotification(notif);
      if (!notif.read) {
          const docRef = doc(db, 'notifications', notif.id);
          await updateDoc(docRef, { read: true });
      }
    };


  const handleAllNotificationsDelete = async () => {
      if (!user || allNotifications.length === 0) return;
      
      const batch = writeBatch(db);
      allNotifications.forEach(notif => {
          const docRef = doc(db, 'notifications', notif.id);
          batch.delete(docRef);
      });
      try {
        await batch.commit();
        toast({ title: 'Berhasil', description: 'Semua notifikasi telah dihapus.' });
      } catch (error) {
        toast({ variant: 'destructive', title: 'Gagal', description: 'Tidak dapat menghapus semua notifikasi.' });
      }
  }

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await signOut(auth);
      setTimeout(() => {
          router.push('/');
          setIsLoggingOut(false);
      }, 1500);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Gagal Keluar",
        description: "Terjadi kesalahan saat mencoba keluar.",
      });
      setIsLoggingOut(false);
    }
  };
  
  const unreadNotifications = allNotifications.filter(n => !n.read).length;
  
  const stripHtml = (html: string) => {
    if (typeof DOMParser === 'undefined') {
        return html.replace(/<[^>]+>/g, '');
    }
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return doc.body.textContent || "";
  }

  if (loading || isLoggingOut || suspensionInfo) {
    return (
      <div className={cn("flex min-h-screen flex-col items-center justify-center bg-background transition-opacity duration-500", isLoggingOut ? "animate-fade-out" : "")}>
        {!suspensionInfo ? (
          <>
            <Image 
                src="https://iili.io/KJ4aGxp.png" 
                alt="Loading Logo" 
                width={120} 
                height={120} 
                className="animate-logo-pulse"
                priority
            />
            {isLoggingOut && <p className="mt-4 text-lg text-muted-foreground animate-fade-in">Anda sedang dialihkan...</p>}
          </>
        ) : (
             <Dialog open={!!suspensionInfo} onOpenChange={() => { setSuspensionInfo(null); router.push('/auth/login'); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="text-2xl text-destructive flex items-center gap-2">
                            <ShieldAlert className="h-7 w-7" />
                            Akun {suspensionInfo?.isBlocked ? 'Diblokir' : 'Ditangguhkan'}
                        </DialogTitle>
                        <DialogDescription>
                            Akses Anda ke aplikasi telah {suspensionInfo?.isBlocked ? 'diblokir' : 'ditangguhkan sementara'} oleh admin.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogBody>
                      <div className="space-y-4 py-4 text-sm">
                          <div className="space-y-2 rounded-md border p-4">
                              <div className="flex items-center gap-2">
                                  <UserIcon className="h-4 w-4 text-muted-foreground" />
                                  <span className="font-medium">{suspensionInfo?.user.displayName}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                  <Mail className="h-4 w-4 text-muted-foreground" />
                                  <span>{suspensionInfo?.user.email}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                  <Phone className="h-4 w-4 text-muted-foreground" />
                                  <span>{suspensionInfo?.user.phone || 'No. HP tidak tersedia'}</span>
                              </div>
                          </div>
                          <div>
                              <h4 className="font-semibold">Alasan:</h4>
                              <p className="text-destructive font-bold">{suspensionInfo?.reason}</p>
                          </div>
                          {!suspensionInfo?.isBlocked && suspensionInfo?.endDate && (
                              <div>
                                  <h4 className="font-semibold">Penangguhan Berakhir dalam:</h4>
                                  <p className="text-primary font-semibold text-lg">{countdown || 'Menghitung...'}</p>
                              </div>
                          )}
                          <p className="text-xs text-muted-foreground pt-4">
                              Jika Anda merasa ini adalah sebuah kesalahan, silakan hubungi admin untuk bantuan lebih lanjut.
                          </p>
                      </div>
                    </DialogBody>
                    <DialogFooter>
                        <Button onClick={() => { setSuspensionInfo(null); router.push('/auth/login'); }} className="w-full">Saya Mengerti</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        )}
      </div>
    );
  }

  return (
    <>
    <div className="flex min-h-screen flex-col bg-muted/40">
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/95 px-4 backdrop-blur-sm sm:px-6">
        <div className="flex items-center gap-3">
           <Link href={!user ? "/auth/staff-login" : "/"} className="flex items-center gap-2 sm:gap-3">
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
        <div className="flex items-center gap-2">
            {user && (
                 <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="relative h-10 w-10 rounded-full" disabled={userInfo?.isBlocked}>
                            <Bell className="h-5 w-5" />
                            {unreadNotifications > 0 && (
                                <Badge variant="destructive" className="absolute top-1 right-1 h-5 w-5 flex items-center justify-center rounded-full p-0 text-xs">
                                    {unreadNotifications}
                                </Badge>
                            )}
                            <span className="sr-only">Notifikasi</span>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-80" align="end">
                        <DropdownMenuLabel className="flex justify-between items-center">
                            <span>Pemberitahuan</span>
                            {allNotifications.length > 0 && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive">
                                      <Trash className="h-4 w-4"/>
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Hapus Semua Notifikasi?</AlertDialogTitle>
                                    <AlertDialogDescription>Tindakan ini tidak dapat dibatalkan.</AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Batal</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleAllNotificationsDelete}>Ya, Hapus Semua</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        
                        {allNotifications.length > 0 ? (
                            allNotifications.map((notif) => (
                                <DropdownMenuItem key={notif.id} onSelect={(e) => { e.preventDefault(); handleNotificationClick(notif);}} className="flex items-start justify-between cursor-pointer p-0">
                                   <div className="flex w-full flex-grow flex-col py-1.5 pl-2 pr-1 min-w-0">
                                        <div className="flex items-center justify-between w-full">
                                            <p className="font-semibold truncate flex-grow w-0 min-w-0">{notif.title}</p>
                                            {!notif.read && <Badge className="h-4 px-1.5 text-[10px] flex-shrink-0 ml-2">Baru</Badge>}
                                        </div>
                                        <p className="text-xs text-muted-foreground truncate">{stripHtml(notif.message)}</p>
                                        <p className="text-xs text-muted-foreground mt-1">{notif.createdAt ? formatDistanceToNow((notif.createdAt as any).toDate(), { addSuffix: true, locale: id }) : ''}</p>
                                   </div>
                                </DropdownMenuItem>
                            ))
                        ) : (
                            <DropdownMenuItem disabled>Tidak ada pemberitahuan</DropdownMenuItem>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>
            )}
           {loading ? (
             <Skeleton className="h-10 w-10 rounded-full" />
           ) : (
             <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                    <Avatar>
                        <AvatarImage src={user?.photoURL || ''} alt={user?.displayName || 'User profile'} />
                        <AvatarFallback>
                            <UserIcon className="h-5 w-5" />
                        </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                   {user ? (
                    <>
                     <DropdownMenuLabel className="font-normal">
                        <div className="flex flex-col space-y-1">
                          <p className="text-sm font-medium leading-none truncate">
                            {user.displayName || "Pengguna"}
                          </p>
                          <p className="text-xs leading-none text-muted-foreground truncate">
                            {user.email}
                          </p>
                        </div>
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                         <Link href="/profile">
                           <UserIcon className="mr-2 h-4 w-4" />
                           <span>Profil Saya</span>
                         </Link>
                      </DropdownMenuItem>
                       <DropdownMenuItem asChild>
                         <Link href="/settings">
                           <Settings className="mr-2 h-4 w-4" />
                           <span>Pengaturan</span>
                         </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={handleLogout} disabled={isLoggingOut}>
                            <LogOut className="mr-2 h-4 w-4" />
                            <span>Keluar</span>
                            {isLoggingOut && <Loader2 className="ml-auto h-4 w-4 animate-spin" />}
                        </DropdownMenuItem>
                    </>
                   ) : (
                    <>
                       <DropdownMenuItem asChild>
                         <Link href="/auth/login">
                           <LogIn className="mr-2 h-4 w-4" />
                           <span>Masuk</span>
                         </Link>
                      </DropdownMenuItem>
                       <DropdownMenuItem asChild>
                         <Link href="/auth/register">
                            <UserPlus className="mr-2 h-4 w-4" />
                           <span>Daftar</span>
                         </Link>
                      </DropdownMenuItem>
                    </>
                   )}
                </DropdownMenuContent>
             </DropdownMenu>
           )}
        </div>
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
                            <CardTitle className="text-lg">Riwayat Laporan Warga</CardTitle>
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
    
    <Dialog open={!!selectedNotification} onOpenChange={(isOpen) => !isOpen && setSelectedNotification(null)}>
      <DialogContent>
        {selectedNotification && (
          <>
             <DialogHeader>
                <DialogTitle className="text-left text-lg pr-8">{selectedNotification.title}</DialogTitle>
             </DialogHeader>
             <DialogBody>
                <p className="text-foreground whitespace-pre-wrap break-words" dangerouslySetInnerHTML={{ __html: selectedNotification.message.replace(/\\n/g, '<br />') }}></p>
            </DialogBody>
            <DialogFooter>
              <Button type="button" size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 w-full sm:w-auto" onClick={() => setSelectedNotification(null)}>
                Tutup
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
    </>
  );
}
