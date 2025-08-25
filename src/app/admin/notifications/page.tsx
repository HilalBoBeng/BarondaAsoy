
"use client";

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { db } from '@/lib/firebase/client';
import { collection, doc, getDocs, addDoc, serverTimestamp, query, orderBy, writeBatch, deleteDoc, limit, startAfter, type QueryDocumentSnapshot, type DocumentData } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Send, PlusCircle, Trash, User } from 'lucide-react';
import type { AppUser, Notification } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

const notificationSchema = z.object({
  userId: z.string().min(1, "Tujuan (warga atau 'Semua Warga') harus dipilih."),
  title: z.string().min(1, "Judul tidak boleh kosong."),
  message: z.string().min(1, "Pesan tidak boleh kosong."),
});

type NotificationFormValues = z.infer<typeof notificationSchema>;

const NOTIFICATIONS_PER_PAGE = 10;

export default function NotificationsAdminPage() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingNotifs, setLoadingNotifs] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastVisible, setLastVisible] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();

  const form = useForm<NotificationFormValues>({
    resolver: zodResolver(notificationSchema),
    defaultValues: { userId: '', title: '', message: '' },
  });

  const fetchUsers = async () => {
    try {
      const usersQuery = query(collection(db, "users"), orderBy("displayName"));
      const usersSnapshot = await getDocs(usersQuery);
      const usersData = usersSnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() })) as AppUser[];
      setUsers(usersData);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast({ variant: 'destructive', title: 'Gagal Memuat', description: 'Tidak dapat mengambil daftar warga.' });
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchNotifications = async (initial = false) => {
    if (initial) setLoadingNotifs(true);
    else setLoadingMore(true);

    try {
        const notifsRef = collection(db, 'notifications');
        let q;
        const constraints = [orderBy('createdAt', 'desc'), limit(NOTIFICATIONS_PER_PAGE)];
        
        if (initial) {
            q = query(notifsRef, ...constraints);
        } else if (lastVisible) {
            q = query(notifsRef, ...constraints, startAfter(lastVisible));
        } else {
             if (initial) setLoadingNotifs(false); else setLoadingMore(false);
             setHasMore(false);
             return;
        }
        
        const documentSnapshots = await getDocs(q);
        
        const userMap = new Map(users.map(u => [u.uid, u]));

        const newNotifs = documentSnapshots.docs.map(docSnap => {
            const data = docSnap.data();
            const recipient = userMap.get(data.userId) || { displayName: 'Semua Warga', email: '' };
            return {
                id: docSnap.id,
                ...data,
                createdAt: data.createdAt?.toDate(),
                recipientName: recipient.displayName,
                recipientEmail: recipient.email,
            } as Notification;
        });

        const lastDoc = documentSnapshots.docs[documentSnapshots.docs.length - 1];
        setLastVisible(lastDoc || null);

        if (initial) setNotifications(newNotifs);
        else setNotifications(prev => [...prev, ...newNotifs]);

        if (documentSnapshots.docs.length < NOTIFICATIONS_PER_PAGE) setHasMore(false);

    } catch (error) {
        console.error("Error fetching notifications:", error);
        toast({ variant: 'destructive', title: 'Gagal Memuat Notifikasi' });
    } finally {
        if (initial) setLoadingNotifs(false); else setLoadingMore(false);
    }
  };
  
  useEffect(() => {
    fetchUsers();
  }, []);
  
  useEffect(() => {
    if (!loadingUsers) {
        fetchNotifications(true);
    }
  }, [loadingUsers]);


  const onSubmit = async (values: NotificationFormValues) => {
    setIsSubmitting(true);
    try {
      if (values.userId === 'all') {
        if (users.length === 0) {
          toast({ variant: 'destructive', title: "Gagal", description: "Tidak ada warga terdaftar untuk dikirimi notifikasi." });
          setIsSubmitting(false);
          return;
        }
        const batch = writeBatch(db);
        users.forEach(user => {
          const newNotifRef = doc(collection(db, 'notifications'));
          batch.set(newNotifRef, {
            userId: user.uid,
            title: values.title,
            message: values.message,
            read: false,
            createdAt: serverTimestamp(),
          });
        });
        await batch.commit();
        toast({ title: "Berhasil", description: `Pemberitahuan berhasil dikirim ke ${users.length} warga.` });
      } else {
        await addDoc(collection(db, 'notifications'), {
          userId: values.userId,
          title: values.title,
          message: values.message,
          read: false,
          createdAt: serverTimestamp(),
        });
        toast({ title: "Berhasil", description: "Pemberitahuan berhasil dikirim." });
      }
      form.reset({ userId: '', title: '', message: '' });
      setIsDialogOpen(false);
      await fetchNotifications(true); // Refresh list
    } catch (error) {
      toast({ variant: 'destructive', title: "Gagal", description: "Terjadi kesalahan saat mengirim pemberitahuan." });
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleDelete = async (id: string) => {
    try {
        await deleteDoc(doc(db, 'notifications', id));
        setNotifications(prev => prev.filter(n => n.id !== id));
        toast({ title: "Berhasil", description: "Notifikasi telah dihapus." });
    } catch (error) {
        toast({ variant: 'destructive', title: "Gagal", description: "Gagal menghapus notifikasi." });
    }
  }

  return (
    <>
    <Card>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
            <CardTitle>Riwayat Pemberitahuan</CardTitle>
            <CardDescription>Kelola pemberitahuan yang telah dikirim ke warga.</CardDescription>
        </div>
        <Button onClick={() => setIsDialogOpen(true)} disabled={loadingUsers}>
            <PlusCircle className="mr-2 h-4 w-4" /> Kirim Pemberitahuan
        </Button>
      </CardHeader>
      <CardContent>
          <div className="rounded-lg border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Tanggal</TableHead>
                        <TableHead>Penerima</TableHead>
                        <TableHead>Judul</TableHead>
                        <TableHead>Pesan</TableHead>
                        <TableHead className="text-right w-[50px]">Aksi</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingNotifs ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-full" /></TableCell>
                        <TableCell className="text-right"><Skeleton className="h-8 w-10 ml-auto" /></TableCell>
                      </TableRow>
                    ))
                  ) : notifications.length > 0 ? (
                    notifications.map((notif) => (
                      <TableRow key={notif.id}>
                        <TableCell>{notif.createdAt instanceof Date ? format(notif.createdAt, "PPP, HH:mm", { locale: id }) : 'N/A'}</TableCell>
                        <TableCell>
                            <div className="flex flex-col">
                                <span className="font-medium">{notif.recipientName || notif.userId}</span>
                                <span className="text-xs text-muted-foreground">{notif.recipientEmail}</span>
                            </div>
                        </TableCell>
                        <TableCell className="font-medium">{notif.title}</TableCell>
                        <TableCell className="max-w-xs truncate">{notif.message}</TableCell>
                        <TableCell className="text-right">
                           <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="destructive" size="icon"><Trash className="h-4 w-4" /></Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Hapus Pemberitahuan?</AlertDialogTitle>
                                        <AlertDialogDescription>Tindakan ini tidak dapat dibatalkan.</AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Batal</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleDelete(notif.id)}>Hapus</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center h-24">
                        Belum ada pemberitahuan yang dikirim.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
            </Table>
          </div>
        {hasMore && !loadingNotifs && (
            <div className="text-center mt-6">
                <Button onClick={() => fetchNotifications(false)} disabled={loadingMore}>
                    {loadingMore && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Muat Lebih Banyak
                </Button>
            </div>
        )}
      </CardContent>
    </Card>

    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-lg w-[90%] rounded-lg">
            <DialogHeader>
                <DialogTitle>Kirim Pemberitahuan</DialogTitle>
                <CardDescription>Kirim pesan ke warga tertentu atau ke semua warga.</CardDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-4">
                <FormField
                  control={form.control}
                  name="userId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Kirim Ke</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Pilih tujuan..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="all">Semua Warga</SelectItem>
                          {users.map(user => (
                            <SelectItem key={user.uid} value={user.uid}>
                              {user.displayName} ({user.email})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Judul</FormLabel>
                      <FormControl><Input placeholder="Judul pemberitahuan" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="message"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Isi Pesan</FormLabel>
                      <FormControl><Textarea placeholder="Tulis pesan Anda di sini..." {...field} rows={4} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                    <DialogClose asChild><Button type="button" variant="secondary">Batal</Button></DialogClose>
                    <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                        Kirim
                    </Button>
                </DialogFooter>
              </form>
            </Form>
        </DialogContent>
    </Dialog>
    </>
  );
}
