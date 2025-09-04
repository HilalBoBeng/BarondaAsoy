
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
import { Trash, CheckCircle, AlertTriangle, User, Calendar as CalendarIcon, UserCheck, X } from 'lucide-react';
import type { Report, Reply } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose, DialogFooter, DialogBody, DialogDescription } from '@/components/ui/dialog';
import { formatDistanceToNow } from 'date-fns';
import { id } from 'date-fns/locale';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const REPORTS_PER_PAGE = 5;
type ReportStatus = 'new' | 'in_progress' | 'resolved';

export default function ReportsAdminPage() {
  const [allReports, setAllReports] = useState<Report[]>([]);
  const [paginatedReports, setPaginatedReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  
  const [threatFilter, setThreatFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const q = query(collection(db, "reports"), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
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
        setAllReports(reportsData);
        setLoading(false);
      }, (error) => {
        console.error("Error fetching reports:", error);
        toast({ variant: 'destructive', title: 'Gagal Memuat Laporan' });
        setLoading(false);
      });
      return unsubscribe;
  }, [toast]);
  
  useEffect(() => {
    let filtered = allReports;

    if (threatFilter !== 'all') {
        filtered = filtered.filter(r => r.triageResult?.threatLevel === threatFilter);
    }
    
    const start = (currentPage - 1) * REPORTS_PER_PAGE;
    const end = start + REPORTS_PER_PAGE;
    setPaginatedReports(filtered.slice(start, end));

  }, [allReports, threatFilter, currentPage]);


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
         <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <div>
                 <CardTitle>Manajemen Laporan Masuk</CardTitle>
                <CardDescription>Tanggapi, ubah status, dan kelola laporan dari warga.</CardDescription>
            </div>
             <div className="flex flex-wrap items-center gap-2">
                 <Select value={threatFilter} onValueChange={setThreatFilter}>
                    <SelectTrigger className="w-full sm:w-auto">
                        <SelectValue placeholder="Filter ancaman" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Semua Ancaman</SelectItem>
                        <SelectItem value="high">Ancaman Tinggi</SelectItem>
                        <SelectItem value="medium">Ancaman Sedang</SelectItem>
                        <SelectItem value="low">Ancaman Rendah</SelectItem>
                    </SelectContent>
                </Select>
             </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="sm:hidden space-y-4">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-64 w-full" />)
          ) : paginatedReports.length > 0 ? (
            paginatedReports.map((report) => (
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
      
        <div className="hidden sm:block">
          <div className="rounded-lg border overflow-x-auto">
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
                ) : paginatedReports.length > 0 ? (
                  paginatedReports.map((report) => (
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
        </div>
      </CardContent>
      <CardFooter>
        <div className="flex items-center justify-end space-x-2 w-full">
            <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => p - 1)}
                disabled={currentPage === 1 || loading}
            >
                Sebelumnya
            </Button>
            <span className="text-sm text-muted-foreground">Halaman {currentPage}</span>
            <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => p + 1)}
                disabled={paginatedReports.length < REPORTS_PER_PAGE || loading}
            >
                Berikutnya
            </Button>
        </div>
      </CardFooter>
    </Card>
    </>
  );
}
