
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
import { collection, onSnapshot, query, where, doc, deleteDoc, orderBy, updateDoc, getDoc } from 'firebase/firestore';
import { LogIn, LogOut, UserPlus, UserCircle, Settings, Loader2, Bell, X, Mail, Trash, ShieldBan } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import type { Notification, AppUser } from "@/lib/types";
import { formatDistanceToNow } from 'date-fns';
import { id } from 'date-fns/locale';
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter } from "@/components/ui/alert-dialog";

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [userInfo, setUserInfo] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [greeting, setGreeting] = useState("Selamat Datang");
  const [currentTime, setCurrentTime] = useState("");
  const [currentDate, setCurrentDate] = useState("");
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);

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

    return () => clearInterval(timer);
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

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
        setUser(currentUser);
        if (currentUser) {
            const userDocRef = doc(db, 'users', currentUser.uid);
            const userDocSnap = await getDoc(userDocRef);
            if(userDocSnap.exists()) {
                const userData = userDocSnap.data() as AppUser;
                setUserInfo(userData);
                 if (userData.isBlocked) {
                    setLoading(false); // Stop loading to show the dialog
                    return; 
                }
            }

            const q = query(collection(db, "notifications"), where("userId", "==", currentUser.uid));
            const unsubscribeNotifications = onSnapshot(q, (snapshot) => {
                const notifsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Notification[];
                const sortedNotifs = notifsData.sort((a, b) => {
                    const dateA = a.createdAt ? (a.createdAt as any).toDate() : 0;
                    const dateB = b.createdAt ? (b.createdAt as any).toDate() : 0;
                    return dateB - dateA;
                });
                setNotifications(sortedNotifs);
            }, (error) => {
                console.error("Error fetching notifications: ", error);
            });
             setLoading(false);
            return () => unsubscribeNotifications();
        } else {
            setUserInfo(null);
            setNotifications([]);
            setLoading(false);
        }
    });

    return () => unsubscribeAuth();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth, router]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast({
        title: "Berhasil Keluar",
        description: "Anda telah berhasil keluar dari akun Anda.",
      });
      setUserInfo(null);
      setUser(null);
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

  const handleNotificationDelete = async (notifId: string) => {
      try {
          await deleteDoc(doc(db, "notifications", notifId));
          toast({ title: 'Berhasil', description: 'Notifikasi telah dihapus.' });
          setSelectedNotification(null);
      } catch (error) {
          toast({ variant: 'destructive', title: 'Gagal', description: 'Tidak dapat menghapus notifikasi.' });
      }
  }
  
  const unreadNotifications = notifications.filter(n => !n.read).length;

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
  
  if (userInfo?.isBlocked) {
    return (
        <AlertDialog open={true}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2"><ShieldBan className="h-6 w-6 text-destructive"/>Akun Anda Diblokir</AlertDialogTitle>
                    <AlertDialogDescription className="text-sm text-muted-foreground">
                        <div>Akun Anda telah ditangguhkan oleh admin.</div>
                        {userInfo.blockReason && <div className="mt-2"><strong>Alasan:</strong> {userInfo.blockReason}</div>}
                        {userInfo.blockEnds && <div className="mt-1"><strong>Blokir berakhir:</strong> {userInfo.blockEnds}</div>}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                 <div className="text-sm text-muted-foreground w-full text-center">Silakan hubungi admin atau petugas untuk informasi lebih lanjut.</div>
                <AlertDialogFooter>
                    <Button variant="destructive" onClick={handleLogout} className="w-full">
                        <LogOut className="mr-2 h-4 w-4" /> Keluar
                    </Button>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
  }


  return (
    <>
    <div className="flex min-h-screen flex-col bg-muted/40">
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/95 px-4 backdrop-blur-sm sm:px-6">
        <div className="flex items-center gap-3">
           <Link href="/auth/staff-login" className="flex items-center gap-2 sm:gap-3">
            <Image 
              src="https://iili.io/KJ4aGxp.png" 
              alt="Logo" 
              width={40} 
              height={40}
              className="h-8 w-8 sm:h-10 sm:w-10"
            />
            <div className="flex flex-col">
              <span className="text-base sm:text-lg font-bold text-primary leading-tight">Baronda</span>
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
                        <DropdownMenuLabel>Pemberitahuan</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {notifications.length > 0 ? (
                            notifications.map(notif => (
                                <DropdownMenuItem key={notif.id} onSelect={(e) => { e.preventDefault(); handleNotificationClick(notif)}} className="flex items-start gap-2 cursor-pointer">
                                   <div className="flex-grow">
                                        <div className="font-semibold flex items-center gap-2">
                                            {notif.title}
                                            {!notif.read && <Badge className="h-4 px-1.5 text-[10px]">Baru</Badge>}
                                        </div>
                                        <p className="text-xs text-muted-foreground truncate">{notif.message}</p>
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
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
                {greeting}, {user?.displayName || 'Warga'}!
            </h1>
            <p className="text-muted-foreground text-sm sm:text-base mt-1">
                Selamat datang di Baronda Kelurahan Kilongan.
            </p>
             <p className="text-muted-foreground text-sm sm:text-base max-w-2xl">
                Baronda adalah platform siskamling digital yang dirancang untuk meningkatkan keamanan dan komunikasi di lingkungan kita.
            </p>
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
                    
                    {user && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Riwayat Laporan Anda</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ReportHistory user={user} />
                            </CardContent>
                        </Card>
                    )}
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
                    <Mail className="h-4 w-4" />
                    <span>Hubungi Admin</span>
                </a>
            </div>
        </div>
      </footer>
    </div>

    <Dialog open={!!selectedNotification} onOpenChange={(isOpen) => !isOpen && setSelectedNotification(null)}>
        <DialogContent>
            <DialogHeader>
                 <div className="flex justify-between items-start">
                    <div className="flex-grow pr-10">
                        <DialogTitle>{selectedNotification?.title}</DialogTitle>
                        <DialogDescription>
                            {selectedNotification?.createdAt ? new Date((selectedNotification.createdAt as any).toDate()).toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'short' }) : ''}
                        </DialogDescription>
                    </div>
                     <Button type="button" variant="ghost" size="icon" className="flex-shrink-0" onClick={() => {
                        if(selectedNotification) handleNotificationDelete(selectedNotification.id)
                    }}>
                        <Trash className="h-4 w-4" />
                        <span className="sr-only">Hapus</span>
                    </Button>
                 </div>
            </DialogHeader>
            <div className="py-4 whitespace-pre-wrap break-words">
                <p>{selectedNotification?.message}</p>
            </div>
            <DialogFooter>
                <Button onClick={() => setSelectedNotification(null)}>Tutup</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
    </>
  );
}
