
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
import { PlusCircle, Edit, Trash, Loader2, Banknote, Eye, Search, MoreVertical } from 'lucide-react';
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
  const [selectedHonorarium, setSelectedHonorarium] = useState<Honorarium | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();

  const form = useForm<HonorariumFormValues>({
    resolver: zodResolver(honorariumSchema),
    defaultValues: { month: months[new Date().getMonth()], year: currentYear.toString() }
  });
  
  const watchedMonth = form.watch('month');
  const watchedYear = form.watch('year');

  const availableStaff = useMemo(() => {
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
    const staffQuery = query(collection(db, 'staff'), where('status', '==', 'active'));
    
    const unsubStaff = onSnapshot(staffQuery, (snapshot) => {
      const staffData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Staff));
      staffData.sort((a, b) => a.name.localeCompare(b.name));
      setStaff(staffData);
    });

    const honorQuery = query(collection(db, 'honorariums'));
    const unsubHonor = onSnapshot(honorQuery, (snapshot) => {
      let honorData = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            issueDate: data.issueDate ? (data.issueDate as Timestamp).toDate() : new Date(),
          } as Honorarium;
      });

      honorData = honorData.sort((a, b) => {
        const [monthA, yearA] = a.period.split(' ');
        const [monthB, yearB] = b.period.split(' ');
        const dateA = new Date(parseInt(yearA), months.indexOf(monthA));
        const dateB = new Date(parseInt(yearB), months.indexOf(monthB));
        if (dateB.getTime() !== dateA.getTime()) {
            return dateB.getTime() - dateA.getTime();
        }
        return a.staffName.localeCompare(b.staffName);
      });

      setHonorariums(honorData);
      setLoading(false);
    });

    return () => {
      unsubStaff();
      unsubHonor();
    };
  }, []);
  
  const filteredHonorariums = useMemo(() => 
    honorariums.filter(h => h.staffName?.toLowerCase().includes(searchTerm.toLowerCase())),
  [honorariums, searchTerm]);


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
    const selectedStaff = staff.find(s => s.id === values.staffId);
    if (!selectedStaff) {
      toast({ variant: 'destructive', title: 'Gagal', description: 'Petugas tidak ditemukan.' });
      setIsSubmitting(false);
      return;
    }

    try {
      const payload = { 
          ...values, 
          staffName: selectedStaff.name,
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
      setIsDetailOpen(false); // Close detail dialog on delete
    } catch (error) {
      toast({ variant: 'destructive', title: "Gagal", description: "Tidak dapat menghapus data." });
    }
  };
  
  const showDetail = (honor: Honorarium) => {
    setSelectedHonorarium(honor);
    setIsDetailOpen(true);
  }

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
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={3}><Skeleton className="h-5 w-full" /></TableCell>
                  </TableRow>
                ))
              ) : filteredHonorariums.length > 0 ? (
                filteredHonorariums.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell>
                        <div className="flex items-center gap-2">
                           <Avatar className="h-8 w-8">
                             <AvatarImage src={undefined} />
                             <AvatarFallback>{h.staffName.charAt(0).toUpperCase()}</AvatarFallback>
                           </Avatar>
                           {h.staffName}
                        </div>
                    </TableCell>
                    <TableCell><Badge variant="secondary" className={cn(statusConfig[h.status]?.className)}>{h.status}</Badge></TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => showDetail(h)}>
                        <MoreVertical className="h-4 w-4" />
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
                      {availableStaff.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
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
        <DialogContent>
            {selectedHonorarium && (
                <>
                <DialogHeader>
                    <DialogTitle className="sr-only">Detail Honorarium</DialogTitle>
                    <div className="flex flex-col items-center text-center">
                        <Avatar className="h-20 w-20 mb-2">
                           <AvatarImage src={undefined} />
                           <AvatarFallback className="text-3xl">{selectedHonorarium.staffName.charAt(0).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <h2 className="text-xl font-bold">{selectedHonorarium.staffName}</h2>
                        <p className="text-muted-foreground">{selectedHonorarium.period}</p>
                    </div>
                </DialogHeader>
                <DialogBody>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center border-b pb-2">
                       <span className="text-muted-foreground">Jumlah</span>
                       <span className="font-semibold">{formatCurrency(selectedHonorarium.amount)}</span>
                    </div>
                    <div className="flex justify-between items-center border-b pb-2">
                       <span className="text-muted-foreground">Status</span>
                       <Badge variant="secondary" className={cn(statusConfig[selectedHonorarium.status]?.className)}>{selectedHonorarium.status}</Badge>
                    </div>
                    <div className="flex justify-between items-center border-b pb-2">
                       <span className="text-muted-foreground">Tanggal Dibuat</span>
                       <span className="font-semibold">{format(selectedHonorarium.issueDate, "PPP", { locale: id })}</span>
                    </div>
                    {selectedHonorarium.notes && (
                        <div>
                            <span className="text-muted-foreground text-sm">Catatan:</span>
                            <p className="font-semibold text-sm">{selectedHonorarium.notes}</p>
                        </div>
                    )}
                  </div>
                </DialogBody>
                <DialogFooter className="flex-col items-stretch gap-2">
                    <Button variant="outline" onClick={() => { setIsDetailOpen(false); setCurrentHonorarium(selectedHonorarium); setIsDialogOpen(true); }}>
                        <Edit className="mr-2 h-4 w-4" /> Edit Data
                    </Button>
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive"><Trash className="mr-2 h-4 w-4"/> Hapus Data</Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Hapus Data Honorarium Ini?</AlertDialogTitle>
                                <AlertDialogDescription>Tindakan ini tidak dapat dibatalkan.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Batal</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(selectedHonorarium.id)}>Ya, Hapus</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </DialogFooter>
                </>
            )}
        </DialogContent>
    </Dialog>
    </>
  );
}
