
"use client";

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase/client';
import { collection, onSnapshot, doc, updateDoc, query, orderBy } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { MessageSquare, Calendar, User, CheckCircle, AlertTriangle, HelpCircle, Loader2 } from 'lucide-react';
import type { Report, Reply } from '@/lib/types';
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

type ReportStatus = 'new' | 'in_progress' | 'resolved';

const replySchema = z.object({
  replyMessage: z.string().min(1, "Balasan tidak boleh kosong."),
});
type ReplyFormValues = z.infer<typeof replySchema>;

export default function PetugasReportsPage() {
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
    const q = query(collection(db, "reports"), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
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
      setLoading(false);
    }, (error) => {
      console.error("Error fetching reports:", error);
      toast({ variant: 'destructive', title: 'Gagal Memuat Laporan' });
      setLoading(false);
    });

    return () => unsub();
  }, [toast]);

  const handleStatusChange = async (id: string, status: ReportStatus) => {
    try {
      const docRef = doc(db, 'reports', id);
      await updateDoc(docRef, { status });
      setReports(prev => prev.map(r => r.id === id ? { ...r, status } : r));
      toast({ title: "Berhasil", description: "Status laporan diperbarui." });
    } catch (error) {
      toast({ variant: 'destructive', title: "Gagal", description: "Gagal memperbarui status." });
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
            reportId: currentReport.id,
            recipientEmail: currentReport.reporterEmail,
            replyMessage: values.replyMessage,
            originalReport: currentReport.reportText,
            replierRole: 'Petugas'
        });

        if (result.success) {
            toast({ title: 'Berhasil', description: 'Balasan berhasil dikirim.' });
            setIsReplyDialogOpen(false);
        } else {
            throw new Error(result.message);
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Terjadi kesalahan.';
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
                    <SelectItem value="new">Baru</SelectItem>
                    <SelectItem value="in_progress">Ditangani</SelectItem>
                    <SelectItem value="resolved">Selesai</SelectItem>
                </SelectContent>
            </Select>
        </div>
    );
  }

  return (
    <>
    <Card>
      <CardHeader>
        <CardTitle>Laporan Warga</CardTitle>
        <CardDescription>Tinjau dan tanggapi laporan yang masuk dari warga.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-48 w-full" />)
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
                      {renderActions(report)}
                    </CardFooter>
                </Card>
            ))
        ) : (
            <div className="text-center py-12 text-muted-foreground">Belum ada laporan masuk.</div>
        )}
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
