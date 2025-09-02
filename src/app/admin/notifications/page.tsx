
"use client";

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { db } from '@/lib/firebase/client';
import { collection, doc, getDocs, addDoc, serverTimestamp, query, orderBy, writeBatch, deleteDoc, limit, startAfter, type QueryDocumentSnapshot, type DocumentData, endBefore, limitToLast } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Send, PlusCircle, Trash, User } from 'lucide-react';
import type { AppUser, Notification, Staff } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';


const notificationSchema = z.object({
  recipientIds: z.array(z.string()).min(1, "Minimal satu penerima harus dipilih."),
  title: z.string().min(1, "Judul tidak boleh kosong."),
  message: z.string().min(1, "Pesan tidak boleh kosong."),
});

type NotificationFormValues = z.infer<typeof notificationSchema>;

const NOTIFICATIONS_PER_PAGE = 10;

export default function NotificationsAdminPage() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();

  const [currentPage, setCurrentPage] = useState(1);
  const [firstVisible, setFirstVisible] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [lastVisible, setLastVisible] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [isLastPage, setIsLastPage] = useState(false);
  const [userMap, setUserMap] = useState<Map<string, AppUser | Staff>>(new Map());

  const form = useForm<NotificationFormValues>({
    resolver: zodResolver(notificationSchema),
    defaultValues: { recipientIds: [], title: '', message: '' },
  });

  const fetchRecipients = async () => {
    try {
      const usersQuery = query(collection(db, "users"), orderBy("displayName"));
      const staffQuery = query(collection(db, "staff"), orderBy("name"));

      const [usersSnapshot, staffSnapshot] = await Promise.all([getDocs(usersQuery), getDocs(staffQuery)]);
      
      const usersData = usersSnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() })) as AppUser[];
      const staffData = staffSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Staff[];
      
      setUsers(usersData);
      setStaff(staffData);

      const newMap = new Map<string, AppUser | Staff>();
      usersData.forEach(u => newMap.set(u.uid, u));
      staffData.forEach(s => newMap.set(s.id, s));
      setUserMap(newMap);

    } catch (error) {
      toast({ variant: 'destructive', title: 'Gagal Memuat Penerima', description: 'Tidak dapat mengambil daftar warga atau staf.' });
    }
  };

  const fetchNotifications = async (page: number, direction: 'next' | 'prev' | 'initial' = 'initial') => {
    setLoading(true);
    try {
      let q;
      const notifsRef = collection(db, 'notifications');
      
      if (direction === 'next' && lastVisible) {
        q = query(notifsRef, orderBy('createdAt', 'desc'), startAfter(lastVisible), limit(NOTIFICATIONS_PER_PAGE));
      } else if (direction === 'prev' && firstVisible) {
        q = query(notifsRef, orderBy('createdAt', 'desc'), endBefore(firstVisible), limitToLast(NOTIFICATIONS_PER_PAGE));
      } else {
        q = query(notifsRef, orderBy('createdAt', 'desc'), limit(NOTIFICATIONS_PER_PAGE));
      }

      const documentSnapshots = await getDocs(q);
      
      if (documentSnapshots.empty && direction !== 'initial') {
        setIsLastPage(true);
        setLoading(false);
        if (direction === 'next') setCurrentPage(prev => prev > 1 ? prev - 1 : 1);
        return;
      }
      
      const newNotifs = documentSnapshots.docs.map(docSnap => {
        const data = docSnap.data();
        const recipient = userMap.get(data.userId);
        return {
          id: docSnap.id,
          ...data,
          createdAt: data.createdAt?.toDate(),
          recipientName: recipient?.displayName || recipient?.name || data.userId,
          recipientEmail: recipient?.email,
        } as Notification;
      });

      setNotifications(newNotifs);
      setFirstVisible(documentSnapshots.docs[0] || null);
      setLastVisible(documentSnapshots.docs[documentSnapshots.docs.length - 1] || null);
      setIsLastPage(documentSnapshots.docs.length < NOTIFICATIONS_PER_PAGE);

    } catch (error) {
      console.error("Error fetching notifications:", error);
      toast({ variant: 'destructive', title: 'Gagal Memuat Notifikasi' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecipients().then(() => fetchNotifications(1));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userMap.size]); 
  
  const goToNextPage = () => {
    const newPage = currentPage + 1;
    setCurrentPage(newPage);
    fetchNotifications(newPage, 'next');
  };

  const goToPrevPage = () => {
    if (currentPage === 1) return;
    const newPage = currentPage - 1;
    setCurrentPage(newPage);
    fetchNotifications(newPage, 'prev');
  };

  const onSubmit = async (values: NotificationFormValues) => {
    setIsSubmitting(true);
    try {
        if (values.recipientIds.length === 0) {
          toast({ variant: 'destructive', title: "Gagal", description: "Tidak ada penerima dipilih." });
          setIsSubmitting(false);
          return;
        }

        const batch = writeBatch(db);
        const title = values.title.toUpperCase();
        const message = values.message.toUpperCase();

        values.recipientIds.forEach(userId => {
          const newNotifRef = doc(collection(db, 'notifications'));
          batch.set(newNotifRef, {
            userId: userId,
            title: title,
            message: message,
            read: false,
            createdAt: serverTimestamp(),
          });
        });
        await batch.commit();

        toast({ title: "Berhasil", description: `Pemberitahuan berhasil dikirim ke ${values.recipientIds.length} penerima.` });
      
        form.reset({ recipientIds: [], title: '', message: '' });
        setIsDialogOpen(false);
        await fetchNotifications(1); // Refresh list
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
  
  type Recipient = AppUser | Staff;

  const RecipientList = ({ recipients, field }: { recipients: Recipient[], field: any }) => (
    <ScrollArea className="h-48 rounded-md border">
      <div className="p-4">
        {recipients.map((recipient: Recipient) => {
          const recipientId = (recipient as AppUser).uid || (recipient as Staff).id;
          const recipientName = (recipient as AppUser).displayName || (recipient as Staff).name;
          return (
            <FormField
              key={recipientId}
              control={form.control}
              name="recipientIds"
              render={({ field }) => (
                <FormItem key={recipientId} className="flex flex-row items-start space-x-3 space-y-0 py-2">
                  <FormControl>
                    <Checkbox
                      checked={field.value?.includes(recipientId)}
                      onCheckedChange={(checked) => {
                        return checked
                          ? field.onChange([...field.value, recipientId])
                          : field.onChange(field.value?.filter((value) => value !== recipientId));
                      }}
                    />
                  </FormControl>
                  <FormLabel className="font-normal w-full">
                    <div className="flex justify-between">
                      <span>{recipientName}</span>
                      <span className="text-muted-foreground text-xs">{recipient.email}</span>
                    </div>
                  </FormLabel>
                </FormItem>
              )}
            />
          );
        })}
      </div>
    </ScrollArea>
  );


  return (
    <>
    <Card>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
            <CardTitle>Riwayat Pemberitahuan</CardTitle>
            <CardDescription>Kelola pemberitahuan yang telah dikirim ke warga.</CardDescription>
        </div>
        <Button onClick={() => setIsDialogOpen(true)} disabled={loading}>
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
                  {loading ? (
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
                                <AlertDialogContent className="rounded-lg">
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
      </CardContent>
       <CardFooter>
        <div className="flex items-center justify-end space-x-2 w-full">
            <Button
                variant="outline"
                size="sm"
                onClick={goToPrevPage}
                disabled={currentPage === 1 || loading}
            >
                Sebelumnya
            </Button>
            <span className="text-sm text-muted-foreground">Halaman {currentPage}</span>
            <Button
                variant="outline"
                size="sm"
                onClick={goToNextPage}
                disabled={isLastPage || loading}
            >
                Berikutnya
            </Button>
        </div>
      </CardFooter>
    </Card>

    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-lg w-[90%] rounded-lg">
            <DialogHeader>
                <DialogTitle>Kirim Pemberitahuan</DialogTitle>
                <CardDescription>Kirim pesan ke warga atau staf tertentu.</CardDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-4">
                 <FormField
                  control={form.control}
                  name="recipientIds"
                  render={({ field }) => (
                    <FormItem>
                       <div className="mb-4">
                        <FormLabel className="text-base">Pilih Penerima</FormLabel>
                       </div>
                       <Tabs defaultValue="users">
                            <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="users">Warga</TabsTrigger>
                                <TabsTrigger value="staff">Staf</TabsTrigger>
                            </TabsList>
                            <TabsContent value="users" className="mt-4">
                                <RecipientList recipients={users} field={field} />
                            </TabsContent>
                             <TabsContent value="staff" className="mt-4">
                                <RecipientList recipients={staff} field={field} />
                            </TabsContent>
                       </Tabs>
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
