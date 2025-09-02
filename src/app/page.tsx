
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
import { collection, onSnapshot, query, where, doc, updateDoc, orderBy, Timestamp, deleteDoc, writeBatch, getDocs } from 'firebase/firestore';
import { LogIn, LogOut, UserPlus, UserCircle, Settings, Bell, X, Mail, Trash, ShieldBan, FileText, User as UserIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import type { Notification, AppUser, PatrolLog } from "@/lib/types";
import { formatDistanceToNow } from 'date-fns';
import { id } from 'date-fns/locale';
import { Badge } from "@/components/ui/badge";

const NOTIFICATIONS_PER_PAGE = 5;

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [userInfo, setUserInfo] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [allNotifications, setAllNotifications] = useState<Notification[]>([]);
  const [paginatedNotifications, setPaginatedNotifications] = useState<Notification[]>([]);
  const [notificationPage, setNotificationPage] = useState(1);
  const [greeting, setGreeting] = useState("Selamat Datang");
  const [currentTime, setCurrentTime] = useState("");
  const [currentDate, setCurrentDate] = useState("");
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  const [patrolLogs, setPatrolLogs] = useState<PatrolLog[]>([]);
  const [loadingPatrolLogs, setLoadingPatrolLogs] = useState(true);

  const auth = getAuth(app);
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    const getGreeting = () => {
      const hour = new Date().getHours();
      if (hour >= 5 && hour < 12) return "Selamat Pagi";
      if (hour >= 12 && hour < 15) return "Selamat Siang";
      if (hour >= 15 && hour < 19) return "Selamat Sore";
      return "Selamat Malam";
    };
    setGreeting(getGreeting());

    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('id-ID'));
      setCurrentDate(now.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }));
    }, 1000);

    // Fetch patrol logs
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
    const userRole = localStorage.getItem('userRole');
    if (userRole === 'admin') {
      router.replace('/admin');
      return; 
    } else if (userRole === 'petugas') {
      router.replace('/petugas');
      return;
    }

    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const userDocRef = doc(db, 'users', currentUser.uid);
        const unsubscribeUser = onSnapshot(userDocRef, (userDocSnap) => {
          if (userDocSnap.exists()) {
            const userData = userDocSnap.data() as AppUser;
            setUserInfo(userData);
          } else {
            setUserInfo(null);
          }
          setLoading(false);
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
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, [auth, router]);
  
  useEffect(() => {
      const start = (notificationPage - 1) * NOTIFICATIONS_PER_PAGE;
      const end = start + NOTIFICATIONS_PER_PAGE;
      setPaginatedNotifications(allNotifications.slice(start, end));
  }, [notificationPage, allNotifications]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast({
        title: "Berhasil Keluar",
        description: "Anda telah berhasil keluar dari akun Anda.",
      });
      setUserInfo(null);
      setUser(null);
      router.push('/');
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Gagal Keluar",
        description: "Terjadi kesalahan saat mencoba keluar.",
      });
    }
  };

  const handleNotificationClick = async (notif: Notification) => {
      setSelectedNotification(notif);
      if (!notif.read) {
          const docRef = doc(db, 'notifications', notif.id);
          await updateDoc(docRef, { read: true });
      }
  }

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
  
  const unreadNotifications = allNotifications.filter(n => !n.read).length;

  if (loading) {
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
                        <Button variant="ghost" size="icon" className="relative h-10 w-10 rounded-full">
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
                            {paginatedNotifications.length > 0 && (
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
                                    <AlertDialogAction onClick={handleAllNotificationsDelete}>Ya, Hapus</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <p className="px-2 py-1.5 text-xs text-muted-foreground">Tekan untuk lihat selengkapnya</p>
                        
                        {paginatedNotifications.length > 0 ? (
                            paginatedNotifications.map(notif => (
                                <DropdownMenuItem key={notif.id} onSelect={(e) => { e.preventDefault(); handleNotificationClick(notif);}} className="flex items-start justify-between cursor-pointer p-0">
                                   <div className="flex-grow py-1.5 pl-2 pr-1">
                                        <div className="font-semibold flex items-center gap-2">
                                            <p className="truncate">{notif.title}</p>
                                            {!notif.read && <Badge className="h-4 px-1.5 text-[10px]">Baru</Badge>}
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-1">{notif.createdAt ? formatDistanceToNow((notif.createdAt as any).toDate(), { addSuffix: true, locale: id }) : ''}</p>
                                   </div>
                                </DropdownMenuItem>
                            ))
                        ) : (
                            <DropdownMenuItem disabled>Tidak ada pemberitahuan</DropdownMenuItem>
                        )}
                        {allNotifications.length > NOTIFICATIONS_PER_PAGE && (
                          <>
                           <DropdownMenuSeparator />
                           <DropdownMenuItem className="p-0">
                              <div className="flex justify-between w-full items-center p-2">
                                  <Button variant="ghost" size="sm" onClick={() => setNotificationPage(p => p - 1)} disabled={notificationPage === 1}>Sebelumnya</Button>
                                  <span className="text-xs text-muted-foreground">Hal {notificationPage}</span>
                                  <Button variant="ghost" size="sm" onClick={() => setNotificationPage(p => p + 1)} disabled={notificationPage * NOTIFICATIONS_PER_PAGE >= allNotifications.length}>Berikutnya</Button>
                              </div>
                           </DropdownMenuItem>
                          </>
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
                        <AvatarImage src={user?.photoURL || ''} alt="User profile" />
                        <AvatarFallback>
                            <UserCircle className="h-8 w-8" />
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
                       <DropdownMenuItem onClick={handleLogout}>
                        <LogOut className="mr-2 h-4 w-4" />
                        <span>Keluar</span>
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
                       <DropdownMenuSeparator />
                       <DropdownMenuItem asChild>
                         <Link href="/settings">
                           <Settings className="mr-2 h-4 w-4" />
                           <span>Pengaturan</span>
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
        <div className="mx-auto max-w-screen-2xl space-y-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight break-word">
                {greeting}, {user?.displayName || 'Warga'}!
            </h1>
            <p className="text-muted-foreground text-sm sm:text-base mt-2">
                {currentDate} | {currentTime}
            </p>
          </div>

          <div className="space-y-6">
             <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Pengumuman</CardTitle>
                </CardHeader>
                <CardContent>
                    <Announcements />
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Lapor Aktivitas</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ReportActivity user={user} />
                        </CardContent>
                    </Card>
                    
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Riwayat Laporan Komunitas</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ReportHistory user={user} />
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
            <div className="flex justify-center">
                 <a href="mailto:admin@bobeng.icu" className="inline-flex items-center gap-2 text-primary hover:underline">
                    <Mail className="mr-2 h-4 w-4" />
                    <span>Hubungi Admin</span>
                </a>
            </div>
        </div>
      </footer>
    </div>
    
    <Dialog open={!!selectedNotification} onOpenChange={(isOpen) => !isOpen && setSelectedNotification(null)}>
        <DialogContent className="w-[90%] sm:max-w-lg rounded-lg p-0 flex flex-col gap-0">
             {selectedNotification && (
                <>
                    <DialogHeader className="flex flex-row items-center justify-between space-y-0 bg-primary text-primary-foreground p-4 rounded-t-lg">
                        <DialogTitle>Pemberitahuan</DialogTitle>
                         <DialogClose asChild>
                            <Button type="button" variant="ghost" size="icon" className="text-primary-foreground h-7 w-7">
                                <X className="h-4 w-4" />
                                <span className="sr-only">Tutup</span>
                            </Button>
                        </DialogClose>
                    </DialogHeader>
                    <div className="p-6 whitespace-pre-wrap break-word min-h-[150px] flex-grow">
                       <p className="text-foreground">{selectedNotification?.message}</p>
                    </div>
                    <DialogFooter className="p-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end border-t">
                        <Button type="button" size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setSelectedNotification(null)}>Tutup</Button>
                    </DialogFooter>
                </>
             )}
        </DialogContent>
    </Dialog>
    </>
  );
}
