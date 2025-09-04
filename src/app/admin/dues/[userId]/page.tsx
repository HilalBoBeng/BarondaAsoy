
"use client";

import { useState, useEffect, useMemo } from 'react';
import { db } from '@/lib/firebase/client';
import { collection, onSnapshot, query, where, doc, Timestamp, deleteDoc, updateDoc, getDoc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import type { DuesPayment, AppUser } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Loader2, ArrowLeft, Eye, Edit, Trash } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { notFound, useParams } from 'next/navigation';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger, AlertDialogFooter } from '@/components/ui/alert-dialog';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const editDuesSchema = z.object({
  amount: z.coerce.number().min(1, "Jumlah iuran tidak boleh kosong."),
});

type EditDuesFormValues = z.infer<typeof editDuesSchema>;

const getAmountColor = (amount: number) => {
    if (amount <= 1000) return '#B3B6BB'; // abu-abu
    if (amount <= 2000) return '#8F9E91'; // abu-abu kehijauan
    if (amount <= 5000) return '#A47A45'; // cokelat
    if (amount <= 10000) return '#7B53A6'; // ungu
    if (amount <= 20000) return '#3AAA6D'; // hijau
    if (amount <= 50000) return '#2E78BC'; // biru
    if (amount <= 100000) return '#C62828';// merah
    return 'transparent'; // default
};

export default function UserDuesHistoryPage() {
  const params = useParams();
  const userId = params.userId as string;
  const [user, setUser] = useState<AppUser | null>(null);
  const [payments, setPayments] = useState<DuesPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [currentPayment, setCurrentPayment] = useState<DuesPayment | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { toast } = useToast();

  const form = useForm<EditDuesFormValues>({
    resolver: zodResolver(editDuesSchema),
  });

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      notFound();
      return;
    };

    setLoading(true);

    const fetchUserData = async () => {
      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const userData = { uid: userSnap.id, ...userSnap.data() } as AppUser;
        setUser(userData);
      } else {
        notFound();
      }
    };

    fetchUserData();

    const paymentsQuery = query(collection(db, 'dues'), where('userId', '==', userId));
    const unsubPayments = onSnapshot(paymentsQuery, (snapshot) => {
      const paymentsData = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data(),
        paymentDate: d.data().paymentDate, // Keep as Timestamp
      })) as DuesPayment[];
      setPayments(paymentsData);
      setLoading(false);
    });

    return () => {
      unsubPayments();
    };
  }, [userId]);
  
  useEffect(() => {
    if (currentPayment) {
        form.setValue("amount", currentPayment.amount);
    }
  }, [currentPayment, form]);

  const userPaymentHistory = useMemo(() => {
    return payments.sort((a, b) => {
      const timeA = (a.paymentDate as Timestamp)?.toMillis() || 0;
      const timeB = (b.paymentDate as Timestamp)?.toMillis() || 0;
      return timeB - timeA;
    });
  }, [payments]);

  const handleDelete = async (paymentId: string) => {
    try {
        await deleteDoc(doc(db, 'dues', paymentId));
        toast({ title: 'Berhasil', description: 'Data pembayaran berhasil dihapus.' });
    } catch (error) {
        toast({ variant: 'destructive', title: 'Gagal', description: 'Tidak dapat menghapus data pembayaran.' });
    }
  }

  const handleEditOpen = (payment: DuesPayment) => {
      setCurrentPayment(payment);
      setIsEditDialogOpen(true);
  }

  const onEditSubmit = async (values: EditDuesFormValues) => {
      if (!currentPayment) return;
      setIsSubmitting(true);
      try {
          const paymentRef = doc(db, 'dues', currentPayment.id);
          await updateDoc(paymentRef, { amount: values.amount });
          toast({ title: 'Berhasil', description: 'Jumlah iuran berhasil diperbarui.' });
          setIsEditDialogOpen(false);
          setCurrentPayment(null);
      } catch (error) {
          toast({ variant: 'destructive', title: 'Gagal', description: 'Tidak dapat memperbarui jumlah iuran.' });
      } finally {
          setIsSubmitting(false);
      }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
  }
  
    const formatNumberInput = (value: string) => {
        const numericValue = value.replace(/\D/g, '');
        if (!numericValue) return '';
        return new Intl.NumberFormat('id-ID').format(parseInt(numericValue, 10));
    };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Riwayat Pembayaran</CardTitle>
          <CardDescription>
            {loading ? <Skeleton className="h-5 w-32" /> : user?.displayName}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border max-h-[60vh] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal Bayar</TableHead>
                  <TableHead>Periode</TableHead>
                  <TableHead>Jumlah</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-5 w-full" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-full" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-full" /></TableCell>
                      <TableCell><Skeleton className="h-9 w-[90px] ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : userPaymentHistory.length > 0 ? (
                  userPaymentHistory.map(due => (
                    <TableRow key={due.id}>
                      <TableCell>{due.paymentDate instanceof Timestamp ? format(due.paymentDate.toDate(), "PPP", { locale: id }) : 'N/A'}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{due.month} {due.year}</Badge>
                      </TableCell>
                      <TableCell style={{ backgroundColor: `${getAmountColor(due.amount)}20` }}>{formatCurrency(due.amount)}</TableCell>
                      <TableCell className="text-right">
                         <div className="flex gap-2 justify-end">
                            <Button variant="outline" size="sm" onClick={() => handleEditOpen(due)}>
                                <Edit className="h-4 w-4" />
                            </Button>
                             <AlertDialog>
                                <AlertDialogTrigger asChild>
                                <Button variant="destructive" size="sm">
                                    <Trash className="h-4 w-4" />
                                </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Hapus Pembayaran?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                    Tindakan ini tidak dapat dibatalkan.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Batal</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDelete(due.id)}>Hapus</AlertDialogAction>
                                </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                         </div>
                      </TableCell>
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
        </CardContent>
      </Card>
      
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Jumlah Iuran</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onEditSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
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
                )}
              />
              <DialogFooter>
                <Button type="button" variant="secondary" onClick={() => setIsEditDialogOpen(false)}>Batal</Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
