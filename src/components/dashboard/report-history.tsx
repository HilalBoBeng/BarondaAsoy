
"use client";

import { useEffect, useState, useCallback } from 'react';
import { collection, onSnapshot, query, where, deleteDoc, doc, Timestamp, limit, startAfter, getDocs, QueryDocumentSnapshot, DocumentData, endBefore, limitToLast } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import type { Report, Reply } from '@/lib/types';
import { Skeleton } from '../ui/skeleton';
import { Card, CardContent, CardFooter } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { MessageSquare, Trash } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { id } from 'date-fns/locale';
import type { User } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

const REPORTS_PER_PAGE = 5;

const categoryDisplay: Record<string, string> = {
    theft: "Pencurian",
    vandalism: "Vandalisme",
    suspicious_person: "Orang Mencurigakan",
    other: "Lainnya",
};

const statusDisplay: Record<string, { text: string; variant: 'destructive' | 'default' | 'secondary' }> = {
  new: { text: 'Baru', variant: 'destructive' },
  in_progress: { text: 'Ditangani', variant: 'default' },
  resolved: { text: 'Selesai', variant: 'secondary' },
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
                {formatDistanceToNow( (reply.timestamp as Timestamp)?.toDate() || new Date(), { addSuffix: true, locale: id })}
            </p>
        </CardContent>
    </Card>
);

export default function ReportHistory({ user }: { user?: User | null }) {
    const [reports, setReports] = useState<Report[]>([]);
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();
    
    const [currentPage, setCurrentPage] = useState(1);
    const [firstVisible, setFirstVisible] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
    const [lastVisible, setLastVisible] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
    const [isLastPage, setIsLastPage] = useState(false);

    const fetchReports = useCallback(async (direction: 'next' | 'prev' | 'initial') => {
        setLoading(true);
        try {
            const reportsRef = collection(db, 'reports');
            let q;

            // Base query without ordering
            const baseQuery = user 
                ? [where('userId', '==', user.uid)]
                : [where('visibility', '==', 'public')];

            if (direction === 'next' && lastVisible) {
                q = query(reportsRef, ...baseQuery, limit(REPORTS_PER_PAGE), startAfter(lastVisible));
            } else if (direction === 'prev' && firstVisible) {
                 q = query(reportsRef, ...baseQuery, limitToLast(REPORTS_PER_PAGE), endBefore(firstVisible));
            } else {
                q = query(reportsRef, ...baseQuery, limit(REPORTS_PER_PAGE));
            }
            
            const snapshot = await getDocs(q);

            if (snapshot.empty) {
                if (direction !== 'initial') {
                    setIsLastPage(true);
                } else {
                    setReports([]);
                }
                setLoading(false);
                return;
            }
            
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
            
            // Sort on the client side
            reportsData.sort((a, b) => (b.createdAt as Date).getTime() - (a.createdAt as Date).getTime());


            setReports(reportsData);
            setFirstVisible(snapshot.docs[0]);
            setLastVisible(snapshot.docs[snapshot.docs.length - 1]);
            setIsLastPage(snapshot.docs.length < REPORTS_PER_PAGE);

        } catch (error) {
            console.error("Error fetching reports:", error);
            toast({ variant: 'destructive', title: 'Gagal Memuat Laporan' });
        } finally {
            setLoading(false);
        }
    }, [user, lastVisible, firstVisible, toast]);
    
    useEffect(() => {
        fetchReports('initial');
    }, [user]); // Removed fetchReports from dependency array as it is now wrapped in useCallback

    const goToNextPage = () => {
        setCurrentPage(prev => prev + 1);
        fetchReports('next');
    };

    const goToPrevPage = () => {
        setCurrentPage(prev => prev - 1);
        fetchReports('prev');
    };


    const handleDelete = async (reportId: string) => {
        try {
            await deleteDoc(doc(db, "reports", reportId));
            toast({ title: 'Berhasil', description: 'Laporan Anda telah dihapus.' });
            fetchReports('initial'); // Refresh data
        } catch (error) {
            console.error("Error deleting report:", error);
            toast({ variant: 'destructive', title: 'Gagal Menghapus', description: 'Tidak dapat menghapus laporan.' });
        }
    };

    if (loading && reports.length === 0) {
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
    
    if (!loading && reports.length === 0) {
         const message = user ? "Anda belum pernah membuat laporan." : "Belum ada laporan dari komunitas.";
        return (
             <Card>
                <CardContent className="p-6 text-center text-muted-foreground">
                    {message}
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-4">
            {reports.map((report) => (
                <Card key={report.id}>
                    <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-2 gap-2">
                            <div className="flex-grow">
                                {!user && <p className="text-xs font-bold">{report.reporterName}</p>}
                                <p className="text-sm text-foreground/90 break-words">
                                    {report.reportText}
                                </p>
                                    <p className="text-xs text-muted-foreground mt-2">
                                    {formatDistanceToNow(new Date(report.createdAt as Date), { addSuffix: true, locale: id })}
                                </p>
                            </div>
                            <div className="flex flex-col gap-2 items-end flex-shrink-0">
                                <Badge variant={statusDisplay[report.status]?.variant || 'secondary'}>
                                    {statusDisplay[report.status]?.text || report.status}
                                </Badge>
                                <Badge variant="outline">
                                    {categoryDisplay[report.category] || report.category}
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

                        {user && ( // Show delete button only if it's the user's own history view
                            <div className="w-full flex justify-end mt-2">
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="destructive" size="sm">
                                            <Trash className="h-4 w-4 mr-2" />
                                            Hapus
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
                    disabled={isLastPage || loading}
                >
                    Berikutnya
                </Button>
            </div>
        </div>
    );
}
