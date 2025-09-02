
"use client";

import { useState, useEffect, useMemo } from 'react';
import { db } from '@/lib/firebase/client';
import { collection, onSnapshot, query, where, getDocs, addDoc, serverTimestamp, doc, Timestamp, deleteDoc, updateDoc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import type { DuesPayment, AppUser } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Bell, Loader2, Search, PlusCircle, Edit, Trash, MessageSquareWarning } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import Link from 'next/link';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

const months = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];
const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, i) => (currentYear - 2 + i).toString());

const editDuesSchema = z.object({
  amount: z.coerce.number().min(1, "Jumlah iuran tidak boleh kosong."),
  notes: z.string().optional(),
});
type EditDuesFormValues = z.infer<typeof editDuesSchema>;

export default function DuesPetugasPage() {
  const [payments, setPayments] = useState<DuesPayment[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMonth, setSelectedMonth] = useState<string>(months[new Date().getMonth()]);
  const [selectedYear, setSelectedYear] = useState<string>(currentYear.toString());
  const [selectedUser, setSelectedUser] = useState<AppUser | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isSendingReminder, setIsSendingReminder] = useState<string | null>(null);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'paid' | 'unpaid'>('all');
  
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [currentDue, setCurrentDue] = useState<DuesPayment | null>(null);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  const { toast } = useToast();
  const editForm = useForm<EditDuesFormValues>();


  useEffect(() => {
    setLoading(true);
    const usersQuery = query(collection(db, 'users'));
    const paymentsQuery = query(collection(db, 'dues'));

    const unsubUsers = onSnapshot(usersQuery, (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() })) as AppUser[];
      setUsers(usersData);
    });

    const unsubPayments = onSnapshot(paymentsQuery, (snapshot) => {
      const paymentsData = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
              id: doc.id, 
              ...data,
              paymentDate: data.paymentDate instanceof Timestamp ? data.paymentDate.toDate() : new Date()
          }
      }) as DuesPayment[];
      setPayments(paymentsData);
    });

    Promise.all([getDocs(usersQuery), getDocs(paymentsQuery)]).then(() => {
      setLoading(false);
    });

    return () => {
      unsubUsers();
      unsubPayments();
    };
  }, []);

  const usersWithPaymentStatus = useMemo(() => {
    return users
      .map(user => {
        const hasPaid = payments.some(
          p => p.userId === user.uid && p.month === selectedMonth && p.year.toString() === selectedYear
        );
        return {
          ...user,
          paymentStatus: hasPaid ? 'Lunas' : 'Belum Bayar'
        };
      });
  }, [users, payments, selectedMonth, selectedYear]);

  const filteredUsers = useMemo(() => {
      let filtered = usersWithPaymentStatus;

      if(filterStatus === 'paid') {
          filtered = filtered.filter(u => u.paymentStatus === 'Lunas');
      } else if (filterStatus === 'unpaid') {
          filtered = filtered.filter(u => u.paymentStatus === 'Belum Bayar');
      }

      return filtered
        .filter(user => user.displayName?.toLowerCase().includes(searchTerm.toLowerCase()))
        .sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''));

  }, [usersWithPaymentStatus, filterStatus, searchTerm]);

  const unpaidUsers = useMemo(() => {
    return usersWithPaymentStatus.filter(u => u.paymentStatus === 'Belum Bayar');
  }, [usersWithPaymentStatus]);


  const handleSendReminder = async (user: AppUser) => {
    setIsSendingReminder(user.uid);
    try {
        await addDoc(collection(db, 'notifications'), {
            userId: user.uid,
            title: `Pengingat Iuran ${selectedMonth} ${selectedYear}`,
            message: `Dengan hormat, kami ingin mengingatkan mengenai pembayaran iuran keamanan untuk bulan ${selectedMonth} ${selectedYear}. Mohon untuk segera melakukan pembayaran. Terima kasih atas perhatian dan kerja sama Anda.`,
            read: false,
            createdAt: serverTimestamp(),
            link: '/profile',
        });
        toast({ title: "Berhasil", description: `Pengingat iuran berhasil dikirim ke ${user.displayName}.` });
    } catch(error) {
        toast({ variant: 'destructive', title: "Gagal", description: "Gagal mengirim pengingat."});
    } finally {
        setIsSendingReminder(null);
    }
  }

  const handleBroadcastReminders = async () => {
    setIsBroadcasting(true);
    
    if (unpaidUsers.length === 0) {
        toast({ variant: 'destructive', title: 'Tidak Ada Tindakan', description: 'Tidak ada warga yang belum membayar pada periode ini.' });
        setIsBroadcasting(false);
        return;
    }
    try {
        for (const user of unpaidUsers) {
            await addDoc(collection(db, 'notifications'), {
                userId: user.uid,
                title: `Pengingat Iuran ${selectedMonth} ${selectedYear}`,
                message: `Dengan hormat, kami ingin mengingatkan mengenai pembayaran iuran keamanan untuk bulan ${selectedMonth} ${selectedYear}. Mohon untuk segera melakukan pembayaran. Terima kasih atas perhatian dan kerja sama Anda.`,
                read: false,
                createdAt: serverTimestamp(),
                link: '/profile',
            });
        }
        toast({ title: "Berhasil", description: `Pengingat iuran berhasil dikirim ke ${unpaidUsers.length} warga.` });
    } catch (error) {
        toast({ variant: 'destructive', title: "Gagal", description: "Gagal mengirim pengingat massal." });
    } finally {
        setIsBroadcasting(false);
    }
  };

  const userPaymentHistory = useMemo(() => {
    if (!selectedUser) return [];
    return payments
      .filter(p => p.userId === selectedUser.uid)
      .sort((a, b) => b.paymentDate.getTime() - a.paymentDate.getTime());
  }, [payments, selectedUser]);
  
  const handleViewHistory = (user: AppUser) => {
    setSelectedUser(user);
    setIsHistoryOpen(true);
  }
  
  const handleOpenEditDialog = (due: DuesPayment) => {
    setCurrentDue(due);
    editForm.reset({
        amount: due.amount,
        notes: due.notes,
    });
    setIsEditDialogOpen(true);
  };

  const handleEditSubmit = async (values: EditDuesFormValues) => {
      if (!currentDue) return;
      setIsSubmittingEdit(true);
      try {
          const dueRef = doc(db, 'dues', currentDue.id);
          await updateDoc(dueRef, {
              amount: values.amount,
              notes: values.notes || '',
          });
          toast({ title: "Berhasil", description: "Data iuran berhasil diperbarui." });
          // Refresh local data
          setPayments(prev => prev.map(p => p.id === currentDue.id ? {...p, ...values} : p));
          setIsEditDialogOpen(false);
          setCurrentDue(null);
      } catch (error) {
          toast({ variant: 'destructive', title: "Gagal", description: "Gagal memperbarui data iuran."});
      } finally {
          setIsSubmittingEdit(false);
      }
  }

  const handleDeleteDue = async (dueId: string) => {
      try {
          await deleteDoc(doc(db, 'dues', dueId));
          toast({ title: "Berhasil", description: "Data iuran berhasil dihapus." });
          setPayments(prev => prev.filter(p => p.id !== dueId));
      } catch (error) {
          toast({ variant: 'destructive', title: "Gagal", description: "Gagal menghapus data iuran."});
      }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
  }

  return (
    <>
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle>Status Iuran Warga</CardTitle>
              <CardDescription>Lacak status pembayaran iuran warga per periode.</CardDescription>
            </div>
             <Button asChild>
                <Link href="/petugas/dues/record">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Catat Iuran Baru
                </Link>
             </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          <div className="relative flex-grow">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari nama warga..."
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder="Bulan" />
              </SelectTrigger>
              <SelectContent>
                {months.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-full sm:w-[100px]">
                <SelectValue placeholder="Tahun" />
              </SelectTrigger>
              <SelectContent>
                {years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

         <div className="flex justify-between items-center mb-4 gap-4">
          <Select value={filterStatus} onValueChange={(val: 'all' | 'paid' | 'unpaid') => setFilterStatus(val)}>
              <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Filter status" />
              </SelectTrigger>
              <SelectContent>
                  <SelectItem value="all">Semua Status</SelectItem>
                  <SelectItem value="paid">Sudah Bayar</SelectItem>
                  <SelectItem value="unpaid">Belum Bayar</SelectItem>
              </SelectContent>
          </Select>
          
          <AlertDialog>
              <AlertDialogTrigger asChild>
                  <Button variant="outline" disabled={isBroadcasting || unpaidUsers.length === 0}>
                      {isBroadcasting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageSquareWarning className="mr-2 h-4 w-4" />}
                      Broadcast Pengingat
                  </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                  <AlertDialogHeader>
                      <AlertDialogTitle>Konfirmasi Broadcast</AlertDialogTitle>
                      <AlertDialogDescription>
                          Anda akan mengirimkan notifikasi pengingat ke semua warga yang belum membayar iuran untuk periode {selectedMonth} {selectedYear}. Lanjutkan?
                      </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                      <AlertDialogCancel>Batal</AlertDialogCancel>
                      <AlertDialogAction onClick={handleBroadcastReminders}>Ya, Kirim</AlertDialogAction>
                  </AlertDialogFooter>
              </AlertDialogContent>
          </AlertDialog>
        </div>


        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama Warga</TableHead>
                <TableHead>Status Pembayaran</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-8 w-28 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : filteredUsers.length > 0 ? (
                filteredUsers.map((user) => (
                  <TableRow key={user.uid}>
                    <TableCell>
                        <button onClick={() => handleViewHistory(user)} className="font-medium text-primary hover:underline text-left">
                            {user.displayName}
                        </button>
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.paymentStatus === 'Lunas' ? 'secondary' : 'destructive'}
                        className={cn(user.paymentStatus === 'Lunas' && 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-400 border-green-200 dark:border-green-800')}>
                        {user.paymentStatus}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                       {user.paymentStatus === 'Belum Bayar' && (
                         <Button size="sm" onClick={() => handleSendReminder(user)} disabled={isSendingReminder === user.uid}>
                            {isSendingReminder === user.uid ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Bell className="mr-2 h-4 w-4" />}
                            Kirim Pengingat
                         </Button>
                       )}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={3} className="text-center h-24">
                    Data warga tidak ditemukan.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>

    <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
        <DialogContent className="sm:max-w-4xl">
            <DialogHeader>
                <DialogTitle>Riwayat Iuran: {selectedUser?.displayName}</DialogTitle>
                <CardDescription>{selectedUser?.email}</CardDescription>
            </DialogHeader>
            <div className="py-4">
                 <div className="rounded-lg border max-h-96 overflow-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Tanggal Bayar</TableHead>
                                <TableHead>Periode</TableHead>
                                <TableHead>Jumlah</TableHead>
                                <TableHead>Dicatat Oleh</TableHead>
                                <TableHead>Catatan</TableHead>
                                <TableHead className="text-right">Aksi</TableHead>
                            </TableRow>
                        </TableHeader>
                         <TableBody>
                            {userPaymentHistory.length > 0 ? (
                                userPaymentHistory.map(due => (
                                    <TableRow key={due.id}>
                                        <TableCell>{format(due.paymentDate, "PPP", { locale: id })}</TableCell>
                                        <TableCell>
                                            <Badge variant="secondary">{due.month} {due.year}</Badge>
                                        </TableCell>
                                        <TableCell>{formatCurrency(due.amount)}</TableCell>
                                        <TableCell>{due.recordedBy}</TableCell>
                                        <TableCell className="max-w-xs truncate">{due.notes || '-'}</TableCell>
                                        <TableCell className="text-right">
                                             <div className="flex gap-2 justify-end">
                                                <Button variant="outline" size="icon" onClick={() => handleOpenEditDialog(due)}>
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button variant="destructive" size="icon"><Trash className="h-4 w-4" /></Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>Hapus Catatan Iuran?</AlertDialogTitle>
                                                            <AlertDialogDescription>Tindakan ini tidak dapat dibatalkan.</AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>Batal</AlertDialogCancel>
                                                            <AlertDialogAction onClick={() => handleDeleteDue(due.id)}>Hapus</AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center">
                                        Warga ini belum memiliki riwayat iuran.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                 </div>
            </div>
            <DialogFooter>
                <DialogClose asChild>
                    <Button type="button">Tutup</Button>
                </DialogClose>
            </DialogFooter>
        </DialogContent>
    </Dialog>

    <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Edit Iuran</DialogTitle>
                <CardDescription>
                    Mengedit iuran untuk {currentDue?.userName} periode {currentDue?.month} {currentDue?.year}.
                </CardDescription>
            </DialogHeader>
            <Form {...editForm}>
                <form onSubmit={editForm.handleSubmit(handleEditSubmit)} className="space-y-4 pt-4">
                    <FormField
                        control={editForm.control}
                        name="amount"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Jumlah (Rp)</FormLabel>
                            <FormControl><Input type="number" {...field} /></FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    <FormField
                        control={editForm.control}
                        name="notes"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Catatan (Opsional)</FormLabel>
                            <FormControl><Textarea {...field} /></FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                     <DialogFooter>
                        <DialogClose asChild>
                            <Button type="button" variant="secondary">Batal</Button>
                        </DialogClose>
                        <Button type="submit" disabled={isSubmittingEdit}>
                            {isSubmittingEdit ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Simpan Perubahan
                        </Button>
                    </DialogFooter>
                </form>
            </Form>
        </DialogContent>
    </Dialog>
    </>
  );
}
