
"use client";

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase/client';
import { collection, onSnapshot, doc, deleteDoc, query, orderBy, getDocs, addDoc, updateDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Trash, User as UserIcon, Mail, ShieldX, PlusCircle, Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Calendar as CalendarIcon } from 'lucide-react';
import { id } from 'date-fns/locale';
import type { AppUser, Staff } from '@/lib/types';

const blockUserSchema = z.object({
  blockStarts: z.date({ required_error: "Tanggal mulai blokir harus diisi." }),
  blockEnds: z.date({ required_error: "Tanggal berakhir blokir harus diisi." }),
  blockReason: z.string().min(5, "Alasan blokir harus diisi (minimal 5 karakter)."),
});
type BlockUserFormValues = z.infer<typeof blockUserSchema>;

const addStaffSchema = z.object({
  name: z.string().min(1, "Nama staf tidak boleh kosong."),
  phone: z.string().min(1, "Nomor HP tidak boleh kosong."),
  accessCode: z.string().min(6, "Kode akses minimal 6 karakter."),
});
type AddStaffFormValues = z.infer<typeof addStaffSchema>;

export default function UsersAdminPage() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  
  // State for dialogs
  const [isBlockDialogOpen, setIsBlockDialogOpen] = useState(false);
  const [isAddStaffDialogOpen, setIsAddStaffDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);

  const blockForm = useForm<BlockUserFormValues>({ resolver: zodResolver(blockUserSchema) });
  const staffForm = useForm<AddStaffFormValues>({ resolver: zodResolver(addStaffSchema) });

  useEffect(() => {
    setLoading(true);
    const usersQuery = query(collection(db, "users"), orderBy("createdAt", "desc"));
    const staffQuery = query(collection(db, "staff"), orderBy("name"));

    const unsubUsers = onSnapshot(usersQuery, (snapshot) => {
        const usersData = snapshot.docs.map(doc => ({
            uid: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate().toLocaleDateString('id-ID') || 'N/A'
        })) as AppUser[];
        setUsers(usersData);
        if (loading) setLoading(false);
    }, (error) => {
        console.error("Error fetching users:", error);
        toast({ variant: 'destructive', title: "Gagal Memuat Warga", description: "Tidak dapat mengambil data warga." });
    });
    
    const unsubStaff = onSnapshot(staffQuery, (snapshot) => {
        const staffData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Staff[];
        setStaff(staffData);
         if (loading) setLoading(false);
    }, (error) => {
        console.error("Error fetching staff:", error);
        toast({ variant: 'destructive', title: "Gagal Memuat Staf", description: "Tidak dapat mengambil data staf." });
    });
    
    return () => {
        unsubUsers();
        unsubStaff();
    };
  }, [toast]);

  const handleOpenBlockDialog = (user: AppUser) => {
    setCurrentUser(user);
    blockForm.reset();
    setIsBlockDialogOpen(true);
  };
  
  const handleBlockUser = async (data: BlockUserFormValues) => {
    if (!currentUser) return;
    setIsSubmitting(true);
    try {
        const userRef = doc(db, 'users', currentUser.uid);
        await updateDoc(userRef, {
            isBlocked: true,
            blockReason: data.blockReason,
            blockStarts: format(data.blockStarts, 'PPP', { locale: id }),
            blockEnds: format(data.blockEnds, 'PPP', { locale: id }),
        });
        // The onSnapshot listener will update the state automatically
        toast({ title: "Berhasil", description: `${currentUser.displayName} telah diblokir.` });
        setIsBlockDialogOpen(false);
    } catch (error) {
        console.error("Error blocking user:", error);
        toast({ variant: "destructive", title: "Gagal", description: "Gagal memblokir pengguna." });
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleUnblockUser = async (uid: string) => {
     try {
        const userRef = doc(db, 'users', uid);
        await updateDoc(userRef, {
            isBlocked: false,
            blockReason: null,
            blockStarts: null,
            blockEnds: null,
        });
        // The onSnapshot listener will update the state automatically
        toast({ title: "Berhasil", description: `Blokir telah dibuka.` });
    } catch (error) {
        console.error("Error unblocking user:", error);
        toast({ variant: "destructive", title: "Gagal", description: "Gagal membuka blokir pengguna." });
    }
  };

  const handleAddStaff = async (data: AddStaffFormValues) => {
    setIsSubmitting(true);
    try {
        await addDoc(collection(db, 'staff'), data);
        // The onSnapshot listener will update the state automatically
        toast({ title: "Berhasil", description: "Staf baru berhasil ditambahkan."});
        setIsAddStaffDialogOpen(false);
        staffForm.reset();
    } catch(error) {
        console.error("Error adding staff:", error);
        toast({ variant: "destructive", title: "Gagal", description: "Gagal menambahkan staf." });
    } finally {
        setIsSubmitting(false);
    }
  };
  
  const handleDeleteStaff = async (id: string) => {
     try {
      await deleteDoc(doc(db, 'staff', id));
      // The onSnapshot listener will update the state automatically
      toast({ title: "Berhasil", description: "Staf berhasil dihapus." });
    } catch (error) {
      toast({ variant: 'destructive', title: "Gagal Menghapus", description: "Terjadi kesalahan saat menghapus data staf." });
      console.error("Delete failed:", error);
    }
  }

  return (
    <>
    <Card>
      <CardHeader>
        <CardTitle>Manajemen Pengguna & Staf</CardTitle>
        <CardDescription>Kelola warga yang terdaftar dan staf (petugas) di aplikasi.</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="users">
          <div className="flex justify-between items-center mb-4">
            <TabsList>
              <TabsTrigger value="users">Warga</TabsTrigger>
              <TabsTrigger value="staff">Staf</TabsTrigger>
            </TabsList>
            <Button onClick={() => setIsAddStaffDialogOpen(true)}><PlusCircle className="mr-2 h-4 w-4" /> Tambah Staf</Button>
          </div>

          <TabsContent value="users">
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pengguna</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell><div className="flex items-center gap-4"><Skeleton className="h-10 w-10 rounded-full" /><Skeleton className="h-5 w-40" /></div></TableCell>
                        <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                        <TableCell className="text-right"><Skeleton className="h-10 w-10 ml-auto" /></TableCell>
                      </TableRow>
                    ))
                  ) : users.length > 0 ? (
                    users.map((user) => (
                      <TableRow key={user.uid} className={cn(user.isBlocked && "bg-destructive/10")}>
                        <TableCell>
                          <div className="flex items-center gap-4">
                            <Avatar><AvatarImage src={user.photoURL || undefined} /><AvatarFallback><UserIcon /></AvatarFallback></Avatar>
                            <div>
                              <p className="font-medium">{user.displayName || 'Tanpa Nama'}</p>
                              <p className="text-sm text-muted-foreground">{user.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {user.isBlocked ? (
                             <div className="flex flex-col">
                                <span className="font-bold text-destructive">Diblokir</span>
                                <span className="text-xs text-muted-foreground">{user.blockEnds}</span>
                              </div>
                          ): <span className="text-green-600 font-medium">Aktif</span>}
                        </TableCell>
                        <TableCell className="text-right">
                            {user.isBlocked ? (
                                <Button variant="secondary" size="sm" onClick={() => handleUnblockUser(user.uid)}>Buka Blokir</Button>
                            ) : (
                                <Button variant="outline" size="sm" onClick={() => handleOpenBlockDialog(user)}><ShieldX className="h-4 w-4 mr-2" /> Blokir</Button>
                            )}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center h-24">Belum ada warga terdaftar.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="staff">
             <div className="rounded-lg border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nama</TableHead>
                            <TableHead>No. HP</TableHead>
                            <TableHead>Kode Akses</TableHead>
                            <TableHead className="text-right">Aksi</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                         {loading ? (
                             Array.from({ length: 2 }).map((_, i) => (
                                <TableRow key={i}>
                                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                                    <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                                    <TableCell className="text-right"><Skeleton className="h-10 w-10 ml-auto" /></TableCell>
                                </TableRow>
                            ))
                         ) : staff.length > 0 ? (
                            staff.map((s) => (
                                <TableRow key={s.id}>
                                    <TableCell>{s.name}</TableCell>
                                    <TableCell>{s.phone}</TableCell>
                                    <TableCell>{s.accessCode}</TableCell>
                                    <TableCell className="text-right">
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="destructive" size="icon"><Trash className="h-4 w-4" /></Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Hapus Staf?</AlertDialogTitle>
                                                    <AlertDialogDescription>Tindakan ini akan menghapus staf secara permanen.</AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Batal</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleDeleteStaff(s.id)}>Hapus</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </TableCell>
                                </TableRow>
                            ))
                         ) : (
                             <TableRow>
                                <TableCell colSpan={4} className="h-24 text-center">Belum ada staf ditambahkan.</TableCell>
                            </TableRow>
                         )}
                    </TableBody>
                </Table>
             </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>

    <Dialog open={isBlockDialogOpen} onOpenChange={setIsBlockDialogOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Blokir Pengguna: {currentUser?.displayName}</DialogTitle>
            </DialogHeader>
            <Form {...blockForm}>
                <form onSubmit={blockForm.handleSubmit(handleBlockUser)} className="space-y-4">
                    <FormField control={blockForm.control} name="blockStarts" render={({ field }) => (
                      <FormItem className="flex flex-col"><FormLabel>Mulai Blokir</FormLabel>
                        <Popover><PopoverTrigger asChild>
                            <FormControl>
                              <Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                {field.value ? format(field.value, "PPP", { locale: id }) : <span>Pilih tanggal</span>}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                        </PopoverTrigger><PopoverContent className="w-auto p-0" align="start">
                            <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus locale={id} />
                        </PopoverContent></Popover><FormMessage />
                      </FormItem>
                    )} />
                     <FormField control={blockForm.control} name="blockEnds" render={({ field }) => (
                      <FormItem className="flex flex-col"><FormLabel>Berakhir Blokir</FormLabel>
                        <Popover><PopoverTrigger asChild>
                            <FormControl>
                              <Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                {field.value ? format(field.value, "PPP", { locale: id }) : <span>Pilih tanggal</span>}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                        </PopoverTrigger><PopoverContent className="w-auto p-0" align="start">
                            <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus locale={id} />
                        </PopoverContent></Popover><FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={blockForm.control} name="blockReason" render={({ field }) => (
                        <FormItem><FormLabel>Alasan Pemblokiran</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <p className="text-xs text-muted-foreground">Pengguna yang diblokir akan diminta menghubungi petugas untuk informasi lebih lanjut.</p>
                    <DialogFooter>
                        <DialogClose asChild><Button type="button" variant="secondary">Batal</Button></DialogClose>
                        <Button type="submit" variant="destructive" disabled={isSubmitting}>
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Blokir Pengguna
                        </Button>
                    </DialogFooter>
                </form>
            </Form>
        </DialogContent>
    </Dialog>
    
    <Dialog open={isAddStaffDialogOpen} onOpenChange={setIsAddStaffDialogOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Tambah Staf Baru</DialogTitle>
            </DialogHeader>
            <Form {...staffForm}>
                <form onSubmit={staffForm.handleSubmit(handleAddStaff)} className="space-y-4">
                    <FormField control={staffForm.control} name="name" render={({ field }) => (
                        <FormItem><FormLabel>Nama Lengkap</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                     <FormField control={staffForm.control} name="phone" render={({ field }) => (
                        <FormItem><FormLabel>Nomor HP</FormLabel><FormControl><Input type="tel" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                     <FormField control={staffForm.control} name="accessCode" render={({ field }) => (
                        <FormItem><FormLabel>Kode Akses</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <DialogFooter>
                        <DialogClose asChild><Button type="button" variant="secondary">Batal</Button></DialogClose>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Simpan Staf
                        </Button>
                    </DialogFooter>
                </form>
            </Form>
        </DialogContent>
    </Dialog>

    </>
  );
}
