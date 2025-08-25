
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
import Announcements from "@/components/dashboard/announcements";
import EmergencyContacts from "@/components/dashboard/emergency-contacts";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged, signOut, type User } from "firebase/auth";
import { app, db } from "@/lib/firebase/client";
import { collection, onSnapshot, query, where, doc, deleteDoc } from 'firebase/firestore';
import { LogIn, LogOut, UserPlus, UserCircle, Settings, Loader2, Bell, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import type { Notification } from "@/lib/types";
import { formatDistanceToNow } from 'date-fns';
import { id } from 'date-fns/locale';
import { Badge } from "@/components/ui/badge";

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const auth = getAuth(app);
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    const userRole = localStorage.getItem('userRole');
    if (userRole === 'admin') {
      router.replace('/admin');
      return; 
    } else if (userRole === 'petugas') {
      router.replace('/petugas');
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
      
      if (currentUser) {
          const q = query(collection(db, "notifications"), where("userId", "==", currentUser.uid), orderBy("createdAt", "desc"));
          const unsubNotifications = onSnapshot(q, (snapshot) => {
              const notifs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Notification[];
              setNotifications(notifs);
          });
          return () => unsubNotifications();
      } else {
          setNotifications([]);
      }
    });

    return () => unsubscribe();
  }, [auth, router]);
  
  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast({
        title: "Berhasil Keluar",
        description: "Anda telah berhasil keluar dari akun Anda.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Gagal Keluar",
        description: "Terjadi kesalahan saat mencoba keluar.",
      });
    }
  };

  const handleNotificationDelete = async (notifId: string) => {
      try {
          await deleteDoc(doc(db, "notifications", notifId));
      } catch (error) {
          toast({ variant: 'destructive', title: 'Gagal', description: 'Tidak dapat menghapus notifikasi.' });
      }
  }
  
  const unreadNotifications = notifications.filter(n => !n.read).length;

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
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
                                <DropdownMenuItem key={notif.id} onSelect={(e) => e.preventDefault()} className="flex items-start gap-2">
                                   <div className="flex-grow">
                                        <p className="font-semibold">{notif.title}</p>
                                        <p className="text-xs text-muted-foreground">{notif.message}</p>
                                        <p className="text-xs text-muted-foreground mt-1">{formatDistanceToNow(notif.createdAt.toDate(), { addSuffix: true, locale: id })}</p>
                                   </div>
                                   <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleNotificationDelete(notif.id)}>
                                       <X className="h-4 w-4"/>
                                   </Button>
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
        <div className="mx-auto max-w-7xl space-y-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Selamat Datang di Siskamling Digital</h1>
            <p className="text-muted-foreground text-sm sm:text-base">Sistem Keamanan Lingkungan berbasis digital untuk lingkungan yang lebih aman.</p>
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
                    <CardTitle className="text-lg">Riwayat Laporan Anda</CardTitle>
                </CardHeader>
                <CardContent>
                    <ReportHistory user={user} />
                </CardContent>
            </Card>

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
      </main>
      <footer className="border-t bg-background py-4 text-center text-sm text-muted-foreground px-4">
        © {new Date().getFullYear()} Baronda - Siskamling Digital Kelurahan Kilongan.
      </footer>
    </div>
  );
}
