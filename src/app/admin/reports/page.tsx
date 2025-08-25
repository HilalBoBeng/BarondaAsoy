
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
import { Trash, CheckCircle, AlertTriangle, HelpCircle, Calendar, User, MessageSquare, Loader2 } from 'lucide-react';
import type { Report } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { sendReply } from '@/ai/flows/send-reply';

type ReportStatus = 'new' | 'in_progress' | 'resolved';

const replySchema = z.object({
  replyMessage: z.string().min(1, "Balasan tidak boleh kosong."),
});
type ReplyFormValues = z.infer<typeof replySchema>;

export default function ReportsAdminPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [isReplyDialogOpen, setIsReplyDialogOpen] = useState(false);
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);
  const [currentReport, setCurrentReport] = useState<Report | null>(null);
  const { toast } = useToast();

  const replyForm = useForm<ReplyFormValues>({
    resolver: zodResolver(replySchema),
    defaultValues: { replyMessage: '' },
  });

  useEffect(() => {
    const q = query(collection(db, 'reports'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const reportsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
      })) as Report[];
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
    setIsSubmittingReply(true);
    try {
        const result = await sendReply({
            recipientEmail: currentReport.reporterEmail,
            replyMessage: values.replyMessage,
            originalReport: currentReport.reportText
        });

        if (result.success) {
            toast({ title: 'Berhasil', description: 'Balasan berhasil dikirim.' });
            setIsReplyDialogOpen(false);
        } else {
            throw new Error(result.message);
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Terjadi kesalahan tidak diketahui.';
        toast({ variant: 'destructive', title: 'Gagal Mengirim Balasan', description: errorMessage });
    } finally {
        setIsSubmittingReply(false);
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

  const renderActions = (report: Report) => (
    <div className="flex flex-col sm:flex-row gap-2 items-stretch mt-4 sm:mt-0">
        <Button variant="outline" size="sm" onClick={() => handleOpenReplyDialog(report)} disabled={!report.reporterEmail}>
            <MessageSquare className="h-4 w-4 mr-2" />
            Balas
        </Button>
        <Select value={report.status} onValueChange={(value) => handleStatusChange(report.id, value as ReportStatus)}>
            <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder="Ubah Status" />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="new">Baru</SelectItem>
                <SelectItem value="in_progress">Ditangani</SelectItem>
                <SelectItem value="resolved">Selesai</SelectItem>
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
                <CardContent>
                    <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">Ancaman:</span>
                         <Badge variant={report.triageResult?.threatLevel === 'high' ? 'destructive' : 'secondary'} className="capitalize">
                            <ThreatLevelIcon level={report.triageResult?.threatLevel} />
                            <span className="ml-2">{report.triageResult?.threatLevel || 'N/A'}</span>
                        </Badge>
                    </div>
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
                <TableHead>Laporan</TableHead>
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
                    <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-8 w-[280px] ml-auto" /></TableCell>
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
                    <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                           {renderActions(report)}
                        </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center h-24">
                    Belum ada laporan masuk.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
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
                        <Button type="submit" disabled={isSubmittingReply}>
                            {isSubmittingReply && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Kirim Balasan
                        </Button>
                    </DialogFooter>
                </form>
            </Form>
        </DialogContent>
    </Dialog>
    </>
  );
}
