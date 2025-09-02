
"use client";

import { useState, useEffect, useMemo } from 'react';
import { db } from '@/lib/firebase/client';
import { collection, onSnapshot, query, where, getDocs, addDoc, serverTimestamp, doc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import type { DuesPayment, AppUser } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Bell, Loader2, Search, PlusCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import Link from 'next/link';

const months = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];
const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, i) => (currentYear - 2 + i).toString());

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
  const { toast } = useToast();

  useEffect(() => {
    setLoading(true);
    const usersQuery = query(collection(db, 'users'));
    const paymentsQuery = query(collection(db, 'dues'));

    const unsubUsers = onSnapshot(usersQuery, (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() })) as AppUser[];
      setUsers(usersData);
    });

    const unsubPayments = onSnapshot(paymentsQuery, (snapshot) => {
      const paymentsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as DuesPayment[];
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

  const filteredUsers = useMemo(() => {
    return users
      .filter(user => user.displayName?.toLowerCase().includes(searchTerm.toLowerCase()))
      .map(user => {
        const hasPaid = payments.some(
          p => p.userId === user.uid && p.month === selectedMonth && p.year === selectedYear
        );
        return {
          ...user,
          paymentStatus: hasPaid ? 'Lunas' : 'Belum Bayar'
        };
      })
      .sort((a, b) => a.displayName!.localeCompare(b.displayName!));
  }, [users, payments, searchTerm, selectedMonth, selectedYear]);

  const userPaymentHistory = useMemo(() => {
    if (!selectedUser) return [];
    return payments
      .filter(p => p.userId === selectedUser.uid)
      .sort((a, b) => (b.paymentDate as any) - (a.paymentDate as any));
  }, [payments, selectedUser]);
  
  const handleViewHistory = (user: AppUser) => {
    setSelectedUser(user);
    setIsHistoryOpen(true);
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
                      <Badge variant={user.paymentStatus === 'Lunas' ? 'secondary' : 'destructive'}>
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
        <DialogContent className="sm:max-w-xl">
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
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-24 text-center">
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
    </>
  );
}
