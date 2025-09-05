
"use client";

import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { db } from '@/lib/firebase/client';
import { collection, doc, getDocs, addDoc, serverTimestamp, query, orderBy, writeBatch, deleteDoc, limit, startAfter, type QueryDocumentSnapshot, type DocumentData, endBefore, limitToLast } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger, DrawerFooter, DrawerClose, DrawerBody } from '@/components/ui/drawer';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Send, PlusCircle, Trash, User, Eye, ImageIcon, Image as ImageIconLucide } from 'lucide-react';
import type { AppUser, Notification, Staff } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import Image from 'next/image';

const notificationSchema = z.object({
  recipientIds: z.array(z.string()).min(1, "Minimal satu penerima harus dipilih."),
  title: z.string().min(1, "Judul tidak boleh kosong.").max(50, "Judul tidak boleh lebih dari 50 karakter."),
  message: z.string().min(1, "Pesan tidak boleh kosong.").max(1200, "Pesan tidak boleh lebih dari 1200 karakter."),
});

type NotificationFormValues = z.infer<typeof notificationSchema>;

const NOTIFICATIONS_PER_PAGE = 10;

export default function NotificationsPetugasPage() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isViewMessageOpen, setIsViewMessageOpen] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState('');
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
        const title = values.title;
        
        values.recipientIds.forEach(userId => {
          const recipient = userMap.get(userId);
          const recipientName = recipient?.displayName || recipient?.name || 'Warga';
          const formattedMessage = `<strong>Yth, ${recipientName.toUpperCase()}</strong>\n\n${values.message}\n\nTerima kasih atas partisipasi Anda dalam menjaga keamanan lingkungan.\n\nHormat kami,\nPetugas, Tim Baronda`;

          const newNotifRef = doc(collection(db, 'notifications'));
          batch.set(newNotifRef, {
            userId: userId,
            title: title,
            message: formattedMessage,
            read: false,
            createdAt: serverTimestamp(),
            imageUrl: null,
          });
        });
        await batch.commit();

        toast({ title: "Berhasil", description: `Pemberitahuan berhasil dikirim ke ${values.recipientIds.length} penerima.` });
      
        form.reset({ recipientIds: [], title: '', message: ''});
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

  const handleDeleteAll = async () => {
    if (notifications.length === 0) return;
    const batch = writeBatch(db);
    notifications.forEach(notif => {
      const docRef = doc(db, 'notifications', notif.id);
      batch.delete(docRef);
    });
    try {
      await batch.commit();
      toast({ title: 'Berhasil', description: 'Semua notifikasi telah dihapus.' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Gagal', description: 'Gagal menghapus semua notifikasi.' });
    }
  }
  
  type Recipient = AppUser | Staff;
  type RecipientType = 'users' | 'staff';

  const RecipientList = ({ recipients, field, type }: { recipients: Recipient[], field: any, type: RecipientType }) => (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => {
            const allIds = recipients.map(r => (r as AppUser).uid || (r as Staff).id);
            const currentIds = field.value || [];
            const newIds = [...new Set([...currentIds, ...allIds])];
            field.onChange(newIds);
        }}
        >
        Pilih Semua {type === 'users' ? 'Warga' : 'Staf'}
      </Button>
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
    </div>
  );


  return (
    <>
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className='flex-grow'>
            <CardTitle>Riwayat Pemberitahuan</CardTitle>
            <CardDescription>Kelola pemberitahuan yang telah dikirim ke warga.</CardDescription>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button onClick={() => setIsDialogOpen(true)} disabled={loading}>
              <PlusCircle className="mr-2 h-4 w-4" /> Kirim
          </Button>
           {notifications.length > 0 && (
             <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="icon">
                  <Trash className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Hapus Semua Notifikasi?</AlertDialogTitle>
                  <AlertDialogDescription>Tindakan ini akan menghapus semua {notifications.length} notifikasi secara permanen.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Batal</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteAll}>Ya, Hapus Semua</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </CardHeader>
      <CardContent>
          <div className="rounded-lg border">
            <div className="overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Tanggal</TableHead>
                            <TableHead>Penerima</TableHead>
                            <TableHead>Judul</TableHead>
                            <TableHead className="w-[100px]">Pesan</TableHead>
                            <TableHead className="text-right w-[50px]">Aksi</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        Array.from({ length: 5 }).map((_, i) => (
                           <TableRow key={i}>
                            <TableCell className="w-[180px]"><Skeleton className="h-5 w-full" /></TableCell>
                            <TableCell><Skeleton className="h-5 w-full" /></TableCell>
                            <TableCell><Skeleton className="h-5 w-full" /></TableCell>
                            <TableCell className="w-[100px]"><Skeleton className="h-10 w-10" /></TableCell>
                            <TableCell className="w-[50px] text-right"><Skeleton className="h-10 w-10 ml-auto" /></TableCell>
                          </TableRow>
                        ))
                      ) : notifications.length > 0 ? (
                        notifications.map((notif) => (
                          <TableRow key={notif.id}>
                            <TableCell>{notif.createdAt instanceof Date ? format(notif.createdAt, "PPP, HH:mm", { locale: id }) : 'N/A'}</TableCell>
                            <TableCell>
                              <span className="font-medium">{notif.recipientName || notif.userId}</span>
                            </TableCell>
                            <TableCell className="font-medium">{notif.title}</TableCell>
                            <TableCell>
                              <Button variant="outline" size="icon" onClick={() => { setSelectedMessage(notif.message); setIsViewMessageOpen(true);}}>
                                <Eye className="h-4 w-4"/>
                              </Button>
                            </TableCell>
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

    <Drawer open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DrawerContent>
            <DrawerHeader>
                <DrawerTitle>Kirim Pemberitahuan</DrawerTitle>
            </DrawerHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)}>
                <DrawerBody className="space-y-6 px-4">
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
                                <RecipientList recipients={users} field={field} type="users" />
                            </TabsContent>
                             <TabsContent value="staff" className="mt-4">
                                <RecipientList recipients={staff} field={field} type="staff" />
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
                      <FormControl>
                        <Input 
                            placeholder="Judul pemberitahuan" 
                            {...field} 
                            maxLength={50}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                }
                            }}
                        />
                      </FormControl>
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
                      <FormControl><Textarea placeholder="Tulis pesan Anda di sini..." {...field} rows={4} maxLength={1200} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                </DrawerBody>
                <DrawerFooter>
                    <DrawerClose asChild><Button type="button" variant="secondary">Batal</Button></DrawerClose>
                    <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                        Kirim
                    </Button>
                </DrawerFooter>
              </form>
            </Form>
        </DrawerContent>
    </Drawer>

    <Drawer open={isViewMessageOpen} onOpenChange={setIsViewMessageOpen}>
        <DrawerContent>
            <DrawerHeader>
                <DrawerTitle>Isi Pesan</DrawerTitle>
            </DrawerHeader>
            <DrawerBody className="px-4">
               <div className="py-4 whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: selectedMessage.replace(/\n/g, '<br />') }}>
               </div>
            </DrawerBody>
            <DrawerFooter>
                <Button onClick={() => setIsViewMessageOpen(false)}>Tutup</Button>
            </DrawerFooter>
        </DrawerContent>
    </Drawer>
    </>
  );
}
