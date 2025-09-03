
"use client";

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase/client';
import { collection, onSnapshot, doc, deleteDoc, query, orderBy, getDocs, updateDoc, writeBatch, where, Timestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Trash, User as UserIcon, ShieldX, PlusCircle, Loader2, Check, X, Star, Eye, EyeOff, ShieldCheck, ShieldAlert } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { AppUser, Staff } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { approveOrRejectStaff } from '@/ai/flows/approve-reject-staff';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { add } from 'date-fns';
import { cn } from '@/lib/utils';


const rejectionSchema = z.object({
    rejectionReason: z.string().min(10, 'Alasan penolakan minimal 10 karakter.'),
});
type RejectionFormValues = z.infer<typeof rejectionSchema>;

const suspensionSchema = z.object({
  reason: z.string().min(10, 'Alasan penangguhan minimal 10 karakter.'),
  duration: z.string().min(1, 'Durasi harus dipilih.'),
});
type SuspensionFormValues = z.infer<typeof suspensionSchema>;

export default function UsersAdminPage() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [pendingStaff, setPendingStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [visibleAccessCodes, setVisibleAccessCodes] = useState<Record<string, boolean>>({});
  const [visibleEmails, setVisibleEmails] = useState<Record<string, boolean>>({});

  const [isRejectionDialogOpen, setIsRejectionDialogOpen] = useState(false);
  const [selectedStaffForRejection, setSelectedStaffForRejection] = useState<Staff | null>(null);

  const [isSuspensionDialogOpen, setIsSuspensionDialogOpen] = useState(false);
  const [selectedUserForSuspension, setSelectedUserForSuspension] = useState<AppUser | Staff | null>(null);
  const [suspensionType, setSuspensionType] = useState<'user' | 'staff' | null>(null);

  const rejectionForm = useForm<RejectionFormValues>({ resolver: zodResolver(rejectionSchema) });
  const suspensionForm = useForm<SuspensionFormValues>({ resolver: zodResolver(suspensionSchema) });

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
    }, (error) => console.error("Error fetching users:", error));
    
    const unsubStaff = onSnapshot(staffQuery, (snapshot) => {
        const allStaff = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Staff[];
        setStaff(allStaff.filter(s => s.status === 'active' || s.status === 'suspended'));
        setPendingStaff(allStaff.filter(s => s.status === 'pending'));
        setLoading(false);
    }, (error) => {
        console.error("Error fetching staff:", error)
        setLoading(false);
    });
    
    return () => {
        unsubUsers();
        unsubStaff();
    };
  }, []);
  
  const handleDeleteUser = async (uid: string) => {
    try {
        await deleteDoc(doc(db, 'users', uid));
        toast({ title: "Berhasil", description: "Akun warga berhasil dihapus." });
    } catch (error) {
        toast({ variant: "destructive", title: "Gagal", description: "Gagal menghapus akun warga." });
        console.error("Error deleting user: ", error);
    }
  }


  const handleStaffApproval = async (staffMember: Staff, approved: boolean, reason?: string) => {
    setIsSubmitting(true);
    try {
        const result = await approveOrRejectStaff({
            staffId: staffMember.id,
            approved,
            rejectionReason: reason
        });

        if (result.success) {
            toast({ title: "Berhasil", description: result.message });
        } else {
            throw new Error(result.message);
        }
    } catch (error) {
        const action = approved ? "menyetujui" : "menolak";
        toast({ variant: "destructive", title: "Gagal", description: `Gagal ${action} pendaftaran. ${error instanceof Error ? error.message : ''}`});
    } finally {
        setIsSubmitting(false);
        setIsRejectionDialogOpen(false);
        setSelectedStaffForRejection(null);
    }
  };

  const openRejectionDialog = (staffMember: Staff) => {
    setSelectedStaffForRejection(staffMember);
    rejectionForm.reset();
    setIsRejectionDialogOpen(true);
  };
  
  const onRejectionSubmit = (values: RejectionFormValues) => {
    if (selectedStaffForRejection) {
      handleStaffApproval(selectedStaffForRejection, false, values.rejectionReason);
    }
  };

  const openSuspensionDialog = (user: AppUser | Staff, type: 'user' | 'staff') => {
      setSelectedUserForSuspension(user);
      setSuspensionType(type);
      suspensionForm.reset();
      setIsSuspensionDialogOpen(true);
  }

  const onSuspensionSubmit = async (values: SuspensionFormValues) => {
      if (!selectedUserForSuspension || !suspensionType) return;
      setIsSubmitting(true);

      const [count, unit] = values.duration.split('_');
      let endDate: Date | null = new Date();
      if (unit === 'permanent') {
          endDate = null;
      } else {
          endDate = add(endDate, { [unit]: parseInt(count) });
      }

      const collectionName = suspensionType === 'user' ? 'users' : 'staff';
      const docId = (selectedUserForSuspension as AppUser).uid || (selectedUserForSuspension as Staff).id;
      const userRef = doc(db, collectionName, docId);
      
      const statusField = suspensionType === 'user' ? 'isSuspended' : 'status';
      const statusValue = suspensionType === 'user' ? true : 'suspended';
      
      try {
        await updateDoc(userRef, {
            [statusField]: statusValue,
            suspensionReason: values.reason,
            suspensionEndDate: endDate ? Timestamp.fromDate(endDate) : null,
        });
        toast({ title: 'Berhasil', description: `Pengguna berhasil ditangguhkan.` });
        setIsSuspensionDialogOpen(false);
      } catch (error) {
        toast({ variant: 'destructive', title: 'Gagal', description: `Gagal menangguhkan pengguna.` });
      } finally {
        setIsSubmitting(false);
      }
  };
  
  const handleRemoveSuspension = async (user: AppUser | Staff, type: 'user' | 'staff') => {
      const collectionName = type === 'user' ? 'users' : 'staff';
      const docId = (user as AppUser).uid || (user as Staff).id;
      const userRef = doc(db, collectionName, docId);

      const statusField = type === 'user' ? 'isSuspended' : 'status';
      const statusValue = type === 'user' ? false : 'active';
      
      try {
        await updateDoc(userRef, {
            [statusField]: statusValue,
            suspensionReason: null,
            suspensionEndDate: null,
        });
        toast({ title: 'Berhasil', description: 'Penangguhan pengguna telah dicabut.' });
      } catch (error) {
         toast({ variant: 'destructive', title: 'Gagal', description: 'Gagal mencabut penangguhan.' });
      }
  };


  const handleDeleteStaff = async (id: string) => {
     try {
      await deleteDoc(doc(db, 'staff', id));
      toast({ title: "Berhasil", description: "Staf berhasil dihapus." });
    } catch (error) {
      toast({ variant: 'destructive', title: "Gagal Menghapus", description: "Terjadi kesalahan saat menghapus data staf." });
      console.error("Delete failed:", error);
    }
  }
  
  const toggleVisibility = (
    id: string,
    type: 'accessCode' | 'email'
  ) => {
    if (type === 'accessCode') {
      setVisibleAccessCodes(prev => ({ ...prev, [id]: !prev[id] }));
    } else {
      setVisibleEmails(prev => ({ ...prev, [id]: !prev[id] }));
    }
  };

  const handleToggleBlockUser = async (uid: string, isBlocked: boolean) => {
      const userRef = doc(db, 'users', uid);
      try {
        await updateDoc(userRef, { isBlocked: !isBlocked });
        toast({ title: "Berhasil", description: `Status blokir pengguna telah diperbarui.` });
      } catch (error) {
        toast({ variant: 'destructive', title: "Gagal", description: "Gagal memperbarui status pengguna." });
      }
  };

  const getUserStatus = (user: AppUser) => {
    if (user.isBlocked) return { text: 'Diblokir', className: 'bg-red-100 text-red-800' };
    if (user.isSuspended) return { text: 'Ditangguhkan', className: 'bg-yellow-100 text-yellow-800' };
    return { text: 'Aktif', className: 'bg-green-100 text-green-800' };
  }

  return (
    <>
    <Card>
      <CardHeader>
        <CardTitle>Manajemen Pengguna</CardTitle>
        <CardDescription>Kelola warga yang terdaftar dan staf (petugas) di aplikasi.</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="users">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="users">Warga</TabsTrigger>
            <TabsTrigger value="staff">Staf Aktif</TabsTrigger>
            <TabsTrigger value="pending-staff">
                Persetujuan Staf {pendingStaff.length > 0 && <Badge className="ml-2">{pendingStaff.length}</Badge>}
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="users" className="mt-4">
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pengguna</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell><div className="flex items-center gap-4"><Skeleton className="h-10 w-10 rounded-full" /><Skeleton className="h-5 w-40" /></div></TableCell>
                        <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                        <TableCell className="text-right"><Skeleton className="h-10 w-20 ml-auto" /></TableCell>
                      </TableRow>
                    ))
                  ) : users.length > 0 ? (
                    users.map((user) => (
                      <TableRow key={user.uid}>
                        <TableCell>
                          <div className="flex items-center gap-4">
                            <Avatar><AvatarImage src={user.photoURL || undefined} /><AvatarFallback>{user.displayName?.charAt(0).toUpperCase()}</AvatarFallback></Avatar>
                            <div>
                              <p className="font-medium">{user.displayName || 'Tanpa Nama'}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          <Badge variant={'secondary'} className={getUserStatus(user).className}>
                              {getUserStatus(user).text}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                            <div className="flex gap-2 justify-end">
                               {user.isSuspended ? (
                                    <Button variant="outline" size="icon" onClick={() => handleRemoveSuspension(user, 'user')}>
                                      <ShieldCheck className="h-4 w-4" />
                                    </Button>
                                ) : (
                                    <Button variant="outline" size="icon" onClick={() => openSuspensionDialog(user, 'user')}>
                                      <ShieldAlert className="h-4 w-4" />
                                    </Button>
                                )}
                                <Button variant="outline" size="sm" onClick={() => handleToggleBlockUser(user.uid, !!user.isBlocked)}>
                                    {user.isBlocked ? <ShieldCheck className="h-4 w-4" /> : <ShieldX className="h-4 w-4" />}
                                    <span className="ml-2 hidden sm:inline">{user.isBlocked ? 'Buka Blokir' : 'Blokir'}</span>
                                </Button>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="destructive" size="icon"><Trash className="h-4 w-4" /></Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent className="rounded-lg">
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Hapus Warga?</AlertDialogTitle>
                                            <AlertDialogDescription>Tindakan ini akan menghapus akun warga secara permanen dan tidak dapat dibatalkan.</AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Batal</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => handleDeleteUser(user.uid)}>Hapus Akun</AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center h-24">Belum ada warga terdaftar.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="staff" className="mt-4">
             <div className="rounded-lg border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nama</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Poin</TableHead>
                            <TableHead>Kode Akses</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Aksi</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                         {loading ? (
                             Array.from({ length: 2 }).map((_, i) => (
                                <TableRow key={i}>
                                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                                    <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                                    <TableCell><Skeleton className="h-5 w-12" /></TableCell>
                                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                                    <TableCell className="text-right"><Skeleton className="h-10 w-10 ml-auto" /></TableCell>
                                </TableRow>
                            ))
                         ) : staff.length > 0 ? (
                            staff.map((s) => (
                                <TableRow key={s.id}>
                                    <TableCell>{s.name}</TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            {visibleEmails[s.id] ? s.email : '*****'}
                                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleVisibility(s.id, 'email')}>
                                                {visibleEmails[s.id] ? <EyeOff className="h-4 w-4"/> : <Eye className="h-4 w-4"/>}
                                            </Button>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center font-bold">
                                            <Star className="h-4 w-4 mr-1 text-yellow-500 fill-yellow-400" />
                                            {s.points || 0}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            {visibleAccessCodes[s.id] ? (
                                                <span className="font-mono">{s.accessCode}</span>
                                            ) : (
                                                <span className="font-mono">*****</span>
                                            )}
                                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleVisibility(s.id, 'accessCode')}>
                                                {visibleAccessCodes[s.id] ? <EyeOff className="h-4 w-4"/> : <Eye className="h-4 w-4"/>}
                                            </Button>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={s.status === 'active' ? 'secondary' : 'default'} className={cn(s.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800')}>
                                          {s.status === 'active' ? 'Aktif' : 'Ditangguhkan'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                       <div className="flex gap-2 justify-end">
                                          {s.status === 'suspended' ? (
                                              <Button variant="outline" size="icon" onClick={() => handleRemoveSuspension(s, 'staff')}>
                                                <ShieldCheck className="h-4 w-4" />
                                              </Button>
                                          ) : (
                                              <Button variant="outline" size="icon" onClick={() => openSuspensionDialog(s, 'staff')}>
                                                <ShieldAlert className="h-4 w-4" />
                                              </Button>
                                          )}
                                          <AlertDialog>
                                              <AlertDialogTrigger asChild>
                                                  <Button variant="destructive" size="icon"><Trash className="h-4 w-4" /></Button>
                                              </AlertDialogTrigger>
                                              <AlertDialogContent className="rounded-lg">
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
                                       </div>
                                    </TableCell>
                                </TableRow>
                            ))
                         ) : (
                             <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center">Belum ada staf aktif.</TableCell>
                            </TableRow>
                         )}
                    </TableBody>
                </Table>
             </div>
          </TabsContent>

          <TabsContent value="pending-staff" className="mt-4">
             <div className="rounded-lg border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nama</TableHead>
                            <TableHead>Email & HP</TableHead>
                            <TableHead>Alamat</TableHead>
                            <TableHead className="text-right">Aksi</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                         {loading ? (
                             Array.from({ length: 1 }).map((_, i) => (
                                <TableRow key={i}>
                                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                                    <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                                    <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                                    <TableCell className="text-right"><Skeleton className="h-10 w-24 ml-auto" /></TableCell>
                                </TableRow>
                            ))
                         ) : pendingStaff.length > 0 ? (
                            pendingStaff.map((s) => (
                                <TableRow key={s.id}>
                                    <TableCell>{s.name}</TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span>{s.email}</span>
                                            <span className="text-xs text-muted-foreground">{s.phone}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>{s.addressDetail}</TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex gap-2 justify-end">
                                            <Button size="icon" className="bg-green-500 hover:bg-green-600" onClick={() => handleStaffApproval(s, true)} disabled={isSubmitting}>
                                                <Check className="h-4 w-4" />
                                            </Button>
                                            <Button size="icon" variant="destructive" onClick={() => openRejectionDialog(s)} disabled={isSubmitting}>
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                         ) : (
                             <TableRow>
                                <TableCell colSpan={4} className="h-24 text-center">Tidak ada pendaftaran staf yang tertunda.</TableCell>
                            </TableRow>
                         )}
                    </TableBody>
                </Table>
             </div>
          </TabsContent>

        </Tabs>
      </CardContent>
    </Card>

    <Dialog open={isRejectionDialogOpen} onOpenChange={setIsRejectionDialogOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Tolak Pendaftaran Staf</DialogTitle>
                <DialogDescription>
                    Tulis alasan penolakan. Pesan ini akan dikirimkan ke email pendaftar.
                </DialogDescription>
            </DialogHeader>
            <Form {...rejectionForm}>
                <form onSubmit={rejectionForm.handleSubmit(onRejectionSubmit)} className="space-y-4">
                    <div className="py-4">
                        <FormField
                            control={rejectionForm.control}
                            name="rejectionReason"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Alasan Penolakan</FormLabel>
                                    <FormControl>
                                        <Textarea {...field} rows={4} placeholder="Contoh: Maaf, saat ini kami belum membuka lowongan untuk area Anda." />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button type="button" variant="secondary">Batal</Button>
                        </DialogClose>
                        <Button type="submit" variant="destructive" disabled={isSubmitting}>
                             {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Kirim Penolakan
                        </Button>
                    </DialogFooter>
                </form>
            </Form>
        </DialogContent>
    </Dialog>

    <Dialog open={isSuspensionDialogOpen} onOpenChange={setIsSuspensionDialogOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Tangguhkan Pengguna</DialogTitle>
                <DialogDescription>
                  Pengguna yang ditangguhkan tidak akan bisa masuk ke aplikasi untuk sementara waktu.
                </DialogDescription>
            </DialogHeader>
             <Form {...suspensionForm}>
                <form onSubmit={suspensionForm.handleSubmit(onSuspensionSubmit)} className="space-y-4 pt-4">
                    <FormField
                      control={suspensionForm.control}
                      name="reason"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Alasan Penangguhan</FormLabel>
                          <FormControl>
                            <Textarea {...field} rows={3} placeholder="Contoh: Melanggar aturan komunitas..." />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={suspensionForm.control}
                      name="duration"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Durasi Penangguhan</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger><SelectValue placeholder="Pilih durasi..." /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="7_days">7 Hari</SelectItem>
                              <SelectItem value="14_days">14 Hari</SelectItem>
                              <SelectItem value="1_months">1 Bulan</SelectItem>
                              <SelectItem value="0_permanent">Permanen</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <DialogFooter>
                        <Button type="button" variant="secondary" onClick={() => setIsSuspensionDialogOpen(false)}>Batal</Button>
                        <Button type="submit" variant="destructive" disabled={isSubmitting}>
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Tangguhkan
                        </Button>
                    </DialogFooter>
                </form>
            </Form>
        </DialogContent>
    </Dialog>
    </>
  );
}
