
"use client";

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { db } from '@/lib/firebase/client';
import { collection, onSnapshot, addDoc, serverTimestamp, query, orderBy, getDocs, Timestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Landmark } from 'lucide-react';
import type { AppUser, DuesPayment } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { Textarea } from '@/components/ui/textarea';

const months = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni", 
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];
const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, i) => (currentYear - 2 + i).toString());


const duesSchema = z.object({
  userId: z.string().min(1, "Warga harus dipilih."),
  amount: z.coerce.number().min(1, "Jumlah iuran tidak boleh kosong."),
  month: z.string().min(1, "Bulan harus dipilih."),
  year: z.string().min(1, "Tahun harus dipilih."),
  notes: z.string().optional(),
});

type DuesFormValues = z.infer<typeof duesSchema>;

export default function DuesPetugasPage() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [dues, setDues] = useState<DuesPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [staffInfo, setStaffInfo] = useState<{ id: string, name: string } | null>(null);
  const { toast } = useToast();

  const form = useForm<DuesFormValues>({
    resolver: zodResolver(duesSchema),
    defaultValues: { userId: '', amount: 0, month: months[new Date().getMonth()], year: currentYear.toString(), notes: '' },
  });

  useEffect(() => {
    const info = JSON.parse(localStorage.getItem('staffInfo') || '{}');
    if (info.id) {
        setStaffInfo(info);
    }
    
    // Fetch users
    const usersQuery = query(collection(db, "users"), orderBy("displayName"));
    const unsubUsers = onSnapshot(usersQuery, (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as AppUser));
      setUsers(usersData);
    });

    // Fetch dues
    const duesQuery = query(collection(db, 'dues'), orderBy('paymentDate', 'desc'));
    const unsubDues = onSnapshot(duesQuery, (snapshot) => {
      const duesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        paymentDate: (doc.data().paymentDate as Timestamp).toDate(),
      })) as DuesPayment[];
      setDues(duesData);
      setLoading(false);
    });

    return () => {
        unsubUsers();
        unsubDues();
    };
  }, []);

  const onSubmit = async (values: DuesFormValues) => {
    if (!staffInfo) {
        toast({ variant: 'destructive', title: "Gagal", description: "Informasi petugas tidak ditemukan." });
        return;
    }
    setIsSubmitting(true);
    const selectedUser = users.find(u => u.uid === values.userId);
    if (!selectedUser) {
        toast({ variant: 'destructive', title: "Gagal", description: "Data warga tidak ditemukan." });
        setIsSubmitting(false);
        return;
    }
    try {
      await addDoc(collection(db, 'dues'), {
        ...values,
        userName: selectedUser.displayName,
        paymentDate: serverTimestamp(),
        recordedBy: staffInfo.name,
        recordedById: staffInfo.id,
      });
      toast({ title: "Berhasil", description: "Pembayaran iuran berhasil dicatat." });
      form.reset();
    } catch (error) {
      toast({ variant: 'destructive', title: "Gagal", description: "Terjadi kesalahan saat mencatat iuran." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(amount);
  }

  return (
    <div className="grid lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-1">
            <Card>
                <CardHeader>
                    <CardTitle>Catat Iuran Warga</CardTitle>
                    <CardDescription>Masukkan data pembayaran iuran warga.</CardDescription>
                </CardHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)}>
                    <CardContent className="space-y-4">
                         <FormField control={form.control} name="userId" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Pilih Warga</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                        <SelectTrigger><SelectValue placeholder="Pilih nama warga..." /></SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {users.map(user => (
                                            <SelectItem key={user.uid} value={user.uid}>{user.displayName}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                         )} />
                        <div className="grid grid-cols-2 gap-4">
                            <FormField control={form.control} name="month" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Bulan</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                                     <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl>
                                        <SelectContent>
                                            {years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </div>
                         <FormField control={form.control} name="amount" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Jumlah (Rp)</FormLabel>
                                <FormControl><Input type="number" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="notes" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Catatan (Opsional)</FormLabel>
                                <FormControl><Textarea {...field} rows={2} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                    </CardContent>
                    <CardFooter>
                        <Button type="submit" className="w-full" disabled={isSubmitting}>
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Simpan Pembayaran
                        </Button>
                    </CardFooter>
                    </form>
                </Form>
            </Card>
        </div>
        <div className="lg:col-span-2">
            <Card>
                <CardHeader>
                    <CardTitle>Riwayat Iuran Tercatat</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="rounded-lg border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Tanggal Bayar</TableHead>
                                    <TableHead>Nama Warga</TableHead>
                                    <TableHead>Periode</TableHead>
                                    <TableHead>Jumlah</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    Array.from({ length: 5 }).map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                                        <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                                        <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                                        <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                                    </TableRow>
                                    ))
                                ) : dues.length > 0 ? (
                                    dues.map((due) => (
                                    <TableRow key={due.id}>
                                        <TableCell>{format(due.paymentDate, "PPP", { locale: id })}</TableCell>
                                        <TableCell className="font-medium">{due.userName}</TableCell>
                                        <TableCell>{due.month} {due.year}</TableCell>
                                        <TableCell>{formatCurrency(due.amount)}</TableCell>
                                    </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                    <TableCell colSpan={4} className="text-center h-24">
                                        Belum ada data iuran yang tercatat.
                                    </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    </div>
  );
}

    