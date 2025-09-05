
"use client";

import { useEffect, useState, useCallback } from 'react';
import { collection, query, where, Timestamp, limit, getDocs, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import type { Report, Reply } from '@/lib/types';
import { Skeleton } from '../ui/skeleton';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { MessageSquare, Trash, Info, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { id } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { getAuth, type User } from 'firebase/auth';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';


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

export default function ReportHistory() {
    const [allReports, setAllReports] = useState<Report[]>([]);
    const [paginatedReports, setPaginatedReports] = useState<Report[]>([]);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<User | null>(null);
    const auth = getAuth();
    const { toast } = useToast();
    
    const [currentPage, setCurrentPage] = useState(1);
    
    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged(currentUser => {
            setUser(currentUser);
        });
        return () => unsubscribe();
    }, [auth]);

    const fetchReports = useCallback(async () => {
        if (!user) {
            setLoading(false);
            return;
        };

        setLoading(true);
        try {
            const reportsQuery = query(
                collection(db, 'reports'), 
                where('userId', '==', user.uid)
            );
            
            const snapshot = await getDocs(reportsQuery);
            
            let reportsData = snapshot.docs.map(doc => {
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
            
            // Sort on the client-side
            reportsData.sort((a,b) => (b.createdAt as Date).getTime() - (a.createdAt as Date).getTime());

            setAllReports(reportsData);

        } catch (error) {
            console.error("Error fetching reports:", error);
            toast({ variant: 'destructive', title: 'Gagal Memuat Laporan' });
        } finally {
            setLoading(false);
        }
    }, [user, toast]);
    
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

    if (loading) {
        return (
            <Card>
                <CardHeader><CardTitle className="text-lg">Riwayat Laporan Saya</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <Skeleton key={i} className="h-24 w-full" />
                    ))}
                </CardContent>
            </Card>
        )
    }
    
    if (!loading && paginatedReports.length === 0) {
        return (
             <Card>
                <CardContent className="p-6 text-center text-muted-foreground">
                    Belum ada laporan yang Anda buat.
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardContent className="p-6">
                <div className="space-y-4">
                {paginatedReports.map((report) => (
                    <Card key={report.id} className="overflow-hidden">
                        <CardContent className="p-4">
                             <div className="relative flex justify-between items-start mb-2 gap-2">
                                <div className="flex-grow">
                                    <p className="text-sm text-foreground/90 break-words pr-4">
                                        {report.reportText}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-2">
                                        {formatDistanceToNow(new Date(report.createdAt as Date), { addSuffix: true, locale: id })}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
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
                                            <AlertDialogContent>
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
                </div>
            </CardContent>
        </Card>
    );
}
