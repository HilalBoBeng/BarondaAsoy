
"use client";

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase/client';
import { collection, onSnapshot, doc, updateDoc, query, orderBy, where, getDocs, increment, limit, startAfter, endBefore, limitToLast, type QueryDocumentSnapshot, type DocumentData, writeBatch, serverTimestamp, Timestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { MessageSquare, Calendar, User, CheckCircle, AlertTriangle, Loader2, UserCheck, X } from 'lucide-react';
import type { Report, Reply } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose, DialogFooter, DialogBody, DialogDescription } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { formatDistanceToNow } from 'date-fns';
import { id } from 'date-fns/locale';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { sendReportReplyEmail } from '@/ai/flows/send-report-reply-email';

const replySchema = z.object({
  replyMessage: z.string().min(1, "Balasan tidak boleh kosong."),
});
type ReplyFormValues = z.infer<typeof replySchema>;

const REPORTS_PER_PAGE = 10;

export default function PetugasReportsPage() {
  const [allReports, setAllReports] = useState<Report[]>([]);
  const [paginatedReports, setPaginatedReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [isReplyDialogOpen, setIsReplyDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentReport, setCurrentReport] = useState<Report | null>(null);
  const [staffInfo, setStaffInfo] = useState<{name: string; id: string} | null>(null);
  const { toast } = useToast();
  
  const [filter, setFilter] = useState('new');
  const [threatFilter, setThreatFilter] = useState('all');
  const [newReportsCount, setNewReportsCount] = useState(0);
  const [myReportsCount, setMyReportsCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);

  const replyForm = useForm<ReplyFormValues>({ resolver: zodResolver(replySchema), defaultValues: { replyMessage: '' } });

  useEffect(() => {
    const info = JSON.parse(localStorage.getItem('staffInfo') || '{}');
    if (info.id && info.name) {
        setStaffInfo(info);
    }
  }, []);
  
  useEffect(() => {
    setLoading(true);
    const reportsRef = collection(db, "reports");
    const q = query(reportsRef, orderBy('createdAt', 'desc'));
    
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
      setNewReportsCount(reportsData.filter(r => r.status === 'new').length);
      if (staffInfo) {
        setMyReportsCount(reportsData.filter(r => r.handlerId === staffInfo.id && r.status === 'in_progress').length);
      }
      setLoading(false);
    }, (error) => {
      console.error("Error fetching reports:", error);
      toast({ variant: 'destructive', title: 'Gagal Memuat Laporan' });
      setLoading(false);
    });

    return () => unsubscribe();
  }, [toast, staffInfo]);

  const filteredAndSortedReports = useEffect(() => {
    let filtered = [];
    if (filter === 'new') {
      filtered = allReports.filter(r => r.status === 'new');
    } else if (filter === 'my_reports' && staffInfo) {
      filtered = allReports.filter(r => r.handlerId === staffInfo.id);
    }

    if (threatFilter !== 'all') {
        filtered = filtered.filter(r => r.triageResult?.threatLevel === threatFilter);
    }
    
    const start = (currentPage - 1) * REPORTS_PER_PAGE;
    const end = start + REPORTS_PER_PAGE;
    setPaginatedReports(filtered.slice(start, end));

  }, [filter, allReports, staffInfo, threatFilter, currentPage]);
  
  const handleTakeReport = async (report: Report) => {
    if (!staffInfo) return;
    try {
        const batch = writeBatch(db);
        const reportRef = doc(db, 'reports', report.id);
        batch.update(reportRef, {
            status: 'in_progress',
            handlerId: staffInfo.id,
            handlerName: staffInfo.name,
        });

        const staffRef = doc(db, 'staff', staffInfo.id);
        batch.update(staffRef, { points: increment(1) });
        
        await batch.commit();
        toast({ title: 'Berhasil', description: 'Anda telah mengambil alih laporan ini.' });
    } catch (e) {
        toast({ variant: 'destructive', title: 'Gagal', description: 'Gagal mengambil laporan.' });
    }
  };

  const handleOpenReplyDialog = (report: Report) => {
    setCurrentReport(report);
    replyForm.reset({ replyMessage: '' });
    setIsReplyDialogOpen(true);
  };

  const onReplySubmit = async (values: ReplyFormValues) => {
    if (!currentReport || !staffInfo || !currentReport.reporterEmail) return;
    setIsSubmitting(true);
    
    try {
        const batch = writeBatch(db);
        const reportRef = doc(db, 'reports', currentReport.id);

        const newReply: Reply = {
            message: values.replyMessage,
            replierRole: 'Petugas',
            timestamp: Timestamp.now(),
        };
        
        const newReplyId = Date.now().toString();
        const updatedReplies = {
            ...currentReport.replies,
            [newReplyId]: newReply
        };
        
        batch.update(reportRef, {
            status: 'resolved',
            replies: updatedReplies,
        });

        // Send email notification
        await sendReportReplyEmail({
            recipientEmail: currentReport.reporterEmail,
            reportText: currentReport.reportText,
            replyMessage: values.replyMessage,
            officerName: staffInfo.name,
        });
        
        await batch.commit();
        toast({ title: 'Berhasil', description: 'Laporan telah diselesaikan dan balasan telah dikirim.' });
        setIsReplyDialogOpen(false);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Terjadi kesalahan.';
        toast({ variant: 'destructive', title: 'Gagal Menyelesaikan Laporan', description: errorMessage });
    } finally {
        setIsSubmitting(false);
    }
  };


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

  const ReplyCard = ({ reply }: { reply: Reply }) => (
    <Card className="mt-2 bg-muted/50">
        <CardContent className="p-3">
            <div className="flex justify-between items-start">
                 <p className="text-sm text-foreground/80 break-words flex-grow pr-2">
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

  return (
    <>
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <div>
                 <CardTitle>Laporan Warga</CardTitle>
                <CardDescription>Tinjau dan tanggapi laporan yang masuk dari warga.</CardDescription>
            </div>
             <div className="flex flex-col sm:flex-row gap-2">
                <Button variant={filter === 'new' ? 'default' : 'outline'} onClick={() => setFilter('new')}>
                    Laporan Baru
                    {newReportsCount > 0 && <Badge variant="destructive" className="ml-2">{newReportsCount}</Badge>}
                </Button>
                <Button variant={filter === 'my_reports' ? 'default' : 'outline'} onClick={() => setFilter('my_reports')}>
                    Laporan Saya
                    {myReportsCount > 0 && <Badge variant="secondary" className="ml-2">{myReportsCount}</Badge>}
                </Button>
                 <Select value={threatFilter} onValueChange={setThreatFilter}>
                    <SelectTrigger className="w-full sm:w-[180px]">
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
      <CardContent className="space-y-4">
        {loading ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-48 w-full rounded-lg" />)
        ) : paginatedReports.length > 0 ? (
            paginatedReports.map((report) => (
                <Card key={report.id} className="rounded-lg">
                    <CardHeader>
                        <CardTitle className="text-base break-words">{report.reportText}</CardTitle>
                        <CardDescription className="flex flex-col gap-2 pt-2">
                            <span className="flex items-center gap-2"><User className="h-4 w-4" />{report.reporterName}</span>
                            <span className="flex items-center gap-2"><Calendar className="h-4 w-4" />{new Date(report.createdAt as Date).toLocaleString('id-ID')}</span>
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
                    <CardFooter className="flex-col items-stretch sm:items-center sm:flex-row sm:justify-end">
                       <div className="flex flex-col sm:flex-row gap-2 items-stretch mt-4 sm:mt-0">
                           {report.status === 'new' && (
                                <Button size="sm" onClick={() => handleTakeReport(report)}>Ambil Laporan</Button>
                           )}
                           {report.status === 'in_progress' && report.handlerId === staffInfo?.id && (
                                <Button size="sm" onClick={() => handleOpenReplyDialog(report)}>Selesaikan & Balas Laporan</Button>
                           )}
                           {report.status === 'in_progress' && report.handlerId !== staffInfo?.id && (
                                <Badge variant="outline">Ditangani petugas lain</Badge>
                           )}
                           {report.status === 'resolved' && (
                                <Badge variant="secondary">Selesai</Badge>
                           )}
                        </div>
                    </CardFooter>
                </Card>
            ))
        ) : (
            <div className="text-center py-12 text-muted-foreground">
                Tidak ada laporan yang sesuai dengan filter.
            </div>
        )}
      </CardContent>
      <CardFooter>
         <div className="flex items-center justify-end space-x-2 w-full">
            <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => p - 1)}
                disabled={currentPage === 1}
            >
                Sebelumnya
            </Button>
            <span className="text-sm text-muted-foreground">Halaman {currentPage}</span>
            <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => p + 1)}
                disabled={paginatedReports.length < REPORTS_PER_PAGE}
            >
                Berikutnya
            </Button>
        </div>
      </CardFooter>
    </Card>

     <Dialog open={isReplyDialogOpen} onOpenChange={setIsReplyDialogOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Selesaikan & Balas Laporan</DialogTitle>
                <DialogClose asChild>
                    <Button type="button" variant="ghost" size="icon" className="absolute right-4 top-4 text-primary-foreground h-7 w-7">
                        <X className="h-4 w-4" />
                        <span className="sr-only">Tutup</span>
                    </Button>
                </DialogClose>
                <DialogDescription>Anda harus mengirim balasan untuk menyelesaikan laporan ini.</DialogDescription>
            </DialogHeader>
            <Form {...replyForm}>
                <form onSubmit={replyForm.handleSubmit(onReplySubmit)} className="space-y-4 pt-4">
                    <DialogBody>
                        <div className="space-y-2 text-sm">
                            <p><strong>Pelapor:</strong> {currentReport?.reporterName}</p>
                            <p className="text-muted-foreground break-word"><strong>Laporan:</strong> {currentReport?.reportText}</p>
                        </div>
                        <FormField
                            control={replyForm.control}
                            name="replyMessage"
                            render={({ field }) => (
                            <FormItem className='mt-4'>
                                <FormLabel>Pesan Balasan</FormLabel>
                                <FormControl>
                                    <Textarea {...field} rows={5} placeholder="Contoh: Terima kasih atas laporannya. Kami telah menindaklanjuti dan situasi sudah aman terkendali." />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                    </DialogBody>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button type="button" variant="secondary">Batal</Button>
                        </DialogClose>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Kirim Balasan & Selesaikan
                        </Button>
                    </DialogFooter>
                </form>
            </Form>
        </DialogContent>
    </Dialog>
    
    </>
  );
}
