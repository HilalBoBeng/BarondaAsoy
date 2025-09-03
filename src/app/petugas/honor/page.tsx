
"use client";

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase/client';
import { collection, onSnapshot, query, where, Timestamp, orderBy } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import type { Honorarium } from '@/lib/types';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Banknote } from 'lucide-react';

const statusConfig: Record<Honorarium['status'], { className: string }> = {
    'Dibayarkan': { className: 'bg-green-100 text-green-800' },
    'Tertunda': { className: 'bg-yellow-100 text-yellow-800' },
    'Dipotong': { className: 'bg-orange-100 text-orange-800' },
    'Batal': { className: 'bg-red-100 text-red-800' },
};

export default function HonorariumPetugasPage() {
  const [honorariums, setHonorariums] = useState<Honorarium[]>([]);
  const [loading, setLoading] = useState(true);
  const [staffId, setStaffId] = useState<string | null>(null);

  useEffect(() => {
    const staffInfo = JSON.parse(localStorage.getItem('staffInfo') || '{}');
    if (staffInfo.id) {
      setStaffId(staffInfo.id);
    } else {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!staffId) return;

    const honorQuery = query(
      collection(db, 'honorariums'),
      where('staffId', '==', staffId),
      orderBy('issueDate', 'desc')
    );

    const unsubscribe = onSnapshot(honorQuery, (snapshot) => {
      setHonorariums(snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        issueDate: (doc.data().issueDate as Timestamp).toDate(),
      } as Honorarium)));
      setLoading(false);
    });

    return () => unsubscribe();
  }, [staffId]);

  const formatCurrency = (value: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(value);
  
  const renderMobileCards = () => (
    <div className="space-y-4 sm:hidden">
        {honorariums.map((h) => (
            <Card key={h.id}>
                <CardHeader className="pb-2">
                     <div className="flex justify-between items-start">
                        <CardTitle className="text-base">{h.period}</CardTitle>
                        <Badge variant="secondary" className={cn(statusConfig[h.status].className)}>{h.status}</Badge>
                     </div>
                     <CardDescription>{format(h.issueDate as Date, "PPP", { locale: id })}</CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-lg font-bold text-primary">{formatCurrency(h.amount)}</p>
                    {h.notes && <p className="text-xs text-muted-foreground mt-2">Catatan: {h.notes}</p>}
                </CardContent>
            </Card>
        ))}
    </div>
  )

  const renderDesktopTable = () => (
    <div className="rounded-lg border hidden sm:block">
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Periode</TableHead>
                    <TableHead>Jumlah</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Catatan</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {honorariums.map((h) => (
                    <TableRow key={h.id}>
                        <TableCell>{format(h.issueDate as Date, "PPP", { locale: id })}</TableCell>
                        <TableCell>{h.period}</TableCell>
                        <TableCell>{formatCurrency(h.amount)}</TableCell>
                        <TableCell><Badge variant="secondary" className={cn(statusConfig[h.status].className)}>{h.status}</Badge></TableCell>
                        <TableCell className="max-w-xs truncate">{h.notes || '-'}</TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    </div>
  )


  return (
    <Card>
      <CardHeader>
        <CardTitle>Riwayat Honor Saya</CardTitle>
        <CardDescription>Berikut adalah daftar honor yang telah Anda terima.</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
            <div className="space-y-4">
                 {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
            </div>
        ) : honorariums.length > 0 ? (
          <>
            {renderMobileCards()}
            {renderDesktopTable()}
          </>
        ) : (
          <div className="text-center py-12 text-muted-foreground flex flex-col items-center">
            <Banknote className="h-10 w-10 mb-2"/>
            <p>Anda belum memiliki riwayat honor.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
