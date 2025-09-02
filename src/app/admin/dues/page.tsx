"use client";

import { useState, useEffect, useMemo } from 'react';
import { db } from '@/lib/firebase/client';
import { collection, onSnapshot, query, where, getDocs, addDoc, serverTimestamp, doc, Timestamp, deleteDoc, updateDoc, orderBy } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import type { DuesPayment, AppUser } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Bell, Loader2, Search, MessageSquareWarning } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger, AlertDialogFooter } from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import Link from 'next/link';

const months = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];
const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, i) => (currentYear - 2 + i).toString());
const USERS_PER_PAGE = 20;

export default function DuesAdminPage() {
  const [payments, setPayments] = useState<DuesPayment[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMonth, setSelectedMonth] = useState<string>(months[new Date().getMonth()]);
  const [selectedYear, setSelectedYear] = useState<string>(currentYear.toString());
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'paid' | 'unpaid'>('all');
  const [currentPage, setCurrentPage] = useState(1);

  const { toast } = useToast();

  useEffect(() => {
    setLoading(true);
    const usersQuery = query(collection(db, 'users'), orderBy('displayName', 'asc'));
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
              paymentDate: data.paymentDate // Keep as Timestamp
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
        .filter(user => user.displayName?.toLowerCase().includes(searchTerm.toLowerCase()));

  }, [usersWithPaymentStatus, filterStatus, searchTerm]);

  const paginatedUsers = useMemo(() => {
    const startIndex = (currentPage - 1) * USERS_PER_PAGE;
    return filteredUsers.slice(startIndex, startIndex + USERS_PER_PAGE);
  }, [filteredUsers, currentPage]);

  const totalPages = Math.ceil(filteredUsers.length / USERS_PER_PAGE);


  const unpaidUsers = useMemo(() => {
    return usersWithPaymentStatus.filter(u => u.paymentStatus === 'Belum Bayar');
  }, [usersWithPaymentStatus]);

  const handleBroadcastReminders = async () => {
    setIsBroadcasting(true);
    
    const usersToRemind = unpaidUsers;

    if (usersToRemind.length === 0) {
        toast({ variant: 'destructive', title: 'Tidak Ada Tindakan', description: 'Tidak ada warga yang belum membayar pada periode ini.' });
        setIsBroadcasting(false);
        return;
    }
    try {
        for (const user of usersToRemind) {
            const recipientName = user.displayName || 'Warga';
            const formattedMessage = `<strong>Yth, ${recipientName.toUpperCase()}</strong>\n\nDengan hormat, kami ingin mengingatkan mengenai pembayaran iuran keamanan untuk bulan ${selectedMonth} ${selectedYear}. Mohon untuk segera melakukan pembayaran.\n\nTerima kasih atas perhatian dan kerja sama Anda.`;

            await addDoc(collection(db, 'notifications'), {
                userId: user.uid,
                title: `Pengingat Iuran ${selectedMonth} ${selectedYear}`,
                message: formattedMessage,
                read: false,
                createdAt: serverTimestamp(),
                link: '/profile',
            });
        }
        toast({ title: "Berhasil", description: `Pengingat iuran berhasil dikirim ke ${usersToRemind.length} warga.` });
    } catch (error) {
        toast({ variant: 'destructive', title: "Gagal", description: "Gagal mengirim pengingat massal." });
    } finally {
        setIsBroadcasting(false);
    }
  };
  
  const canBroadcast = useMemo(() => {
    if (filterStatus === 'paid') return false;
    return unpaidUsers.length > 0;
  }, [filterStatus, unpaidUsers]);


  return (
    <Card>
      <CardHeader>
        <CardTitle>Status Iuran Warga</CardTitle>
        <CardDescription>Lacak status pembayaran iuran warga per periode.</CardDescription>
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
                  <Button variant="outline" disabled={isBroadcasting || !canBroadcast}>
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                  </TableRow>
                ))
              ) : paginatedUsers.length > 0 ? (
                paginatedUsers.map((user) => (
                  <TableRow key={user.uid}>
                    <TableCell>
                        <Link href={`/admin/dues/${user.uid}`} className="font-medium text-primary hover:underline text-left">
                            {user.displayName}
                        </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.paymentStatus === 'Lunas' ? 'secondary' : 'destructive'} 
                        className={cn(user.paymentStatus === 'Lunas' && 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-400 border-green-200 dark:border-green-800')}>
                        {user.paymentStatus}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={2} className="text-center h-24">
                    Data warga tidak ditemukan.
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
                onClick={() => setCurrentPage(prev => prev - 1)}
                disabled={currentPage === 1 || loading}
            >
                Sebelumnya
            </Button>
            <span className="text-sm text-muted-foreground">Halaman {currentPage} dari {totalPages}</span>
            <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => prev + 1)}
                disabled={currentPage === totalPages || loading}
            >
                Berikutnya
            </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
