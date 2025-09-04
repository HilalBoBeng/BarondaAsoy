
"use client";

import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { db } from '@/lib/firebase/client';
import { collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, serverTimestamp, query, orderBy, Timestamp, where, getDocs } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose, DialogBody } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger, AlertDialogFooter } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Edit, Trash, Loader2, Banknote, Eye, Search } from 'lucide-react';
import type { Honorarium, Staff } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const months = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];
const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, i) => (currentYear - 2 + i).toString());

const honorariumSchema = z.object({
  staffId: z.string().min(1, "Petugas harus dipilih."),
  month: z.string().min(1, "Bulan harus dipilih."),
  year: z.string().min(1, "Tahun harus dipilih."),
  amount: z.coerce.number().min(1, "Jumlah honor tidak boleh kosong."),
  status: z.enum(['Dibayarkan', 'Tertunda', 'Dipotong', 'Batal'], { required_error: "Status harus dipilih." }),
  notes: z.string().optional(),
});

type HonorariumFormValues = z.infer<typeof honorariumSchema>;

const statusConfig: Record<Honorarium['status'], { className: string }> = {
    'Dibayarkan': { className: 'bg-green-100 text-green-800' },
    'Tertunda': { className: 'bg-yellow-100 text-yellow-800' },
    'Dipotong': { className: 'bg-orange-100 text-orange-800' },
    'Batal': { className: 'bg-red-100 text-red-800' },
};

export default function HonorariumAdminPage() {
  const [honorariums, setHonorariums] = useState<Honorarium[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentHonorarium, setCurrentHonorarium] = useState<Honorarium | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();

  const form = useForm<HonorariumFormValues>({
    resolver: zodResolver(honorariumSchema),
    defaultValues: { month: months[new Date().getMonth()], year: currentYear.toString() }
  });

  const watchedMonth = form.watch('month');
  const watchedYear = form.watch('year');

  const availableStaffForForm = useMemo(() => {
    if (!watchedMonth || !watchedYear) {
        return staff;
    }
    const period = `${watchedMonth} ${watchedYear}`;
    const paidStaffIds = honorariums
        .filter(h => h.period === period)
        .map(h => h.staffId);
    
    return staff.filter(s => 
        !paidStaffIds.includes(s.id) || 
        (currentHonorarium && s.id === currentHonorarium.staffId)
    );
  }, [staff, honorariums, watchedMonth, watchedYear, currentHonorarium]);
  
  useEffect(() => {
    const staffQuery = query(collection(db, 'staff'), where('status', '==', 'active'), orderBy('name', 'asc'));
    const unsubStaff = onSnapshot(staffQuery, (snapshot) => {
        setStaff(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Staff)));
    });

    const honorQuery = query(collection(db, 'honorariums'));
    const unsubHonor = onSnapshot(honorQuery, (snapshot) => {
        setHonorariums(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), issueDate: (doc.data().issueDate as Timestamp)?.toDate() } as Honorarium)));
        setLoading(false);
    });

    return () => { unsubStaff(); unsubHonor(); };
  }, []);
  
  const staffWithHonor = useMemo(() => {
    const staffMap = new Map<string, { staff: Staff, honorCount: number, totalAmount: number }>();
    staff.forEach(s => {
        staffMap.set(s.id, { staff: s, honorCount: 0, totalAmount: 0 });
    });
    honorariums.forEach(h => {
        if (staffMap.has(h.staffId)) {
            const existing = staffMap.get(h.staffId)!;
            existing.honorCount += 1;
            existing.totalAmount += h.amount;
        }
    });
    const result = Array.from(staffMap.values()).filter(item => item.honorCount > 0);
    result.sort((a,b) => a.staff.name.localeCompare(b.staff.name));
    return result;
  }, [honorariums, staff]);

  const filteredStaffWithHonor = useMemo(() => 
    staffWithHonor.filter(item => item.staff.name.toLowerCase().includes(searchTerm.toLowerCase())),
  [staffWithHonor, searchTerm]);

  useEffect(() => {
    if (isDialogOpen && currentHonorarium) {
        const [month, year] = currentHonorarium.period.split(' ');
        form.reset({
          staffId: currentHonorarium.staffId,
          month: month || '',
          year: year || '',
          amount: currentHonorarium.amount,
          status: currentHonorarium.status,
          notes: currentHonorarium.notes || '',
        });
    } else if (isDialogOpen) {
        form.reset({ staffId: '', month: months[new Date().getMonth()], year: currentYear.toString(), amount: 0, status: 'Tertunda', notes: '' });
    }
  }, [isDialogOpen, currentHonorarium, form]);

  const formatCurrency = (value: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);

  const formatNumberInput = (value: string) => {
    const numericValue = value.replace(/\D/g, '');
    if (!numericValue) return '';
    return new Intl.NumberFormat('id-ID').format(parseInt(numericValue, 10));
  };

  const onSubmit = async (values: HonorariumFormValues) => {
    setIsSubmitting(true);
    const selectedStaffForSubmit = staff.find(s => s.id === values.staffId);
    if (!selectedStaffForSubmit) {
      toast({ variant: 'destructive', title: 'Gagal', description: 'Petugas tidak ditemukan.' });
      setIsSubmitting(false);
      return;
    }

    try {
      const payload = { 
          ...values, 
          staffName: selectedStaffForSubmit.name,
          period: `${values.month} ${values.year}`,
       };
      const { month, year, ...finalPayload } = payload;

      if (currentHonorarium) {
        const docRef = doc(db, 'honorariums', currentHonorarium.id);
        await updateDoc(docRef, finalPayload);
        toast({ title: "Berhasil", description: "Data honorarium berhasil diperbarui." });
      } else {
        await addDoc(collection(db, 'honorariums'), { ...finalPayload, issueDate: serverTimestamp() });
        toast({ title: "Berhasil", description: "Data honorarium berhasil ditambahkan." });
      }
      setIsDialogOpen(false);
      setCurrentHonorarium(null);
    } catch (error) {
      toast({ variant: 'destructive', title: "Gagal", description: "Terjadi kesalahan saat menyimpan data." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'honorariums', id));
      toast({ title: "Berhasil", description: "Data honorarium berhasil dihapus." });
    } catch (error) {
      toast({ variant: 'destructive', title: "Gagal", description: "Tidak dapat menghapus data." });
    }
  };
  
  const showDetail = (staffMember: Staff) => {
    setSelectedStaff(staffMember);
    setIsDetailOpen(true);
  }
  
  const staffHonorHistory = useMemo(() => {
    if (!selectedStaff) return [];
    return honorariums
        .filter(h => h.staffId === selectedStaff.id)
        .sort((a, b) => (b.issueDate as Date).getTime() - (a.issueDate as Date).getTime());
  }, [honorariums, selectedStaff]);

  return (
    <>
    <Card>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <CardTitle>Manajemen Honorarium Petugas</CardTitle>
          <CardDescription>Tambah, edit, atau hapus catatan honorarium untuk petugas.</CardDescription>
        </div>
        <Button onClick={() => { setCurrentHonorarium(null); setIsDialogOpen(true); }}>
          <PlusCircle className="mr-2" /> Tambah Honor
        </Button>
      </CardHeader>
      <CardContent>
        <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari nama petugas..."
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
        </div>
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama Petugas</TableHead>
                <TableHead>Total Diterima</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-10 w-48" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-10 w-10 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : filteredStaffWithHonor.length > 0 ? (
                filteredStaffWithHonor.map((item) => (
                  <TableRow key={item.staff.id}>
                    <TableCell>
                        <div className="flex items-center gap-2">
                           <Avatar className="h-8 w-8">
                             <AvatarImage src={undefined} />
                             <AvatarFallback>{item.staff.name.charAt(0).toUpperCase()}</AvatarFallback>
                           </Avatar>
                           {item.staff.name}
                        </div>
                    </TableCell>
                    <TableCell>{formatCurrency(item.totalAmount)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => showDetail(item.staff)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={3} className="h-24 text-center">Belum ada data honorarium.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>

    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{currentHonorarium ? 'Edit' : 'Tambah'} Honorarium</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <DialogBody className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="month" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bulan</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl>
                      <SelectContent>
                        {months.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                  <FormField control={form.control} name="year" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tahun</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl>
                      <SelectContent>
                        {years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="staffId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Nama Petugas</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger disabled={!watchedMonth || !watchedYear}><SelectValue placeholder={!watchedMonth || !watchedYear ? "Pilih periode dulu" : "Pilih petugas"} /></SelectTrigger></FormControl>
                    <SelectContent>
                      {availableStaffForForm.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="amount" render={({ field }) => (
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
              <FormField control={form.control} name="status" render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="Dibayarkan">Dibayarkan</SelectItem>
                      <SelectItem value="Tertunda">Tertunda</SelectItem>
                      <SelectItem value="Dipotong">Dipotong</SelectItem>
                      <SelectItem value="Batal">Batal</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem>
                  <FormLabel>Catatan (Opsional)</FormLabel>
                  <FormControl><Textarea {...field} placeholder="Contoh: Dipotong karena tidak masuk 2 hari" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </DialogBody>
            <DialogFooter>
                <DialogClose asChild><Button type="button" variant="secondary">Batal</Button></DialogClose>
                <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2" />} Simpan
                </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>

    <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-2xl">
            {selectedStaff && (
                <>
                <DialogHeader>
                    <DialogTitle>Riwayat Honor: {selectedStaff.name}</DialogTitle>
                </DialogHeader>
                <DialogBody>
                  <div className="rounded-lg border max-h-[60vh] overflow-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Periode</TableHead>
                                <TableHead>Jumlah</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Aksi</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {staffHonorHistory.map(h => (
                                <TableRow key={h.id}>
                                    <TableCell>{h.period}</TableCell>
                                    <TableCell>{formatCurrency(h.amount)}</TableCell>
                                    <TableCell><Badge variant="secondary" className={cn(statusConfig[h.status].className)}>{h.status}</Badge></TableCell>
                                    <TableCell>
                                        <div className="flex gap-1">
                                            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => { setIsDetailOpen(false); setCurrentHonorarium(h); setIsDialogOpen(true); }}><Edit className="h-4 w-4"/></Button>
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild><Button variant="destructive" size="icon" className="h-7 w-7"><Trash className="h-4 w-4"/></Button></AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Hapus Data Honor Ini?</AlertDialogTitle>
                                                        <AlertDialogDescription>Tindakan ini tidak dapat dibatalkan.</AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Batal</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleDelete(h.id)}>Ya, Hapus</AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                  </div>
                </DialogBody>
                </>
            )}
        </DialogContent>
    </Dialog>
    </>
  );
}
