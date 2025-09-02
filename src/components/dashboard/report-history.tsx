
"use client";

import { useEffect, useState, useCallback } from 'react';
import { collection, query, where, Timestamp, limit, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import type { Report, Reply } from '@/lib/types';
import { Skeleton } from '../ui/skeleton';
import { Card, CardContent, CardFooter } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { MessageSquare } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { id } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';


const REPORTS_PER_PAGE = 5;

const statusDisplay: Record<string, { text: string; className: string }> = {
  new: { text: 'Baru', className: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-400' },
  in_progress: { text: 'Ditangani', className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-400' },
  resolved: { text: 'Selesai', className: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-400' },
};

const ReplyCard = ({ reply }: { reply: Reply }) => (
    <Card className="mt-2 bg-muted/50">
        <CardContent className="p-3">
            <div className="flex justify-between items-start">
                 <p className="text-xs text-foreground/80 break-word flex-grow pr-2">
                    {reply.message}
                </p>
                <div className="flex-shrink-0">
                    <Badge variant={reply.replierRole === 'Admin' ? 'default' : 'secondary'}>{reply.replierRole}</Badge>
                </div>
            </div>
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
    const { toast } = useToast();
    
    const [currentPage, setCurrentPage] = useState(1);
    
    useEffect(() => {
        const fetchReports = async () => {
            setLoading(true);
            try {
                const reportsQuery = query(
                    collection(db, 'reports'), 
                    where('visibility', '==', 'public'),
                    orderBy('createdAt', 'desc')
                );
                
                const snapshot = await getDocs(reportsQuery);
                
                const reportsData = snapshot.docs.map(doc => {
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
                
                setAllReports(reportsData);

            } catch (error) {
                console.error("Error fetching reports:", error);
                toast({ variant: 'destructive', title: 'Gagal Memuat Laporan' });
            } finally {
                setLoading(false);
            }
        };
        fetchReports();
    }, [toast]); 

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

    if (loading) {
        return (
            <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
                <Card key={i}>
                    <CardContent className="p-4">
                        <Skeleton className="h-4 w-1/3 mb-2" />
                        <Skeleton className="h-4 w-full mb-2" />
                        <Skeleton className="h-4 w-3/4" />
                    </CardContent>
                </Card>
            ))}
            </div>
        )
    }
    
    if (!loading && paginatedReports.length === 0) {
        return (
             <Card>
                <CardContent className="p-6 text-center text-muted-foreground">
                    Belum ada laporan dari warga.
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-4">
            {paginatedReports.map((report) => (
                <Card key={report.id}>
                    <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-2 gap-2">
                            <div className="flex-grow">
                                <p className="text-xs font-bold">{report.reporterName}</p>
                                <p className="text-sm text-foreground/90 break-word">
                                    {report.reportText}
                                </p>
                                <p className="text-xs text-muted-foreground mt-2">
                                    {formatDistanceToNow(new Date(report.createdAt as Date), { addSuffix: true, locale: id })}
                                </p>
                            </div>
                            <div className="flex flex-col gap-2 items-end flex-shrink-0">
                                <Badge variant={'secondary'} className={cn(statusDisplay[report.status]?.className)}>
                                    {statusDisplay[report.status]?.text || report.status}
                                </Badge>
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
    );
}
