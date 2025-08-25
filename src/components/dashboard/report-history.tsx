
"use client";

import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, limit, startAfter, getDocs, QueryDocumentSnapshot, DocumentData, Timestamp, where, deleteDoc, doc, endBefore, limitToLast } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import type { Report, Reply } from '@/lib/types';
import { Skeleton } from '../ui/skeleton';
import { Card, CardContent, CardFooter } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Loader2, MessageSquare, Trash } from 'lucide-react';
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


export default function ReportHistory({ user }: { user: User | null }) {
    const [reports, setReports] = useState<Report[]>([]);
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();

    const [currentPage, setCurrentPage] = useState(1);
    const [firstVisible, setFirstVisible] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
    const [lastVisible, setLastVisible] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
    const [isLastPage, setIsLastPage] = useState(false);

    const fetchReports = async (page: number, direction: 'next' | 'prev' | 'initial' = 'initial') => {
        if (!user) {
            setLoading(false);
            return;
        }
        setLoading(true);

        try {
            const reportsRef = collection(db, 'reports');
            let q;

            // Simplified query to avoid composite index. Sorting will be done on the client.
            if (direction === 'next' && lastVisible) {
                q = query(reportsRef, where('userId', '==', user.uid), orderBy('createdAt', 'desc'), startAfter(lastVisible), limit(REPORTS_PER_PAGE));
            } else if (direction === 'prev' && firstVisible) {
                q = query(reportsRef, where('userId', '==', user.uid), orderBy('createdAt', 'desc'), endBefore(firstVisible), limitToLast(REPORTS_PER_PAGE));
            } else {
                q = query(reportsRef, where('userId', '==', user.uid), orderBy('createdAt', 'desc'), limit(REPORTS_PER_PAGE));
            }

            const unsubscribe = onSnapshot(q, (snapshot) => {
                if (snapshot.empty && direction !== 'initial') {
                    setIsLastPage(true);
                    setLoading(false);
                    if (direction === 'next') setCurrentPage(prev => prev > 1 ? prev - 1 : 1);
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
                
                setReports(reportsData);
                setFirstVisible(snapshot.docs[0]);
                setLastVisible(snapshot.docs[snapshot.docs.length - 1]);
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
        if (user) {
            const unsub = fetchReports(1);
            return () => { unsub.then(u => u && u()) };
        } else {
            setLoading(false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user]);

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


    const handleDelete = async (reportId: string) => {
        try {
            await deleteDoc(doc(db, "reports", reportId));
            toast({ title: 'Berhasil', description: 'Laporan Anda telah dihapus.' });
            // The onSnapshot listener will auto-update the UI
        } catch (error) {
            console.error("Error deleting report:", error);
            toast({ variant: 'destructive', title: 'Gagal Menghapus', description: 'Tidak dapat menghapus laporan.' });
        }
    };


    if (!user) {
        return (
             <Card>
                <CardContent className="p-6 text-center text-muted-foreground">
                    Silakan masuk untuk melihat riwayat laporan Anda.
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-4">
            {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                    <Card key={i}>
                        <CardContent className="p-4">
                            <Skeleton className="h-4 w-1/3 mb-2" />
                            <Skeleton className="h-4 w-full mb-2" />
                            <Skeleton className="h-4 w-3/4" />
                        </CardContent>
                    </Card>
                ))
            ) : reports.length > 0 ? (
                reports.map((report) => (
                    <Card key={report.id}>
                       <CardContent className="p-4">
                            <div className="flex justify-between items-start mb-2 gap-2">
                                <div className="flex-grow">
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
                        </CardFooter>
                    </Card>
                ))
            ) : (
                <Card>
                    <CardContent className="p-6 text-center text-muted-foreground">
                        Anda belum pernah membuat laporan.
                    </CardContent>
                </Card>
            )}

            {reports.length > 0 && (
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
            )}
        </div>
    );
}
