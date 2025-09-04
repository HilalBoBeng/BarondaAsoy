
"use client";

import { useState, useEffect, useMemo } from 'react';
import { db } from '@/lib/firebase/client';
import { collection, onSnapshot, doc, deleteDoc, query, orderBy, getDocs, updateDoc, writeBatch, where, Timestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Trash, User as UserIcon, ShieldX, PlusCircle, Loader2, Check, X, Star, Eye, EyeOff, ShieldCheck, ShieldAlert, MoreVertical, Phone, Mail, MapPin, KeyRound, Calendar } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { AppUser, Staff } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { approveOrRejectStaff } from '@/ai/flows/approve-reject-staff';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose, DialogBody } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { add } from 'date-fns';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNow } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

const toTitleCase = (str: string) => {
  return str.replace(
    /\w\S*/g,
    (txt) => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase()
  );
};

const rejectionSchema = z.object({
    rejectionReason: z.string().min(10, 'Alasan penolakan minimal 10 karakter.'),
});
type RejectionFormValues = z.infer<typeof rejectionSchema>;

const actionReasonSchema = z.object({
  reason: z.string().min(10, 'Alasan minimal 10 karakter.'),
  duration: z.string().optional(),
});
type ActionReasonFormValues = z.infer<typeof actionReasonSchema>;


export default function UsersAdminPage() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [pendingStaff, setPendingStaff] = useState<Staff[]>([]);
  const [admins, setAdmins] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isActionDialogOpen, setIsActionDialogOpen] = useState(false);
  const [selectedUserForAction, setSelectedUserForAction] = useState<AppUser | Staff | null>(null);
  const [actionType, setActionType] = useState<'suspend' | 'block' | 'delete' | 'approve' | 'reject' | 'addAdmin' | null>(null);

  const actionReasonForm = useForm<ActionReasonFormValues>({ resolver: zodResolver(actionReasonSchema) });
  
  const [isUserDetailOpen, setIsUserDetailOpen] = useState(false);
  const [selectedUserForDetail, setSelectedUserForDetail] = useState<AppUser | Staff | null>(null);
  const [isZoomModalOpen, setIsZoomModalOpen] = useState(false);
  const [zoomedImageUrl, setZoomedImageUrl] = useState('');
  const [currentAdmin, setCurrentAdmin] = useState<Staff | null>(null);


  useEffect(() => {
    setLoading(true);
    const usersQuery = query(collection(db, "users"), orderBy("createdAt", "desc"));
    const staffQuery = query(collection(db, "staff"), orderBy("createdAt", "desc"));
    
    const info = JSON.parse(localStorage.getItem('staffInfo') || '{}');
    if (info) {
        setCurrentAdmin(info);
    }

    const unsubUsers = onSnapshot(usersQuery, (snapshot) => {
        const usersData = snapshot.docs.map(doc => ({
            uid: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate() || new Date()
        })) as AppUser[];
        setUsers(usersData);
    }, (error) => console.error("Error fetching users:", error));
    
    const unsubStaff = onSnapshot(staffQuery, (snapshot) => {
        const allStaff = snapshot.docs.map(doc => ({ 
            id: doc.id, 
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate() || new Date()
        })) as Staff[];
        
        const activeStaff = allStaff.filter(s => s.status === 'active' || s.status === 'suspended');
        const regularStaff = activeStaff.filter(s => s.role !== 'admin');
        const adminUsers = allStaff.filter(s => s.role === 'admin');
        
        setStaff(regularStaff);
        setAdmins(adminUsers);
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
        setIsActionDialogOpen(false);
    }
  };

  const openActionDialog = (user: AppUser | Staff, type: 'suspend' | 'block' | 'delete' | 'approve' | 'reject') => {
      setSelectedUserForAction(user);
      setActionType(type);
      actionReasonForm.reset();
      setIsActionDialogOpen(true);
  }

  const onActionSubmit = async (values: ActionReasonFormValues) => {
    if (!selectedUserForAction || !actionType) return;
    setIsSubmitting(true);

    const isUserType = 'uid' in selectedUserForAction;
    const collectionName = isUserType ? 'users' : 'staff';
    const docId = isUserType ? selectedUserForAction.uid : selectedUserForAction.id;
    const userRef = doc(db, collectionName, docId);

    try {
        if (actionType === 'delete') {
            await deleteDoc(userRef);
            toast({ title: 'Berhasil', description: `Data pengguna berhasil dihapus.` });
        } else if (actionType === 'approve' && !isUserType) {
            handleStaffApproval(selectedUserForAction as Staff, true);
        } else if (actionType === 'reject' && !isUserType) {
            handleStaffApproval(selectedUserForAction as Staff, false, values.reason);
        } else {
            let updateData: any = { suspensionReason: values.reason };
            if (actionType === 'suspend') {
                if (!values.duration) {
                    toast({ variant: 'destructive', title: 'Gagal', description: 'Durasi penangguhan harus dipilih.' });
                    setIsSubmitting(false);
                    return;
                }
                const [count, unit] = values.duration.split('_');
                let endDate: Date | null = new Date();
                if (unit === 'permanent') {
                    endDate = null;
                } else {
                    endDate = add(endDate, { [unit]: parseInt(count) });
                }
                updateData.suspensionEndDate = endDate ? Timestamp.fromDate(endDate) : null;
                updateData[isUserType ? 'isSuspended' : 'status'] = isUserType ? true : 'suspended';
                updateData.isBlocked = false;
            } else if (actionType === 'block') {
                updateData.isBlocked = true;
                updateData.isSuspended = false;
                updateData.suspensionEndDate = null;
            }
            await updateDoc(userRef, updateData);
            toast({ title: 'Berhasil', description: `Pengguna berhasil di${actionType === 'suspend' ? 'tangguhkan' : 'blokir'}.` });
        }
        setIsActionDialogOpen(false);
        if (isUserDetailOpen) setIsUserDetailOpen(false);
    } catch (error) {
        toast({ variant: 'destructive', title: 'Gagal', description: `Gagal melakukan tindakan.` });
    } finally {
        setIsSubmitting(false);
    }
};

  const handleRemoveRestriction = async (user: AppUser | Staff) => {
      const isUserType = 'uid' in user;
      const collectionName = isUserType ? 'users' : 'staff';
      const docId = isUserType ? user.uid : user.id;
      const userRef = doc(db, collectionName, docId);
      const statusField = isUserType ? 'isSuspended' : 'status';
      const statusValue = isUserType ? false : 'active';
      
      try {
        await updateDoc(userRef, {
            [statusField]: statusValue,
            isBlocked: false,
            suspensionReason: null,
            suspensionEndDate: null,
        });
        toast({ title: 'Berhasil', description: 'Batasan pengguna telah dicabut.' });
        if (isUserDetailOpen) setIsUserDetailOpen(false); // Close detail view on success
      } catch (error) {
         toast({ variant: 'destructive', title: 'Gagal', description: 'Gagal mencabut batasan.' });
      }
  };
  
  const getUserStatus = (user: AppUser) => {
    if (user.isBlocked) return { text: 'Diblokir', className: 'bg-red-100 text-red-800' };
    if (user.isSuspended) return { text: 'Ditangguhkan', className: 'bg-yellow-100 text-yellow-800' };
    return { text: 'Aktif', className: 'bg-green-100 text-green-800' };
  }

  const getStaffStatus = (staff: Staff) => {
    if ((staff as any).role === 'admin') return { text: 'Admin', className: 'bg-primary/20 text-primary' };
    if (staff.status === 'suspended') return { text: 'Ditangguhkan', className: 'bg-yellow-100 text-yellow-800' };
    if (staff.status === 'pending') return { text: 'Pending', className: 'bg-blue-100 text-blue-800' };
    return { text: 'Aktif', className: 'bg-green-100 text-green-800' };
  };
  
  const showUserDetail = (user: AppUser | Staff) => {
      setSelectedUserForDetail(user);
      setIsUserDetailOpen(true);
  }

  const handleImageZoom = (url?: string | null) => {
    if (url) {
        setZoomedImageUrl(url);
        setIsZoomModalOpen(true);
    }
  };
  
  const filteredUsers = useMemo(() => 
    users.filter(u => u.displayName?.toLowerCase().includes(searchTerm.toLowerCase())),
  [users, searchTerm]);

  const filteredStaff = useMemo(() =>
    staff.filter(s => s.name?.toLowerCase().includes(searchTerm.toLowerCase())),
  [staff, searchTerm]);

  const filteredPendingStaff = useMemo(() =>
    pendingStaff.filter(s => s.name?.toLowerCase().includes(searchTerm.toLowerCase())),
  [pendingStaff, searchTerm]);
  
  const filteredAdmins = useMemo(() =>
    admins.filter(a => a.name?.toLowerCase().includes(searchTerm.toLowerCase())),
  [admins, searchTerm]);

  return (
    <>
    <Card>
      <CardHeader>
        <CardTitle>Manajemen Pengguna</CardTitle>
        <CardDescription>Kelola warga yang terdaftar dan staf (petugas) di aplikasi.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari berdasarkan nama..."
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
        </div>
        <Tabs defaultValue="users">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="users">Warga</TabsTrigger>
            <TabsTrigger value="staff">Staf & Admin</TabsTrigger>
            <TabsTrigger value="pending-staff">
                Persetujuan Staf {pendingStaff.length > 0 && <Badge className="ml-2">{pendingStaff.length}</Badge>}
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="users" className="mt-4">
            <div className="rounded-lg border overflow-x-auto">
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
                        <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                        <TableCell className="text-right"><Skeleton className="h-10 w-10 ml-auto rounded-md" /></TableCell>
                      </TableRow>
                    ))
                  ) : filteredUsers.length > 0 ? (
                    filteredUsers.map((user) => (
                      <TableRow key={user.uid}>
                        <TableCell>
                          <div className="flex items-center gap-4">
                            <Avatar><AvatarImage src={user.photoURL || undefined} /><AvatarFallback>{user.displayName?.charAt(0).toUpperCase()}</AvatarFallback></Avatar>
                            <p className="font-medium">{user.displayName || 'Tanpa Nama'}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={'secondary'} className={getUserStatus(user).className}>
                              {getUserStatus(user).text}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                           <Button variant="ghost" size="icon" onClick={() => showUserDetail(user)}>
                              <MoreVertical className="h-4 w-4" />
                           </Button>
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

          <TabsContent value="staff" className="mt-4">
             <div className="rounded-lg border overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nama</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Aksi</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                         {loading ? (
                             Array.from({ length: 2 }).map((_, i) => (
                                <TableRow key={i}>
                                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                                    <TableCell className="text-right"><Skeleton className="h-10 w-10 ml-auto" /></TableCell>
                                </TableRow>
                            ))
                         ) : [...filteredAdmins, ...filteredStaff].length > 0 ? (
                            [...filteredAdmins, ...filteredStaff].map((s) => (
                                <TableRow key={s.id}>
                                    <TableCell>{s.name}</TableCell>
                                    <TableCell>
                                        <Badge variant={'secondary'} className={getStaffStatus(s).className}>
                                          {getStaffStatus(s).text}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                       <Button variant="ghost" size="icon" onClick={() => showUserDetail(s)}>
                                          <MoreVertical className="h-4 w-4" />
                                      </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                         ) : (
                             <TableRow>
                                <TableCell colSpan={3} className="h-24 text-center">Belum ada staf aktif.</TableCell>
                            </TableRow>
                         )}
                    </TableBody>
                </Table>
             </div>
          </TabsContent>

          <TabsContent value="pending-staff" className="mt-4">
             <div className="rounded-lg border overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nama</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Aksi</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                         {loading ? (
                             Array.from({ length: 1 }).map((_, i) => (
                                <TableRow key={i}>
                                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                                    <TableCell className="text-right"><Skeleton className="h-10 w-10 ml-auto" /></TableCell>
                                </TableRow>
                            ))
                         ) : filteredPendingStaff.length > 0 ? (
                            filteredPendingStaff.map((s) => (
                                <TableRow key={s.id}>
                                    <TableCell>{s.name}</TableCell>
                                    <TableCell>
                                      <Badge variant={'secondary'} className={getStaffStatus(s).className}>
                                        {getStaffStatus(s).text}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="icon" onClick={() => showUserDetail(s)}>
                                          <MoreVertical className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                         ) : (
                             <TableRow>
                                <TableCell colSpan={3} className="h-24 text-center">Tidak ada pendaftaran staf yang tertunda.</TableCell>
                            </TableRow>
                         )}
                    </TableBody>
                </Table>
             </div>
          </TabsContent>

        </Tabs>
      </CardContent>
    </Card>

    <Dialog open={isUserDetailOpen} onOpenChange={setIsUserDetailOpen}>
      <DialogContent className="p-0 border-0 max-w-sm">
       <DialogTitle className="sr-only">Detail Pengguna</DialogTitle>
          {selectedUserForDetail && (
              <Card className="border-0 shadow-none">
                  <CardContent className="p-6 text-center">
                      <button onClick={() => handleImageZoom('uid' in selectedUserForDetail ? selectedUserForDetail.photoURL : undefined)} className="mx-auto">
                          <Avatar className="h-24 w-24 border-4 border-muted">
                              <AvatarImage src={'uid' in selectedUserForDetail ? selectedUserForDetail.photoURL : undefined} />
                              <AvatarFallback className="text-4xl">
                                  {('displayName' in selectedUserForDetail ? selectedUserForDetail.displayName?.charAt(0) : selectedUserForDetail.name.charAt(0))?.toUpperCase()}
                              </AvatarFallback>
                          </Avatar>
                      </button>
                      <h2 className="text-xl font-bold mt-2">
                          {'displayName' in selectedUserForDetail ? selectedUserForDetail.displayName : selectedUserForDetail.name}
                      </h2>
                      <p className="text-sm text-muted-foreground">{selectedUserForDetail.email}</p>
                      <div className="space-y-3 text-sm text-left border-t mt-4 pt-4">
                          <div className="flex items-start gap-3"><Phone className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0"/> <span>{selectedUserForDetail.phone || 'Tidak ada no. HP'}</span></div>
                          <div className="flex items-start gap-3"><MapPin className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0"/> <span>{'addressDetail' in selectedUserForDetail ? (selectedUserForDetail.addressType === 'kilongan' ? 'Kilongan' : selectedUserForDetail.addressDetail) : 'Alamat tidak tersedia'}</span></div>
                           {'points' in selectedUserForDetail && (
                              <div className="flex items-start gap-3"><Star className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0"/> <span>{selectedUserForDetail.points || 0} Poin</span></div>
                          )}
                          {'createdAt' in selectedUserForDetail && selectedUserForDetail.createdAt && (
                             <div className="flex items-start gap-3"><Calendar className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0"/> <span>Bergabung sejak {format(selectedUserForDetail.createdAt as Date, "d MMMM yyyy", { locale: localeId })}</span></div>
                          )}
                      </div>
                  </CardContent>
                  <CardFooter className="flex-col sm:flex-col sm:space-x-0 gap-2 items-stretch pt-4 border-t bg-muted/50 p-6">
                      {'status' in selectedUserForDetail && selectedUserForDetail.status === 'pending' ? (
                          <div className="flex gap-2">
                              <Button variant="destructive" className="flex-1" onClick={() => openActionDialog(selectedUserForDetail, 'reject')}>Tolak</Button>
                              <Button className="bg-green-600 hover:bg-green-700 flex-1" onClick={() => openActionDialog(selectedUserForDetail, 'approve')}>Setujui</Button>
                          </div>
                      ) : (
                          <>
                              <div className="flex gap-2 justify-end">
                                  {('isBlocked' in selectedUserForDetail && (selectedUserForDetail.isBlocked || selectedUserForDetail.isSuspended)) || ('status' in selectedUserForDetail && selectedUserForDetail.status === 'suspended') ? (
                                      <Button variant="outline" onClick={() => handleRemoveRestriction(selectedUserForDetail)} className="text-green-600 border-green-600 hover:bg-green-50 hover:text-green-700">
                                          <ShieldCheck className="mr-2 h-4 w-4" /> Cabut Batasan
                                      </Button>
                                  ) : (
                                      <>
                                          <Button variant="outline" className="border-yellow-500 text-yellow-600 hover:bg-yellow-50 hover:text-yellow-700" onClick={() => openActionDialog(selectedUserForDetail, 'suspend')} disabled={(selectedUserForDetail as Staff)?.role === 'admin'}>
                                            <ShieldAlert className="mr-2 h-4 w-4"/> Tangguhkan
                                          </Button>
                                          <Button variant="outline" className="border-destructive text-destructive hover:bg-destructive/10" onClick={() => openActionDialog(selectedUserForDetail, 'block')} disabled={(selectedUserForDetail as Staff)?.role === 'admin'}>
                                            <ShieldX className="mr-2 h-4 w-4"/> Blokir
                                          </Button>
                                      </>
                                  )}
                              </div>
                              <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                      <Button variant="outline" className="w-full mt-2 text-destructive border-destructive/50 hover:bg-destructive/10" disabled={(selectedUserForDetail as Staff)?.id === currentAdmin?.id}>
                                        <Trash className="mr-2 h-4 w-4"/> Hapus Akun Ini
                                      </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                      <AlertDialogHeader>
                                          <AlertDialogTitle>Hapus Pengguna Ini?</AlertDialogTitle>
                                          <AlertDialogDescription>Tindakan ini tidak dapat dibatalkan. Semua data terkait pengguna ini akan dihapus.</AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                          <AlertDialogCancel>Batal</AlertDialogCancel>
                                          <AlertDialogAction onClick={() => openActionDialog(selectedUserForDetail, 'delete')}>Ya, Hapus</AlertDialogAction>
                                      </AlertDialogFooter>
                                  </AlertDialogContent>
                              </AlertDialog>
                          </>
                      )}
                  </CardFooter>
              </Card>
          )}
      </DialogContent>
    </Dialog>

    
    <Dialog open={isActionDialogOpen} onOpenChange={setIsActionDialogOpen}>
        <DialogContent>
            <DialogHeader>
                 <DialogTitle>
                    {actionType === 'block' ? 'Blokir' :
                     actionType === 'suspend' ? 'Tangguhkan' :
                     actionType === 'reject' ? 'Tolak Pendaftaran' :
                     actionType === 'approve' ? 'Setujui Pendaftaran' :
                     'Hapus'} Pengguna
                </DialogTitle>
                <DialogDescription>
                  {actionType === 'delete' ? 'Tindakan ini akan menghapus akun secara permanen. Mohon jelaskan alasannya.' :
                   actionType === 'approve' ? 'Anda yakin ingin menyetujui pendaftaran staf ini? Mereka akan mendapatkan email notifikasi berisi kode akses.' :
                   actionType === 'reject' ? 'Tuliskan alasan penolakan untuk dikirimkan ke email pendaftar.' :
                   `Pengguna yang di${actionType === 'block' ? 'blokir' : 'tangguhkan'} tidak akan bisa masuk ke aplikasi. Mohon jelaskan alasannya.`
                  }
                </DialogDescription>
            </DialogHeader>
             <Form {...actionReasonForm}>
                <form onSubmit={actionReasonForm.handleSubmit(onActionSubmit)}>
                    <DialogBody className="space-y-4">
                        { (actionType !== 'approve') &&
                        <FormField
                        control={actionReasonForm.control}
                        name="reason"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Alasan</FormLabel>
                            <FormControl>
                                <Textarea {...field} rows={3} placeholder="Jelaskan alasan tindakan Anda..." />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                        }
                        {actionType === 'suspend' && (
                            <FormField
                            control={actionReasonForm.control}
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
                        )}
                    </DialogBody>
                    <DialogFooter>
                        <Button type="button" variant="secondary" onClick={() => setIsActionDialogOpen(false)}>Batal</Button>
                        <Button type="submit" variant={actionType === 'approve' ? 'default' : 'destructive'} disabled={isSubmitting}>
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                             {actionType === 'block' ? 'Blokir Pengguna' :
                              actionType === 'suspend' ? 'Tangguhkan' :
                              actionType === 'reject' ? 'Tolak Pendaftaran' :
                              actionType === 'approve' ? 'Ya, Setujui' :
                              'Hapus Permanen'}
                        </Button>
                    </DialogFooter>
                </form>
            </Form>
        </DialogContent>
    </Dialog>
    
    <Dialog open={isZoomModalOpen} onOpenChange={setIsZoomModalOpen}>
        <DialogContent className="p-0 border-0 bg-transparent shadow-none max-w-lg">
            <DialogTitle className="sr-only">Zoomed Profile Photo</DialogTitle>
            <img src={zoomedImageUrl} alt="Zoomed profile" className="w-full h-auto rounded-lg" />
        </DialogContent>
    </Dialog>
    </>
  );
}

    