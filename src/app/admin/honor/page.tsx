
"use client";

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { db } from '@/lib/firebase/client';
import { collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, serverTimestamp, query, orderBy, Timestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Edit, Trash, Loader2, Banknote } from 'lucide-react';
import type { Honorarium, Staff } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

const honorariumSchema = z.object({
  staffId: z.string().min(1, "Petugas harus dipilih."),
  period: z.string().min(1, "Periode harus diisi (contoh: Juli 2024)."),
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
  const { toast } = useToast();

  const form = useForm<HonorariumFormValues>({
    resolver: zodResolver(honorariumSchema),
  });

  useEffect(() => {
    const staffQuery = query(collection(db, 'staff'), where('status', '==', 'active'), orderBy('name'));
    const honorQuery = query(collection(db, 'honorariums'), orderBy('issueDate', 'desc'));

    const unsubStaff = onSnapshot(staffQuery, (snapshot) => {
      setStaff(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Staff)));
    });

    const unsubHonor = onSnapshot(honorQuery, (snapshot) => {
      setHonorariums(snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        issueDate: (doc.data().issueDate as Timestamp).toDate(),
      } as Honorarium)));
      setLoading(false);
    });

    return () => {
      unsubStaff();
      unsubHonor();
    };
  }, []);

  useEffect(() => {
    if (isDialogOpen) {
      if (currentHonorarium) {
        form.reset({
          staffId: currentHonorarium.staffId,
          period: currentHonorarium.period,
          amount: currentHonorarium.amount,
          status: currentHonorarium.status,
          notes: currentHonorarium.notes || '',
        });
      } else {
        form.reset({ staffId: '', period: '', amount: 0, status: 'Tertunda', notes: '' });
      }
    }
  }, [isDialogOpen, currentHonorarium, form]);

  const formatCurrency = (value: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(value);

  const onSubmit = async (values: HonorariumFormValues) => {
    setIsSubmitting(true);
    const selectedStaff = staff.find(s => s.id === values.staffId);
    if (!selectedStaff) {
      toast({ variant: 'destructive', title: 'Gagal', description: 'Petugas tidak ditemukan.' });
      setIsSubmitting(false);
      return;
    }

    try {
      const payload = { ...values, staffName: selectedStaff.name };

      if (currentHonorarium) {
        const docRef = doc(db, 'honorariums', currentHonorarium.id);
        await updateDoc(docRef, payload);
        toast({ title: "Berhasil", description: "Data honorarium berhasil diperbarui." });
      } else {
        await addDoc(collection(db, 'honorariums'), { ...payload, issueDate: serverTimestamp() });
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

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle>Manajemen Honorarium Petugas</CardTitle>
          <CardDescription>Tambah, edit, atau hapus catatan honorarium untuk petugas.</CardDescription>
        </div>
        <Button onClick={() => { setCurrentHonorarium(null); setIsDialogOpen(true); }}>
          <PlusCircle className="mr-2" /> Tambah Honor
        </Button>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tanggal</TableHead>
                <TableHead>Nama Petugas</TableHead>
                <TableHead>Periode</TableHead>
                <TableHead>Jumlah</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Catatan</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={7}><Skeleton className="h-5 w-full" /></TableCell>
                  </TableRow>
                ))
              ) : honorariums.length > 0 ? (
                honorariums.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell>{format(h.issueDate as Date, "PPP", { locale: id })}</TableCell>
                    <TableCell>{h.staffName}</TableCell>
                    <TableCell>{h.period}</TableCell>
                    <TableCell>{formatCurrency(h.amount)}</TableCell>
                    <TableCell><Badge variant="secondary" className={cn(statusConfig[h.status].className)}>{h.status}</Badge></TableCell>
                    <TableCell className="max-w-xs truncate">{h.notes || '-'}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        <Button variant="outline" size="icon" onClick={() => { setCurrentHonorarium(h); setIsDialogOpen(true); }}><Edit /></Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild><Button variant="destructive" size="icon"><Trash /></Button></AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Hapus Data Ini?</AlertDialogTitle>
                              <AlertDialogDescription>Tindakan ini tidak dapat dibatalkan.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Batal</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(h.id)}>Hapus</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center">Belum ada data honorarium.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{currentHonorarium ? 'Edit' : 'Tambah'} Honorarium</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
              <FormField control={form.control} name="staffId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Nama Petugas</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Pilih petugas" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {staff.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="period" render={({ field }) => (
                <FormItem>
                  <FormLabel>Periode</FormLabel>
                  <FormControl><Input {...field} placeholder="Contoh: Juli 2024" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="amount" render={({ field }) => (
                <FormItem>
                  <FormLabel>Jumlah (Rp)</FormLabel>
                  <FormControl><Input type="number" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="status" render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
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
    </Card>
  );
}
