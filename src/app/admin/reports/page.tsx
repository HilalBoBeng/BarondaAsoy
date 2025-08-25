
"use client";

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase/client';
import { collection, onSnapshot, doc, updateDoc, deleteDoc, query, orderBy, getDocs, limit, startAfter, type QueryDocumentSnapshot, type DocumentData, increment, where, endBefore, limitToLast, addDoc, serverTimestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Trash, CheckCircle, AlertTriangle, HelpCircle, Calendar, User, MessageSquare, Loader2, UserCheck } from 'lucide-react';
import type { Report, Reply, Staff } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { sendReply } from '@/ai/flows/send-reply';
import { formatDistanceToNow } from 'date-fns';
import { id } from 'date-fns/locale';

const REPORTS_PER_PAGE = 5;
type ReportStatus = 'new' | 'in_progress' | 'resolved';

const replySchema = z.object({
  replyMessage: z.string().min(1, "Balasan tidak boleh kosong."),
});
type ReplyFormValues = z.infer<typeof replySchema>;

const assignSchema = z.object({
  handlerId: z.string().min(1, "Petugas harus dipilih."),
});
type AssignFormValues = z.infer<typeof assignSchema>;


export default function ReportsAdminPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [isReplyDialogOpen, setIsReplyDialogOpen] = useState(false);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentReport, setCurrentReport] = useState<Report | null>(null);
  const { toast } = useToast();

  const [currentPage, setCurrentPage] = useState(1);
  const [firstVisible, setFirstVisible] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [lastVisible, setLastVisible] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [isLastPage, setIsLastPage] = useState(false);

  const replyForm = useForm<ReplyFormValues>({ resolver: zodResolver(replySchema), defaultValues: { replyMessage: '' } });
  const assignForm = useForm<AssignFormValues>({ resolver: zodResolver(assignSchema) });

  const fetchStaff = async () => {
      const staffQuery = query(collection(db, "staff"), where("status", "==", "active"));
      const staffSnapshot = await getDocs(staffQuery);
      const staffData = staffSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Staff[];
      setStaffList(staffData);
    };

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
    fetchStaff();
    const unsub = fetchReports(1);
    return () => { unsub.then(u => u && u()) };
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


  const handleStatusChange = async (id: string, status: ReportStatus) => {
    const reportToUpdate = reports.find(r => r.id === id);
    if (!reportToUpdate) return;

    if (status === 'in_progress' && reportToUpdate.status === 'new') {
        setCurrentReport(reportToUpdate);
        assignForm.reset({ handlerId: '' });
        setIsAssignDialogOpen(true);
    } else if (status === 'resolved' && reportToUpdate.status === 'in_progress') {
       try {
        const docRef = doc(db, 'reports', id);
        await updateDoc(docRef, { status });
        toast({ title: "Berhasil", description: "Status laporan berhasil diperbarui." });
      } catch (error) {
        toast({ variant: 'destructive', title: "Gagal", description: "Terjadi kesalahan saat memperbarui status." });
      }
    }
  };
  
  const onAssignSubmit = async (values: AssignFormValues) => {
    if (!currentReport) return;
    setIsSubmitting(true);
    const selectedStaff = staffList.find(s => s.id === values.handlerId);
    if (!selectedStaff) {
      toast({ variant: 'destructive', title: 'Gagal', description: 'Petugas tidak ditemukan.' });
      setIsSubmitting(false);
      return;
    }
    
    try {
      const reportRef = doc(db, 'reports', currentReport.id);
      await updateDoc(reportRef, { 
        status: 'in_progress',
        handlerId: selectedStaff.id,
        handlerName: selectedStaff.name,
      });

      const staffRef = doc(db, 'staff', selectedStaff.id);
      await updateDoc(staffRef, {
        points: increment(1)
      });
      
       // Send notification to the assigned staff
      const notifRef = collection(db, 'notifications');
      await addDoc(notifRef, {
          userId: selectedStaff.id,
          title: "Tugas Laporan Baru",
          message: `Anda ditugaskan untuk menangani laporan baru: "${currentReport.reportText.substring(0, 50)}..."`,
          read: false,
          createdAt: serverTimestamp(),
          link: `/petugas/reports?reportId=${currentReport.id}`
      });
      
      toast({ title: "Berhasil", description: `Laporan ditugaskan kepada ${selectedStaff.name}.` });
      setIsAssignDialogOpen(false);
      setCurrentReport(null);
    } catch(error) {
       toast({ variant: 'destructive', title: 'Gagal', description: 'Gagal menugaskan laporan.' });
    } finally {
        setIsSubmitting(false);
    }
  }


  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'reports', id));
      toast({ title: "Berhasil", description: "Laporan berhasil dihapus." });
    } catch (error) {
      toast({ variant: 'destructive', title: "Gagal", description: "Tidak dapat menghapus laporan." });
    }
  };
  
  const handleOpenReplyDialog = (report: Report) => {
    setCurrentReport(report);
    replyForm.reset({ replyMessage: '' });
    setIsReplyDialogOpen(true);
  };

  const onReplySubmit = async (values: ReplyFormValues) => {
    if (!currentReport || !currentReport.reporterEmail) {
        toast({ variant: 'destructive', title: 'Gagal', description: 'Email pelapor tidak ditemukan.' });
        return;
    }
    setIsSubmitting(true);
    try {
        const result = await sendReply({
            reportId: currentReport.id,
            recipientEmail: currentReport.reporterEmail,
            replyMessage: values.replyMessage,
            originalReport: currentReport.reportText,
            replierRole: 'Admin'
        });

        if (result.success) {
            toast({ title: 'Berhasil', description: 'Balasan berhasil dikirim dan disimpan.' });
            setIsReplyDialogOpen(false);
        } else {
            throw new Error(result.message);
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Terjadi kesalahan tidak diketahui.';
        toast({ variant: 'destructive', title: 'Gagal Mengirim Balasan', description: errorMessage });
    } finally {
        setIsSubmitting(false);
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
  
  const statusOptions: {value: ReportStatus; label: string; disabled?: (currentStatus: ReportStatus) => boolean}[] = [
    { value: 'new', label: 'Baru', disabled: (currentStatus) => currentStatus !== 'new' },
    { value: 'in_progress', label: 'Ditangani', disabled: (currentStatus) => currentStatus === 'resolved' || currentStatus === 'in_progress' },
    { value: 'resolved', label: 'Selesai', disabled: (currentStatus) => currentStatus === 'new' },
  ];

  const renderActions = (report: Report) => {
    const hasReplies = report.replies && report.replies.length > 0;
    return (
        <div className="flex flex-col sm:flex-row gap-2 items-stretch mt-4 sm:mt-0">
            <Button variant="outline" size="sm" onClick={() => handleOpenReplyDialog(report)} disabled={!report.reporterEmail || hasReplies}>
                <MessageSquare className="h-4 w-4 mr-0 sm:mr-2" />
                <span className="hidden sm:inline">{hasReplies ? 'Sudah Dibalas' : 'Balas'}</span>
            </Button>
            <Select value={report.status} onValueChange={(value) => handleStatusChange(report.id, value as ReportStatus)}>
                <SelectTrigger className="w-full sm:w-[150px]">
                    <SelectValue placeholder="Ubah Status" />
                </SelectTrigger>
                <SelectContent>
                    {statusOptions.map(option => (
                        <SelectItem key={option.value} value={option.value} disabled={option.disabled && option.disabled(report.status)}>
                            {option.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            {report.status === 'resolved' && (
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
            )}
        </div>
    );
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
                        <span className="flex items-center gap-2"><Calendar className="h-4 w-4" />{new Date(report.createdAt as Date).toLocaleString('id-ID')}</span>
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">Ancaman:</span>
                         <Badge variant={report.triageResult?.threatLevel === 'high' ? 'destructive' : 'secondary'} className="capitalize">
                            <ThreatLevelIcon level={report.triageResult?.threatLevel} />
                            <span className="ml-2">{report.triageResult?.threatLevel || 'N/A'}</span>
                        </Badge>
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
                  {renderActions(report)}
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
                <TableHead className="w-[350px] text-right">Aksi</TableHead>
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
                    <TableCell className="text-right"><Skeleton className="h-8 w-[280px] ml-auto" /></TableCell>
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
                        <Badge variant={report.triageResult?.threatLevel === 'high' ? 'destructive' : 'secondary'} className="capitalize">
                            <ThreatLevelIcon level={report.triageResult?.threatLevel} />
                            <span className="ml-2">{report.triageResult?.threatLevel || 'N/A'}</span>
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
                  <TableCell colSpan={6} className="text-center h-24">
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

     <Dialog open={isReplyDialogOpen} onOpenChange={setIsReplyDialogOpen}>
        <DialogContent className="sm:max-w-lg w-[90%] rounded-lg">
            <DialogHeader>
                <DialogTitle>Balas Laporan</DialogTitle>
            </DialogHeader>
            <Form {...replyForm}>
                <form onSubmit={replyForm.handleSubmit(onReplySubmit)} className="space-y-4">
                    <div className="space-y-2 text-sm">
                        <p><strong>Pelapor:</strong> {currentReport?.reporterName}</p>
                        <p className="text-muted-foreground break-words"><strong>Laporan:</strong> {currentReport?.reportText}</p>
                    </div>
                    <FormField
                        control={replyForm.control}
                        name="replyMessage"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Pesan Balasan</FormLabel>
                            <FormControl>
                                <Textarea {...field} rows={5} placeholder="Tulis balasan Anda di sini..." />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button type="button" variant="secondary">Batal</Button>
                        </DialogClose>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Kirim Balasan
                        </Button>
                    </DialogFooter>
                </form>
            </Form>
        </DialogContent>
    </Dialog>

    <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
        <DialogContent className="sm:max-w-md w-[90%] rounded-lg">
            <DialogHeader>
                <DialogTitle>Tugaskan Laporan</DialogTitle>
                <CardDescription>Pilih petugas yang akan menangani laporan ini.</CardDescription>
            </DialogHeader>
            <Form {...assignForm}>
                <form onSubmit={assignForm.handleSubmit(onAssignSubmit)} className="space-y-4 pt-4">
                     <FormField
                        control={assignForm.control}
                        name="handlerId"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Petugas</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                <SelectTrigger>
                                    <SelectValue placeholder="Pilih petugas" />
                                </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                {staffList.map(s => (
                                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                ))}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button type="button" variant="secondary">Batal</Button>
                        </DialogClose>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Tugaskan
                        </Button>
                    </DialogFooter>
                </form>
            </Form>
        </DialogContent>
    </Dialog>
    </>
  );
}

    
