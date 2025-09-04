
"use client";

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { db } from '@/lib/firebase/client';
import { collection, onSnapshot, addDoc, serverTimestamp, query, orderBy, getDocs, Timestamp, where, writeBatch, doc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Landmark } from 'lucide-react';
import type { AppUser } from '@/lib/types';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';

const months = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni", 
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];
const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, i) => (currentYear - 2 + i).toString());

const duesSchema = z.object({
  userId: z.string({ required_error: "Nama warga harus dipilih."}).min(1, "Nama warga harus dipilih dari daftar."),
  amount: z.coerce.number().min(1, "Jumlah iuran tidak boleh kosong."),
  month: z.string().min(1, "Bulan harus dipilih."),
  year: z.string().min(1, "Tahun harus dipilih."),
});

type DuesFormValues = z.infer<typeof duesSchema>;

export default function RecordDuesPage() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [staffInfo, setStaffInfo] = useState<{ id: string, name: string } | null>(null);
  const { toast } = useToast();

  const form = useForm<DuesFormValues>({
    resolver: zodResolver(duesSchema),
    defaultValues: { userId: '', amount: 0, month: months[new Date().getMonth()], year: currentYear.toString() },
  });
  
  useEffect(() => {
    const info = JSON.parse(localStorage.getItem('staffInfo') || '{}');
    if (info.id) {
        setStaffInfo(info);
    }
    
    const usersQuery = query(collection(db, "users"), orderBy("displayName", "asc"));
    const unsubUsers = onSnapshot(usersQuery, (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as AppUser));
      setUsers(usersData);
       setLoading(false);
    });

    return () => {
        unsubUsers();
    };
  }, []);

  const onSubmit = async (values: DuesFormValues) => {
    if (!staffInfo) {
        toast({ variant: 'destructive', title: "Gagal", description: "Informasi petugas tidak ditemukan." });
        return;
    }
    setIsSubmitting(true);
    
    const userToSave = users.find(u => u.uid === values.userId);
    
    if (!userToSave) {
        toast({ variant: 'destructive', title: "Gagal", description: "Warga tidak ditemukan. Silakan pilih dari daftar." });
        setIsSubmitting(false);
        return;
    }

    const q = query(
        collection(db, 'dues'),
        where('userId', '==', userToSave.uid),
        where('month', '==', values.month),
        where('year', '==', values.year)
    );
    const existingPayment = await getDocs(q);
    if (!existingPayment.empty) {
        toast({ variant: 'destructive', title: "Gagal", description: `Warga ini sudah membayar iuran untuk ${values.month} ${values.year}.` });
        setIsSubmitting(false);
        return;
    }

    try {
      const batch = writeBatch(db);

      // Create dues payment record
      const duesRef = doc(collection(db, 'dues'));
      batch.set(duesRef, {
        userId: userToSave.uid,
        userName: userToSave.displayName,
        amount: values.amount,
        month: values.month,
        year: values.year,
        paymentDate: serverTimestamp(),
        recordedBy: staffInfo.name,
        recordedById: staffInfo.id,
      });

      // Create corresponding financial transaction
      const financeRef = doc(collection(db, 'financial_transactions'));
      batch.set(financeRef, {
          type: 'income',
          description: `Iuran dari ${userToSave.displayName} (${values.month} ${values.year})`,
          amount: values.amount,
          category: 'Iuran Warga',
          date: serverTimestamp(),
          recordedBy: staffInfo.name,
          relatedId: duesRef.id,
      });

      await batch.commit();

      toast({ title: "Berhasil", description: "Pembayaran iuran dan transaksi keuangan berhasil dicatat." });
      form.reset({ userId: '', amount: 0, month: months[new Date().getMonth()], year: currentYear.toString() });
    } catch (error) {
      toast({ variant: 'destructive', title: "Gagal", description: "Terjadi kesalahan saat mencatat iuran." });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const formatNumberInput = (value: string) => {
    const numericValue = value.replace(/\D/g, '');
    if (!numericValue) return '';
    return new Intl.NumberFormat('id-ID').format(parseInt(numericValue, 10));
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Catat Iuran Warga</CardTitle>
        <CardDescription>Gunakan formulir ini untuk mencatat pembayaran iuran keamanan dari warga.</CardDescription>
      </CardHeader>
      {loading ? (
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
          <Skeleton className="h-10 w-full" />
          <CardFooter className="p-0 pt-4">
            <Skeleton className="h-10 w-full" />
          </CardFooter>
        </CardContent>
      ) : (
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="userId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nama Warga</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih nama warga" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {users.map((user) => (
                          <SelectItem key={user.uid} value={user.uid}>
                            {user.displayName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
                      placeholder="20.000"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={isSubmitting || loading}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Landmark className="mr-2 h-4 w-4" />}
              Simpan Pembayaran
            </Button>
          </CardFooter>
        </form>
      </Form>
      )}
    </Card>
  );
}
