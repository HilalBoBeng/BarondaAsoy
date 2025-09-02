
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
import { Loader2, ArrowLeft, Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { notFound } from 'next/navigation';

export default function UserDuesHistoryPage({ params }: { params: { userId: string } }) {
  const { userId } = params;
  const [user, setUser] = useState<AppUser | null>(null);
  const [payments, setPayments] = useState<DuesPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isNoteDialogOpen, setIsNoteDialogOpen] = useState(false);
  const [selectedNote, setSelectedNote] = useState<string | null>(null);

  const { toast } = useToast();

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      notFound();
      return;
    }

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

  const userPaymentHistory = useMemo(() => {
    return payments.sort((a, b) => {
      const timeA = (a.paymentDate as Timestamp)?.toMillis() || 0;
      const timeB = (b.paymentDate as Timestamp)?.toMillis() || 0;
      return timeB - timeA;
    });
  }, [payments]);
  
  const handleOpenNoteDialog = (note: string) => {
    setSelectedNote(note);
    setIsNoteDialogOpen(true);
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
  }

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
                  <TableHead>Catatan</TableHead>
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
                       <TableCell>
                         <Button
                            variant="outline"
                            size="icon"
                            disabled={!due.notes}
                            onClick={() => due.notes && handleOpenNoteDialog(due.notes)}
                            >
                            <Eye className="h-4 w-4" />
                            <span className="sr-only">Lihat Catatan</span>
                         </Button>
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
      
      <Dialog open={isNoteDialogOpen} onOpenChange={setIsNoteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Isi Catatan</DialogTitle>
          </DialogHeader>
          <div className="py-4 whitespace-pre-wrap">
            {selectedNote}
          </div>
          <DialogFooter>
            <Button onClick={() => setIsNoteDialogOpen(false)}>Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
