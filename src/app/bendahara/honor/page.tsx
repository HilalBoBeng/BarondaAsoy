
"use client";

import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { db } from '@/lib/firebase/client';
import { collection, onSnapshot, addDoc, doc, updateDoc, serverTimestamp, query, orderBy, Timestamp, where, getDocs, deleteDoc, writeBatch } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose, DialogBody } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Banknote, Search, CheckCircle, RefreshCw } from 'lucide-react';
import type { Honorarium, Staff } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger, AlertDialogFooter } from '@/components/ui/alert-dialog';


const months = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];
const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, i) => (currentYear - 2 + i).toString());

const paymentSchema = z.object({
  amount: z.coerce.number().min(1, "Jumlah honor tidak boleh kosong."),
});
type PaymentFormValues = z.infer<typeof paymentSchema>;

const statusConfig: Record<Honorarium['status'], { className: string }> = {
    'Dibayarkan': { className: 'bg-green-100 text-green-800' },
    'Belum Dibayar': { className: 'bg-yellow-100 text-yellow-800' },
};

const roleDisplay: Record<string, string> = {
    admin: 'Administrator',
    bendahara: 'Bendahara',
    petugas: 'Petugas',
};

export default function BendaharaHonorariumPage() {
  const [honorariums, setHonorariums] = useState<Honorarium[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPayDialogOpen, setIsPayDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedStaffForPayment, setSelectedStaffForPayment] = useState<Staff | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMonth, setSelectedMonth] = useState<string>(months[new Date().getMonth()]);
  const [selectedYear, setSelectedYear] = useState<string>(currentYear.toString());
  const [filterStatus, setFilterStatus] = useState<'all' | 'Dibayarkan' | 'Belum Dibayar'>('all');
  const [staffInfo, setStaffInfo] = useState<Staff | null>(null);
  const { toast } = useToast();

  const paymentForm = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentSchema),
  });

  useEffect(() => {
    const info = JSON.parse(localStorage.getItem('staffInfo') || '{}');
    if (info) {
        setStaffInfo(info);
    }
    const staffQuery = query(collection(db, 'staff'), where('status', '==', 'active'));
    const unsubStaff = onSnapshot(staffQuery, (snapshot) => {
      const staffData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Staff));
      staffData.sort((a, b) => a.name.localeCompare(b.name));
      setStaff(staffData);
    });

    const honorQuery = query(collection(db, 'honorariums'));
    const unsubHonor = onSnapshot(honorQuery, (snapshot) => {
      setHonorariums(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Honorarium)));
      setLoading(false);
    });

    return () => { unsubStaff(); unsubHonor(); };
  }, []);

  const staffWithHonorStatus = useMemo(() => {
    const period = `${selectedMonth} ${selectedYear}`;
    return staff.map(s => {
      const honorRecord = honorariums.find(h => h.staffId === s.id && h.period === period);
      return {
        ...s,
        honorStatus: honorRecord?.status || 'Belum Dibayar',
        honorRecordId: honorRecord?.id,
      };
    });
  }, [staff, honorariums, selectedMonth, selectedYear]);

  const filteredStaff = useMemo(() => {
    let filtered = staffWithHonorStatus;
    if (filterStatus !== 'all') {
      filtered = filtered.filter(s => s.honorStatus === filterStatus);
    }
    return filtered.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [staffWithHonorStatus, filterStatus, searchTerm]);

  const formatCurrency = (value: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);

  const formatNumberInput = (value: string) => {
    const numericValue = value.replace(/\D/g, '');
    if (!numericValue) return '';
    return new Intl.NumberFormat('id-ID').format(parseInt(numericValue, 10));
  };
  
  const handleOpenPayDialog = (staffMember: Staff) => {
      setSelectedStaffForPayment(staffMember);
      paymentForm.reset();
      setIsPayDialogOpen(true);
  }

  const handleCancelPayment = async (honorRecordId?: string) => {
    if (!honorRecordId) return;
    try {
        const batch = writeBatch(db);

        const honorRef = doc(db, 'honorariums', honorRecordId);
        batch.delete(honorRef);
        
        const financeQuery = query(collection(db, 'financial_transactions'), where('relatedId', '==', honorRecordId));
        const financeDocs = await getDocs(financeQuery);
        financeDocs.forEach(doc => {
            batch.delete(doc.ref);
        });

        await batch.commit();

        toast({ title: "Berhasil", description: "Pembayaran telah dibatalkan dan catatan keuangan telah dihapus." });
    } catch (error) {
        toast({ variant: 'destructive', title: "Gagal", description: "Gagal membatalkan pembayaran." });
    }
  };

  const onPaymentSubmit = async (values: PaymentFormValues) => {
    if (!selectedStaffForPayment || !staffInfo) return;
    setIsSubmitting(true);

    try {
        const batch = writeBatch(db);
        const period = `${selectedMonth} ${selectedYear}`;
        
        const honorRef = doc(collection(db, 'honorariums'));
        batch.set(honorRef, {
            staffId: selectedStaffForPayment.id,
            staffName: selectedStaffForPayment.name,
            amount: values.amount,
            period: period,
            status: 'Dibayarkan' as const,
            issueDate: serverTimestamp(),
        });
        
        const financeRef = doc(collection(db, 'financial_transactions'));
        batch.set(financeRef, {
            type: 'expense',
            description: `Honor Petugas - ${selectedStaffForPayment.name} (${period})`,
            amount: values.amount,
            category: 'Honor Petugas',
            date: serverTimestamp(),
            recordedBy: staffInfo.name,
            relatedId: honorRef.id,
        });

        await batch.commit();
        
        toast({ title: "Berhasil", description: `Honor untuk ${selectedStaffForPayment.name} telah dibayarkan dan dicatat.` });
        setIsPayDialogOpen(false);
    } catch (error) {
        toast({ variant: 'destructive', title: "Gagal", description: "Terjadi kesalahan saat menyimpan pembayaran." });
    } finally {
        setIsSubmitting(false);
    }
  }
  
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Manajemen Honorarium Petugas</CardTitle>
          <CardDescription>Lacak dan catat pembayaran honorarium untuk setiap petugas per periode.</CardDescription>
        </CardHeader>
        <CardContent>
           <div className="flex flex-col sm:flex-row gap-4 mb-4">
              <div className="relative flex-grow">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Cari nama petugas..."
                  className="pl-9"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="w-full sm:w-[150px]"><SelectValue /></SelectTrigger>
                  <SelectContent>{months.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger className="w-full sm:w-[100px]"><SelectValue /></SelectTrigger>
                  <SelectContent>{years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
             <div className="flex justify-start mb-4">
                <Select value={filterStatus} onValueChange={(val: any) => setFilterStatus(val)}>
                    <SelectTrigger className="w-full sm:w-[180px]">
                        <SelectValue placeholder="Filter status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Semua Status</SelectItem>
                        <SelectItem value="Dibayarkan">Dibayarkan</SelectItem>
                        <SelectItem value="Belum Dibayar">Belum Dibayar</SelectItem>
                    </SelectContent>
                </Select>
             </div>
          <div className="rounded-lg border">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama Petugas</TableHead>
                    <TableHead>Status Pembayaran</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell><Skeleton className="h-10 w-48" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                        <TableCell className="text-right"><Skeleton className="h-10 w-24 ml-auto" /></TableCell>
                      </TableRow>
                    ))
                  ) : filteredStaff.length > 0 ? (
                    filteredStaff.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={s.photoURL || undefined} />
                              <AvatarFallback>{s.name.charAt(0).toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col items-start">
                                <p className="font-medium">{s.name}</p>
                                {s.role && (
                                    <Badge variant="outline" className="mt-1">{roleDisplay[s.role] || s.role}</Badge>
                                )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                            <Badge variant="secondary" className={cn(statusConfig[s.honorStatus as keyof typeof statusConfig]?.className)}>
                                {s.honorStatus}
                            </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                           <>
                             {s.honorStatus === 'Belum Dibayar' && (
                               <Button size="sm" onClick={() => handleOpenPayDialog(s)}>
                                   <Banknote className="mr-2 h-4 w-4"/> Bayar
                               </Button>
                             )}
                              {s.honorStatus === 'Dibayarkan' && (
                                <AlertDialog>
                                   <AlertDialogTrigger asChild>
                                       <Button variant="outline" size="sm">
                                           <RefreshCw className="mr-2 h-4 w-4"/> Batalkan
                                       </Button>
                                   </AlertDialogTrigger>
                                   <AlertDialogContent>
                                       <AlertDialogHeader>
                                           <AlertDialogTitle>Batalkan Pembayaran?</AlertDialogTitle>
                                           <AlertDialogDescription>
                                               Tindakan ini akan mengembalikan status pembayaran menjadi "Belum Dibayar". Yakin?
                                           </AlertDialogDescription>
                                       </AlertDialogHeader>
                                       <AlertDialogFooter>
                                           <AlertDialogCancel>Tidak</AlertDialogCancel>
                                           <AlertDialogAction onClick={() => handleCancelPayment(s.honorRecordId)}>Ya, Batalkan</AlertDialogAction>
                                       </AlertDialogFooter>
                                   </AlertDialogContent>
                                </AlertDialog>
                              )}
                           </>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={3} className="h-24 text-center">Data petugas tidak ditemukan.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Dialog open={isPayDialogOpen} onOpenChange={setIsPayDialogOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Catat Pembayaran Honor</DialogTitle>
                <CardDescription>Untuk: <strong>{selectedStaffForPayment?.name}</strong><br/>Periode: {selectedMonth} {selectedYear}</CardDescription>
            </DialogHeader>
             <Form {...paymentForm}>
                <form onSubmit={paymentForm.handleSubmit(onPaymentSubmit)}>
                    <DialogBody>
                         <FormField control={paymentForm.control} name="amount" render={({ field }) => (
                            <FormItem>
                            <FormLabel>Jumlah (Rp)</FormLabel>
                            <FormControl>
                                <Input 
                                type="text"
                                inputMode="numeric"
                                value={field.value ? formatNumberInput(field.value.toString()) : ''}
                                onChange={(e) => {
                                    const formattedValue = formatNumberInput(e.target.value);
                                    const numericValue = parseInt(formattedValue.replace(/\D/g, ''), 10) || 0;
                                    field.onChange(numericValue);
                                }}
                                placeholder="Contoh: 500.000"
                                />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )} />
                    </DialogBody>
                    <DialogFooter>
                        <DialogClose asChild><Button variant="secondary" type="button">Batal</Button></DialogClose>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                            Konfirmasi Pembayaran
                        </Button>
                    </DialogFooter>
                </form>
             </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
