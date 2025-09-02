
"use client";

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase/client';
import { collection, onSnapshot, doc, updateDoc, deleteDoc, query, orderBy, getDocs, limit, startAfter, type QueryDocumentSnapshot, type DocumentData, increment, where, endBefore, limitToLast, addDoc, serverTimestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Trash, CheckCircle, AlertTriangle, User, Calendar as CalendarIcon, UserCheck } from 'lucide-react';
import type { Report, Reply } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose, DialogFooter } from '@/components/ui/dialog';
import { formatDistanceToNow } from 'date-fns';
import { id } from 'date-fns/locale';

const REPORTS_PER_PAGE = 5;
type ReportStatus = 'new' | 'in_progress' | 'resolved';

export default function ReportsAdminPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const [currentPage, setCurrentPage] = useState(1);
  const [firstVisible, setFirstVisible] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [lastVisible, setLastVisible] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [isLastPage, setIsLastPage] = useState(false);

  const fetchReports = async (page: number, direction: 'next' | 'prev' | 'initial' = 'initial') => {
    setLoading(true);
    try {
      let q;
      const reportsRef = collection(db, "reports");

      if (direction === 'next' && lastVisible) {
        q = query(reportsRef, orderBy('createdAt', 'desc'), startAfter(lastVisible), limit(REPORTS_PER_PAGE));
      } else if (direction === 'prev' && firstVisible) {
        q = query(reportsRef, orderBy('createdAt', 'desc'), endBefore(firstVisible), limitToLast(REPORTS_PER_PAGE));
      } else {
        q = query(reportsRef, orderBy('createdAt', 'desc'), limit(REPORTS_PER_PAGE));
      }
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        if (snapshot.empty && direction !== 'initial') {
            setIsLastPage(true);
            setReports([]);
            setLoading(false);
            if (direction === 'next') setCurrentPage(prev => prev > 1 ? prev -1 : 1);
            return;
        }

        const reportsData = snapshot.docs.map(doc => {
            const data = doc.data();
            const repliesObject = data.replies || {};
            const repliesArray = Object.values(repliesObject).sort((a: any, b: any) => b.timestamp.toMillis() - a.timestamp.toMillis());
            return {
                id: doc.id,
                ...data,
                createdAt: data.createdAt?.toDate(),
                replies: repliesArray,
            } as Report;
        });

        setReports(reportsData);
        setFirstVisible(snapshot.docs[0] || null);
        setLastVisible(snapshot.docs[snapshot.docs.length - 1] || null);
        setIsLastPage(snapshot.docs.length < REPORTS_PER_PAGE);
        setLoading(false);
      }, (error) => {
        console.error("Error fetching reports:", error);
        toast({ variant: 'destructive', title: 'Gagal Memuat Laporan' });
        setLoading(false);
      });
      return unsubscribe;

    } catch (error) {
        console.error("Error fetching reports:", error);
        toast({ variant: 'destructive', title: 'Gagal Memuat Laporan' });
        setLoading(false);
    }
  };

  useEffect(() => {
    const unsub = fetchReports(1);
    return () => { unsub.then(u => u && u()) };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goToNextPage = () => {
    const newPage = currentPage + 1;
    setCurrentPage(newPage);
    fetchReports(newPage, 'next');
  };

  const goToPrevPage = () => {
    if (currentPage === 1) return;
    const newPage = currentPage - 1;
    setCurrentPage(newPage);
    fetchReports(newPage, 'prev');
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'reports', id));
      toast({ title: "Berhasil", description: "Laporan berhasil dihapus." });
    } catch (error) {
      toast({ variant: 'destructive', title: "Gagal", description: "Tidak dapat menghapus laporan." });
    }
  };
  
  const ReplyCard = ({ reply }: { reply: Reply }) => (
    <Card className="mt-2 bg-muted/50">
        <CardContent className="p-3">
            <div className="flex justify-between items-start">
                 <p className="text-xs text-foreground/80 break-words flex-grow pr-2">
                    {reply.message}
                </p>
                <div className="flex-shrink-0">
                    <Badge variant={reply.replierRole === 'Admin' ? 'default' : 'secondary'}>{reply.replierRole}</Badge>
                </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
                {formatDistanceToNow( (reply.timestamp as any)?.toDate() || new Date(), { addSuffix: true, locale: id })}
            </p>
        </CardContent>
    </Card>
  );


  const ThreatLevelBadge = ({ level }: { level: 'low' | 'medium' | 'high' | undefined }) => {
    if (!level) return <Badge variant="secondary">N/A</Badge>;
    const config = {
      low: { icon: CheckCircle, className: 'bg-green-100 text-green-800', label: 'Rendah' },
      medium: { icon: AlertTriangle, className: 'bg-yellow-100 text-yellow-800', label: 'Sedang' },
      high: { icon: AlertTriangle, variant: 'destructive', label: 'Tinggi' },
    } as const;
    const { icon: Icon, variant, className, label } = config[level];
    return <Badge variant={variant || 'secondary'} className={className}>
      <Icon className="mr-1 h-3 w-3" />
      {label}
    </Badge>;
  }
  
  const statusDisplay: Record<ReportStatus, string> = {
    new: 'Baru',
    in_progress: 'Ditangani',
    resolved: 'Selesai'
  };

  const renderActions = (report: Report) => {
    if (report.status === 'resolved') {
      return (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm"><Trash className="h-4 w-4" /></Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Anda yakin?</AlertDialogTitle>
              <AlertDialogDescription>Tindakan ini akan menghapus laporan secara permanen.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Batal</AlertDialogCancel>
              <AlertDialogAction onClick={() => handleDelete(report.id)}>Hapus</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      );
    }
    return null;
  }
  
  return (
    <>
    <Card>
      <CardHeader>
        <CardTitle>Manajemen Laporan Masuk</CardTitle>
        <CardDescription>Tanggapi, ubah status, dan kelola laporan dari warga.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="sm:hidden space-y-4">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-64 w-full" />)
          ) : reports.length > 0 ? (
            reports.map((report) => (
              <Card key={report.id}>
                <CardHeader>
                    <CardTitle className="text-base break-words">{report.reportText}</CardTitle>
                    <CardDescription className="flex flex-col gap-2 pt-2">
                        <span className="flex items-center gap-2"><User className="h-4 w-4" />{report.reporterName}</span>
                        <span className="flex items-center gap-2"><CalendarIcon className="h-4 w-4" />{new Date(report.createdAt as Date).toLocaleString('id-ID')}</span>
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">Ancaman:</span>
                         <ThreatLevelBadge level={report.triageResult?.threatLevel} />
                    </div>
                     {report.handlerName && (
                        <div className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                            <UserCheck className="h-3 w-3" /> Ditangani oleh: <strong>{report.handlerName}</strong>
                        </div>
                    )}
                     {report.replies && report.replies.length > 0 && (
                        <div className="mt-4">
                            <h4 className="text-xs font-semibold mb-1">Balasan:</h4>
                            {(report.replies as Reply[]).map((reply, index) => (
                                <ReplyCard key={index} reply={reply} />
                            ))}
                        </div>
                    )}
                </CardContent>
                <CardFooter className="flex-col items-stretch">
                   <div className="flex flex-col sm:flex-row gap-2 items-stretch mt-4 sm:mt-0">
                      {renderActions(report)}
                   </div>
                </CardFooter>
              </Card>
            ))
          ) : (
             <div className="text-center py-12 text-muted-foreground">Belum ada laporan masuk.</div>
          )}
        </div>
      
        <div className="hidden sm:block rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tanggal</TableHead>
                <TableHead>Pelapor</TableHead>
                <TableHead>Laporan & Balasan</TableHead>
                <TableHead>Penanggung Jawab</TableHead>
                <TableHead>Ancaman</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[150px] text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-full" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-8 w-[100px] ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : reports.length > 0 ? (
                reports.map((report) => (
                  <TableRow key={report.id}>
                    <TableCell>{new Date(report.createdAt as Date).toLocaleString('id-ID')}</TableCell>
                    <TableCell className="font-medium">{report.reporterName}</TableCell>
                    <TableCell className="max-w-xs">
                        <p className="truncate font-medium">{report.reportText}</p>
                        {report.replies && report.replies.length > 0 && (
                             <div className="mt-2">
                                {(report.replies as Reply[]).map((reply, index) => (
                                   <div key={index} className="text-xs text-muted-foreground border-l-2 pl-2">
                                       <span className="font-bold">{reply.replierRole}: </span>
                                       <span className="italic">"{reply.message}"</span>
                                   </div>
                                ))}
                            </div>
                        )}
                    </TableCell>
                    <TableCell>{report.handlerName || '-'}</TableCell>
                    <TableCell>
                       <ThreatLevelBadge level={report.triageResult?.threatLevel} />
                    </TableCell>
                    <TableCell>
                      <Badge variant={report.status === 'resolved' ? 'secondary' : report.status === 'in_progress' ? 'default' : 'destructive'}>
                        {statusDisplay[report.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                           {renderActions(report)}
                        </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center h-24">
                    Belum ada laporan masuk.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
      <CardFooter>
        <div className="flex items-center justify-end space-x-2 w-full">
            <Button
                variant="outline"
                size="sm"
                onClick={goToPrevPage}
                disabled={currentPage === 1 || loading}
            >
                Sebelumnya
            </Button>
            <span className="text-sm text-muted-foreground">Halaman {currentPage}</span>
            <Button
                variant="outline"
                size="sm"
                onClick={goToNextPage}
                disabled={isLastPage || loading}
            >
                Berikutnya
            </Button>
        </div>
      </CardFooter>
    </Card>
    </>
  );
}
