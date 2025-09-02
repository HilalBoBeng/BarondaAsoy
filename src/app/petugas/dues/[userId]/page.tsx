
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
import { Loader2, Edit, Trash, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger, AlertDialogFooter } from '@/components/ui/alert-dialog';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import Link from 'next/link';
import { notFound } from 'next/navigation';

const editDuesSchema = z.object({
  amount: z.coerce.number().min(1, "Jumlah iuran tidak boleh kosong."),
  notes: z.string().optional(),
});
type EditDuesFormValues = z.infer<typeof editDuesSchema>;

export default function UserDuesHistoryPage({ params }: { params: { userId: string } }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [payments, setPayments] = useState<DuesPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [currentDue, setCurrentDue] = useState<DuesPayment | null>(null);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  const { toast } = useToast();
  const editForm = useForm<EditDuesFormValues>({
    resolver: zodResolver(editDuesSchema),
  });

  useEffect(() => {
    const userId = params.userId;
    if (!userId) return;

    setLoading(true);
    const fetchUserData = async () => {
      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const userData = { uid: userSnap.id, ...userSnap.data() } as AppUser;
        setUser(userData);
        if (typeof window !== 'undefined') {
          localStorage.setItem(`userName-${userId}`, userData.displayName || 'Warga');
        }
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
      if (typeof window !== 'undefined') {
        localStorage.removeItem(`userName-${params.userId}`);
      }
    };
  }, [params.userId]);

  const userPaymentHistory = useMemo(() => {
    return payments.sort((a, b) => {
      const timeA = (a.paymentDate as Timestamp)?.toMillis() || 0;
      const timeB = (b.paymentDate as Timestamp)?.toMillis() || 0;
      return timeB - timeA;
    });
  }, [payments]);

  const handleOpenEditDialog = (due: DuesPayment) => {
    setCurrentDue(due);
    editForm.reset({
      amount: due.amount,
      notes: due.notes,
    });
    setIsEditDialogOpen(true);
  };

  const handleEditSubmit = async (values: EditDuesFormValues) => {
    if (!currentDue) return;
    setIsSubmittingEdit(true);
    try {
      const dueRef = doc(db, 'dues', currentDue.id);
      await updateDoc(dueRef, {
        amount: values.amount,
        notes: values.notes || '',
      });
      toast({ title: "Berhasil", description: "Data iuran berhasil diperbarui." });
      setPayments(prev => prev.map(p => p.id === currentDue.id ? { ...p, ...values } : p));
      setIsEditDialogOpen(false);
      setCurrentDue(null);
    } catch (error) {
      toast({ variant: 'destructive', title: "Gagal", description: "Gagal memperbarui data iuran." });
    } finally {
      setIsSubmittingEdit(false);
    }
  }

  const handleDeleteDue = async (dueId: string) => {
    try {
      await deleteDoc(doc(db, 'dues', dueId));
      toast({ title: "Berhasil", description: "Data iuran berhasil dihapus." });
      setPayments(prev => prev.filter(p => p.id !== dueId));
    } catch (error) {
      toast({ variant: 'destructive', title: "Gagal", description: "Gagal menghapus data iuran." });
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
  }

  return (
    <>
      <Card>
        <CardHeader>
           <Button variant="outline" size="sm" className="w-fit" asChild>
              <Link href="/petugas/dues"><ArrowLeft className="mr-2 h-4 w-4" /> Kembali</Link>
          </Button>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border max-h-[60vh] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal Bayar</TableHead>
                  <TableHead>Periode</TableHead>
                  <TableHead>Jumlah</TableHead>
                  <TableHead>Dicatat Oleh</TableHead>
                  <TableHead>Catatan</TableHead>
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
                      <TableCell><Skeleton className="h-5 w-full" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-full" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-full" /></TableCell>
                    </TableRow>
                  ))
                ) : userPaymentHistory.length > 0 ? (
                  userPaymentHistory.map(due => (
                    <TableRow key={due.id}>
                      <TableCell>{due.paymentDate instanceof Timestamp ? format(due.paymentDate.toDate(), "PPP", { locale: id }) : 'N/A'}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{due.month} {due.year}</Badge>
                      </TableCell>
                      <TableCell>{formatCurrency(due.amount)}</TableCell>
                      <TableCell>{due.recordedBy}</TableCell>
                      <TableCell className="max-w-xs truncate">{due.notes || '-'}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          <Button variant="outline" size="icon" onClick={() => handleOpenEditDialog(due)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="destructive" size="icon"><Trash className="h-4 w-4" /></Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Hapus Catatan Iuran?</AlertDialogTitle>
                                <AlertDialogDescription>Tindakan ini tidak dapat dibatalkan.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Batal</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteDue(due.id)}>Hapus</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
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
            <DialogTitle>Edit Iuran</DialogTitle>
            <CardDescription>
              Mengedit iuran untuk {currentDue?.userName} periode {currentDue?.month} {currentDue?.year}.
            </CardDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(handleEditSubmit)} className="space-y-4 pt-4">
              <FormField
                control={editForm.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Jumlah (Rp)</FormLabel>
                    <FormControl><Input type="number" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Catatan (Opsional)</FormLabel>
                    <FormControl><Textarea {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="secondary">Batal</Button>
                </DialogClose>
                <Button type="submit" disabled={isSubmittingEdit}>
                  {isSubmittingEdit ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
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
