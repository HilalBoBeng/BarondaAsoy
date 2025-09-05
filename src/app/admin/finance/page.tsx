
"use client";

import { useState, useEffect, useMemo } from 'react';
import { db } from '@/lib/firebase/client';
import { collection, onSnapshot, addDoc, serverTimestamp, query, orderBy, where, Timestamp } from 'firebase/firestore';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose, DialogBody } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Loader2, FileDown, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import type { FinancialTransaction, Staff } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';


const months = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];
const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, i) => (currentYear - 2 + i).toString());

const transactionSchema = z.object({
  type: z.enum(['income', 'expense'], { required_error: "Tipe transaksi harus dipilih." }),
  description: z.string().min(1, "Deskripsi tidak boleh kosong."),
  amount: z.coerce.number().min(1, "Jumlah tidak boleh kosong."),
  category: z.string().optional(),
  otherCategory: z.string().optional(),
}).refine(data => {
    if (data.type === 'expense' && data.category === 'Lainnya') {
        return !!data.otherCategory && data.otherCategory.length > 0;
    }
    return true;
}, {
    message: "Deskripsi kategori lainnya harus diisi.",
    path: ["otherCategory"],
});

type TransactionFormValues = z.infer<typeof transactionSchema>;

export default function FinancePage() {
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [adminInfo, setAdminInfo] = useState<Staff | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>(months[new Date().getMonth()]);
  const [selectedYear, setSelectedYear] = useState<string>(currentYear.toString());
  const { toast } = useToast();

  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
        type: undefined,
        description: '',
        amount: 0,
        category: '',
        otherCategory: ''
    }
  });
  const transactionType = form.watch('type');
  const expenseCategory = form.watch('category');

  useEffect(() => {
    const info = JSON.parse(localStorage.getItem('staffInfo') || '{}');
    if (info) {
        setAdminInfo(info);
    }
    
    const startOfMonth = new Date(parseInt(selectedYear), months.indexOf(selectedMonth), 1);
    const endOfMonth = new Date(parseInt(selectedYear), months.indexOf(selectedMonth) + 1, 0, 23, 59, 59);

    const q = query(
        collection(db, 'financial_transactions'),
        where('date', '>=', Timestamp.fromDate(startOfMonth)),
        where('date', '<=', Timestamp.fromDate(endOfMonth)),
        orderBy('date', 'desc')
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            date: (doc.data().date as Timestamp).toDate()
        })) as FinancialTransaction[];
        setTransactions(data);
        setLoading(false);
    });

    return () => unsubscribe();
  }, [selectedMonth, selectedYear]);

  const { totalIncome, totalExpense, finalBalance } = useMemo(() => {
      const income = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
      const expense = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
      return { totalIncome: income, totalExpense: expense, finalBalance: income - expense };
  }, [transactions]);

  const onSubmit = async (values: TransactionFormValues) => {
    if (!adminInfo) {
      toast({ variant: 'destructive', title: 'Gagal', description: 'Informasi admin tidak ditemukan.' });
      return;
    }
    setIsSubmitting(true);
    try {
      const category = values.type === 'income' 
        ? 'Iuran Warga' 
        : (values.category === 'Lainnya' ? values.otherCategory : values.category);

      await addDoc(collection(db, 'financial_transactions'), {
        type: values.type,
        description: values.description,
        amount: values.amount,
        category,
        date: serverTimestamp(),
        recordedBy: adminInfo.name,
      });
      toast({ title: 'Berhasil', description: 'Transaksi berhasil dicatat.' });
      setIsDialogOpen(false);
      form.reset({
        type: undefined,
        description: '',
        amount: 0,
        category: '',
        otherCategory: ''
    });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Gagal', description: 'Gagal mencatat transaksi.' });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const formatCurrency = (value: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(value);
  
  const handleExport = () => {
    if (transactions.length === 0) {
      toast({ variant: 'destructive', title: 'Tidak ada data', description: 'Tidak ada data untuk diekspor.' });
      return;
    }
    const headers = ["Tanggal", "Tipe", "Kategori", "Deskripsi", "Jumlah"];
    const csvContent = [
      headers.join(','),
      ...transactions.map(t => [
        format(t.date as Date, "yyyy-MM-dd HH:mm"),
        t.type === 'income' ? 'Pemasukan' : 'Pengeluaran',
        `"${t.category}"`,
        `"${t.description}"`,
        t.amount
      ].join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `laporan_keuangan_${selectedMonth}_${selectedYear}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const canAddTransaction = adminInfo?.role === 'bendahara';

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <div>
              <CardTitle>Manajemen Keuangan</CardTitle>
              <CardDescription>Lacak semua pemasukan dan pengeluaran dana operasional.</CardDescription>
            </div>
            <div className="flex gap-2">
                {canAddTransaction && (
                    <Button onClick={() => setIsDialogOpen(true)}><PlusCircle className="mr-2 h-4 w-4" /> Tambah Transaksi</Button>
                )}
                <Button variant="outline" onClick={handleExport}><FileDown className="mr-2 h-4 w-4" /> Ekspor</Button>
            </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Total Pemasukan</CardTitle>
                    <ArrowUpRight className="h-4 w-4 text-green-500"/>
                </CardHeader>
                <CardContent>
                    {loading ? <Skeleton className="h-8 w-3/4" /> : <div className="text-2xl font-bold text-green-600">{formatCurrency(totalIncome)}</div>}
                </CardContent>
            </Card>
             <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Total Pengeluaran</CardTitle>
                     <ArrowDownLeft className="h-4 w-4 text-red-500"/>
                </CardHeader>
                <CardContent>
                    {loading ? <Skeleton className="h-8 w-3/4" /> : <div className="text-2xl font-bold text-red-600">{formatCurrency(totalExpense)}</div>}
                </CardContent>
            </Card>
             <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Saldo Akhir</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? <Skeleton className="h-8 w-3/4" /> : <div className="text-2xl font-bold">{formatCurrency(finalBalance)}</div>}
                </CardContent>
            </Card>
        </div>
        
        <div className="flex gap-2 mb-4">
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-full sm:w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>{months.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-full sm:w-[100px]"><SelectValue /></SelectTrigger>
              <SelectContent>{years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
            </Select>
        </div>

        <div className="rounded-lg border">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Deskripsi</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead className="text-right">Jumlah</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}><TableCell colSpan={4}><Skeleton className="h-5 w-full" /></TableCell></TableRow>
                  ))
                ) : transactions.length > 0 ? (
                  transactions.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell>{format(t.date as Date, 'd MMM yyyy, HH:mm', { locale: id })}</TableCell>
                      <TableCell>{t.description}</TableCell>
                      <TableCell><Badge variant="outline">{t.category}</Badge></TableCell>
                      <TableCell className={cn("text-right font-semibold", t.type === 'income' ? 'text-green-600' : 'text-red-600')}>
                        {t.type === 'income' ? '+' : '-'} {formatCurrency(t.amount)}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow><TableCell colSpan={4} className="h-24 text-center">Tidak ada transaksi pada periode ini.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
              <DialogHeader>
                  <DialogTitle>Tambah Transaksi Baru</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)}>
                      <DialogBody className="space-y-4">
                          <FormField control={form.control} name="type" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Tipe Transaksi</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl><SelectTrigger><SelectValue placeholder="Pilih tipe" /></SelectTrigger></FormControl>
                                    <SelectContent>
                                        <SelectItem value="income">Pemasukan</SelectItem>
                                        <SelectItem value="expense">Pengeluaran</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                          )} />
                          <FormField control={form.control} name="description" render={({ field }) => (
                            <FormItem><FormLabel>Deskripsi</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                          )} />
                          <FormField control={form.control} name="amount" render={({ field }) => (
                            <FormItem><FormLabel>Jumlah (Rp)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                          )} />
                          {transactionType === 'expense' && (
                              <FormField control={form.control} name="category" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Kategori Pengeluaran</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl><SelectTrigger><SelectValue placeholder="Pilih kategori" /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            <SelectItem value="Pembelian Peralatan">Pembelian Peralatan</SelectItem>
                                            <SelectItem value="Konsumsi">Konsumsi</SelectItem>
                                            <SelectItem value="Honor Petugas">Honor Petugas</SelectItem>
                                            <SelectItem value="Lainnya">Lainnya</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                              )} />
                          )}
                          {transactionType === 'expense' && expenseCategory === 'Lainnya' && (
                             <FormField control={form.control} name="otherCategory" render={({ field }) => (
                                <FormItem><FormLabel>Sebutkan Kategori Lainnya</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                             )} />
                          )}
                      </DialogBody>
                      <DialogFooter>
                          <DialogClose asChild><Button type="button" variant="secondary">Batal</Button></DialogClose>
                          <Button type="submit" disabled={isSubmitting}>
                              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                              Simpan Transaksi
                          </Button>
                      </DialogFooter>
                  </form>
              </Form>
          </DialogContent>
      </Dialog>
    </Card>
  );
}
