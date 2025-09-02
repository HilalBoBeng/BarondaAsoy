
"use client";

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase/client';
import { collection, onSnapshot, query, orderBy, Timestamp } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import type { DuesPayment } from '@/lib/types';
import { Badge } from '@/components/ui/badge';

export default function DuesAdminPage() {
  const [dues, setDues] = useState<DuesPayment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'dues'), orderBy('paymentDate', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const duesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        paymentDate: (doc.data().paymentDate as Timestamp).toDate(),
      })) as DuesPayment[];
      setDues(duesData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching dues:", error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(amount);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Riwayat Iuran Warga</CardTitle>
        <CardDescription>Lihat semua data pembayaran iuran yang telah dicatat oleh petugas.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tanggal Bayar</TableHead>
                <TableHead>Nama Warga</TableHead>
                <TableHead>Periode Iuran</TableHead>
                <TableHead>Jumlah</TableHead>
                <TableHead>Dicatat Oleh</TableHead>
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
                    <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                  </TableRow>
                ))
              ) : dues.length > 0 ? (
                dues.map((due) => (
                  <TableRow key={due.id}>
                    <TableCell>{format(due.paymentDate, "PPP", { locale: id })}</TableCell>
                    <TableCell className="font-medium">{due.userName}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{due.month} {due.year}</Badge>
                    </TableCell>
                    <TableCell>{formatCurrency(due.amount)}</TableCell>
                    <TableCell>{due.recordedBy}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center h-24">
                    Belum ada data iuran yang tercatat.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
