
"use client";

import { useEffect, useState, useCallback } from 'react';
import { collection, query, where, Timestamp, limit, getDocs, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import type { Report, Reply } from '@/lib/types';
import { Skeleton } from '../ui/skeleton';
import { Card, CardContent, CardFooter } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { MessageSquare, Trash, Info, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { id } from 'date-fns/locale';
import type { User } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';


const REPORTS_PER_PAGE = 5;

const statusDisplay: Record<string, { text: string; className: string }> = {
  new: { text: 'Baru', className: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-400' },
  in_progress: { text: 'Ditangani', className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-400' },
  resolved: { text: 'Selesai', className: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-400' },
};


const ReplyCard = ({ reply }: { reply: Reply }) => (
    <Card className="mt-2 bg-muted/50">
        <CardContent className="p-3">
            <p className="text-sm text-foreground/80 break-word flex-grow pr-2">
                {reply.message}
            </p>
            <p className="text-xs text-muted-foreground mt-2">
                {formatDistanceToNow( (reply.timestamp as Timestamp)?.toDate() || new Date(), { addSuffix: true, locale: id })}
            </p>
        </CardContent>
    </Card>
);

export default function ReportHistory({ user }: { user?: User | null }) {
    const [allReports, setAllReports] = useState<Report[]>([]);
    const [paginatedReports, setPaginatedReports] = useState<Report[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState<'all' | 'new' | 'in_progress' | 'resolved'>('all');
    const { toast } = useToast();
    
    const [currentPage, setCurrentPage] = useState(1);
    
    const fetchReports = useCallback(async () => {
        if (!user) {
            setLoading(false);
            return;
        };

        setLoading(true);
        try {
            let reportsData: Report[] = [];
            let reportsQuery;
            
            if (filterStatus === 'all') {
                reportsQuery = query(
                    collection(db, 'reports'), 
                    where('userId', '==', user.uid)
                );
            } else {
                 reportsQuery = query(
                    collection(db, 'reports'), 
                    where('userId', '==', user.uid),
                    where('status', '==', filterStatus)
                );
            }
            
            const snapshot = await getDocs(reportsQuery);
            
            reportsData = snapshot.docs.map(doc => {
                 const data = doc.data();
                 const repliesObject = data.replies || {};
                 const repliesArray = Object.values(repliesObject).sort((a: any, b: any) => b.timestamp.toMillis() - a.timestamp.toMillis());
                 return {
                     id: doc.id,
                     ...data,
                     createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(),
                     replies: repliesArray
                 } as Report;
            });
            
            reportsData.sort((a, b) => (b.createdAt as Date).getTime() - (a.createdAt as Date).getTime());
            setAllReports(reportsData);

        } catch (error) {
            console.error("Error fetching reports:", error);
            toast({ variant: 'destructive', title: 'Gagal Memuat Laporan' });
        } finally {
            setLoading(false);
        }
    }, [user, filterStatus, toast]);
    
    useEffect(() => {
        fetchReports();
    }, [fetchReports]); 

    useEffect(() => {
        const start = (currentPage - 1) * REPORTS_PER_PAGE;
        const end = start + REPORTS_PER_PAGE;
        setPaginatedReports(allReports.slice(start, end));
    }, [currentPage, allReports]);


    const goToNextPage = () => {
        if (currentPage * REPORTS_PER_PAGE < allReports.length) {
            setCurrentPage(prev => prev + 1);
        }
    };

    const goToPrevPage = () => {
        if (currentPage > 1) {
            setCurrentPage(prev => prev - 1);
        }
    };


    const handleDelete = async (reportId: string) => {
        try {
            await deleteDoc(doc(db, "reports", reportId));
            toast({ title: 'Berhasil', description: 'Laporan Anda telah dihapus.' });
            fetchReports();
        } catch (error) {
            console.error("Error deleting report:", error);
            toast({ variant: 'destructive', title: 'Gagal Menghapus', description: 'Tidak dapat menghapus laporan.' });
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex gap-2">
                <Button size="sm" variant={filterStatus === 'all' ? 'default' : 'outline'} onClick={() => setFilterStatus('all')}>Semua</Button>
                <Button size="sm" variant={filterStatus === 'new' ? 'default' : 'outline'} onClick={() => setFilterStatus('new')}>Baru</Button>
                <Button size="sm" variant={filterStatus === 'in_progress' ? 'default' : 'outline'} onClick={() => setFilterStatus('in_progress')}>Ditangani</Button>
                <Button size="sm" variant={filterStatus === 'resolved' ? 'default' : 'outline'} onClick={() => setFilterStatus('resolved')}>Selesai</Button>
            </div>
             {loading ? (
                <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                     <Card key={i}>
                        <CardContent className="p-4">
                           <div className="flex justify-between items-start mb-2 gap-2">
                                <div className="flex-grow space-y-2">
                                    <Skeleton className="h-4 w-1/4" />
                                    <Skeleton className="h-4 w-full" />
                                    <Skeleton className="h-3 w-1/2" />
                                </div>
                                <div className="flex-shrink-0">
                                   <Skeleton className="h-6 w-20 rounded-full" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
                </div>
            ) : paginatedReports.length > 0 ? (
                <>
                {paginatedReports.map((report) => (
                    <Card key={report.id} className="overflow-hidden">
                        <CardContent className="p-4">
                            <div className="flex justify-between items-start mb-2 gap-2">
                                <div className="flex-grow">
                                    <p className="text-xs font-bold">{report.reporterName}</p>
                                    <p className="text-sm text-foreground/90 break-words pr-4">
                                        {report.reportText}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-2">
                                        {formatDistanceToNow(new Date(report.createdAt as Date), { addSuffix: true, locale: id })}
                                    </p>
                                </div>
                                <div className="absolute top-4 right-4 flex items-center gap-2">
                                     <Badge variant={'secondary'} className={cn(statusDisplay[report.status]?.className)}>
                                        {statusDisplay[report.status]?.text || report.status}
                                    </Badge>
                                    {report.userId === user?.uid && (
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive">
                                                    <X className="h-4 w-4" />
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent className="rounded-lg">
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Anda yakin ingin menghapus?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        Tindakan ini tidak dapat dibatalkan. Laporan Anda akan dihapus secara permanen.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Batal</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleDelete(report.id)}>Hapus</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                        
                        <CardFooter className="flex-col items-start gap-2 p-4 pt-0">
                            {report.replies && report.replies.length > 0 && (
                                <div className="w-full">
                                    <h4 className="text-xs font-semibold flex items-center gap-1 mb-2">
                                        <MessageSquare className="h-3 w-3" />
                                        Balasan:
                                    </h4>
                                    {report.replies.map((reply, index) => (
                                        <ReplyCard key={index} reply={reply} />
                                    ))}
                                </div>
                            )}
                        </CardFooter>
                    </Card>
                ))}
                <div className="flex items-center justify-end space-x-2 pt-4">
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
                        disabled={currentPage * REPORTS_PER_PAGE >= allReports.length || loading}
                    >
                        Berikutnya
                    </Button>
                </div>
                </>
            ) : (
                <Card>
                    <CardContent className="p-6 text-center text-muted-foreground">
                        Tidak ada laporan dengan status yang dipilih.
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
