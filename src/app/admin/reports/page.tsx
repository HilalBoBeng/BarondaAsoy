
"use client";

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase/client';
import { collection, onSnapshot, doc, updateDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Trash, CheckCircle, AlertTriangle, HelpCircle, Calendar, User } from 'lucide-react';
import type { Report } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';

type ReportStatus = 'new' | 'in_progress' | 'resolved';

const statusMap: Record<ReportStatus, string> = {
  new: 'Baru',
  in_progress: 'Ditangani',
  resolved: 'Selesai',
};

export default function ReportsAdminPage() {
  const [reports, setReports] = useState<(Report & { status: ReportStatus })[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const q = query(collection(db, 'reports'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const reportsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        status: doc.data().status || 'new',
      })) as (Report & { status: ReportStatus })[];
      setReports(reportsData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching reports:", error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleStatusChange = async (id: string, status: ReportStatus) => {
    try {
      const docRef = doc(db, 'reports', id);
      await updateDoc(docRef, { status });
      toast({ title: "Berhasil", description: "Status laporan berhasil diperbarui." });
    } catch (error) {
      toast({ variant: 'destructive', title: "Gagal", description: "Terjadi kesalahan saat memperbarui status." });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'reports', id));
      toast({ title: "Berhasil", description: "Laporan berhasil dihapus." });
    } catch (error) {
      toast({ variant: 'destructive', title: "Gagal", description: "Tidak dapat menghapus laporan." });
    }
  };
  
  const ThreatLevelIcon = ({ level }: {level: 'low' | 'medium' | 'high' | undefined}) => {
      if (!level) return <HelpCircle className="h-4 w-4 text-muted-foreground" />;
      const config = {
          low: { icon: CheckCircle, className: 'text-green-500'},
          medium: { icon: AlertTriangle, className: 'text-yellow-500' },
          high: { icon: AlertTriangle, className: 'text-red-500' },
      };
      const { icon: Icon, className } = config[level];
      return <Icon className={`h-4 w-4 ${className}`} />
  }

  const renderStatusChanger = (report: Report & { status: ReportStatus }) => (
     <Select value={report.status} onValueChange={(value) => handleStatusChange(report.id, value as ReportStatus)}>
        <SelectTrigger className="w-full sm:w-[150px]">
          <SelectValue placeholder="Ubah Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="new">
            <Badge variant="destructive" className="w-full justify-center">Baru</Badge>
          </SelectItem>
          <SelectItem value="in_progress">
            <Badge variant="default" className="w-full justify-center">Ditangani</Badge>
          </SelectItem>
           <SelectItem value="resolved">
            <Badge variant="secondary" className="w-full justify-center">Selesai</Badge>
          </SelectItem>
        </SelectContent>
      </Select>
  );

  const renderDeleteButton = (report: Report & { status: ReportStatus }) => (
      report.status === 'resolved' && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="icon"><Trash className="h-4 w-4" /></Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Anda yakin?</AlertDialogTitle>
              <AlertDialogDescription>
                Tindakan ini akan menghapus laporan secara permanen.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Batal</AlertDialogCancel>
              <AlertDialogAction onClick={() => handleDelete(report.id)}>Hapus</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Manajemen Laporan Masuk</CardTitle>
        <CardDescription>Tanggapi, ubah status, dan kelola laporan dari warga.</CardDescription>
      </CardHeader>
      <CardContent>
         {/* Mobile View */}
        <div className="sm:hidden space-y-4">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-48 w-full" />)
          ) : reports.length > 0 ? (
            reports.map((report) => (
              <Card key={report.id}>
                <CardHeader>
                    <CardTitle className="text-base break-words">{report.reportText}</CardTitle>
                    <CardDescription className="flex flex-col gap-2 pt-2">
                        <span className="flex items-center gap-2"><User className="h-4 w-4" />{report.reporterName}</span>
                        <span className="flex items-center gap-2"><Calendar className="h-4 w-4" />{new Date(report.createdAt as Date).toLocaleString('id-ID')}</span>
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">Ancaman:</span>
                         <Badge variant={report.triageResult?.threatLevel === 'high' ? 'destructive' : 'secondary'} className="capitalize">
                            <ThreatLevelIcon level={report.triageResult?.threatLevel} />
                            <span className="ml-2">{report.triageResult?.threatLevel || 'N/A'}</span>
                        </Badge>
                    </div>
                     <div className="space-y-2">
                        <span className="font-semibold text-sm">Status:</span>
                        {renderStatusChanger(report)}
                    </div>
                </CardContent>
                <CardFooter className="justify-end">
                  {renderDeleteButton(report)}
                </CardFooter>
              </Card>
            ))
          ) : (
             <div className="text-center py-12 text-muted-foreground">Belum ada laporan masuk.</div>
          )}
        </div>
      
        {/* Desktop View */}
        <div className="hidden sm:block rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tanggal</TableHead>
                <TableHead>Pelapor</TableHead>
                <TableHead>Laporan</TableHead>
                <TableHead>Ancaman</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-full" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-32" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-8 w-10 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : reports.length > 0 ? (
                reports.map((report) => (
                  <TableRow key={report.id}>
                    <TableCell>{new Date(report.createdAt as Date).toLocaleString('id-ID')}</TableCell>
                    <TableCell className="font-medium">{report.reporterName}</TableCell>
                    <TableCell className="max-w-xs truncate">{report.reportText}</TableCell>
                    <TableCell>
                        <Badge variant={report.triageResult?.threatLevel === 'high' ? 'destructive' : 'secondary'} className="capitalize">
                            <ThreatLevelIcon level={report.triageResult?.threatLevel} />
                            <span className="ml-2">{report.triageResult?.threatLevel || 'N/A'}</span>
                        </Badge>
                    </TableCell>
                    <TableCell>
                      {renderStatusChanger(report)}
                    </TableCell>
                    <TableCell className="text-right">
                      {renderDeleteButton(report)}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center h-24">
                    Belum ada laporan masuk.
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

    