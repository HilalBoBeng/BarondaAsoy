
"use client";

import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy, limit, startAfter, getDocs, QueryDocumentSnapshot, DocumentData, Timestamp, where, deleteDoc, doc } from 'firebase/firestore';
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
    const [loadingMore, setLoadingMore] = useState(false);
    const [lastVisible, setLastVisible] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
    const [hasMore, setHasMore] = useState(true);
    const { toast } = useToast();

    const fetchReports = async (initial = false) => {
        if (!user) {
            setLoading(false);
            return;
        }

        if (initial) setLoading(true);
        else setLoadingMore(true);

        try {
            const reportsRef = collection(db, 'reports');
            let q;
            if (initial) {
                 q = query(
                    reportsRef, 
                    where('userId', '==', user.uid), 
                    orderBy('createdAt', 'desc'), 
                    limit(REPORTS_PER_PAGE)
                );
            } else if(lastVisible) {
                q = query(
                    reportsRef,
                    where('userId', '==', user.uid),
                    orderBy('createdAt', 'desc'),
                    startAfter(lastVisible),
                    limit(REPORTS_PER_PAGE)
                );
            } else {
                 setLoading(false);
                 setLoadingMore(false);
                 return;
            }

            const documentSnapshots = await getDocs(q);
            const newReports = documentSnapshots.docs.map(doc => {
                 const data = doc.data();
                 return {
                    id: doc.id,
                    ...data,
                    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(),
                    replies: (data.replies || []).map((r: any) => ({
                        ...r,
                        timestamp: r.timestamp instanceof Timestamp ? r.timestamp.toDate() : new Date(),
                    })),
                } as Report;
            });

            const lastDoc = documentSnapshots.docs[documentSnapshots.docs.length - 1];
            setLastVisible(lastDoc || null);

            if(initial) {
                setReports(newReports);
            } else {
                setReports(prev => [...prev, ...newReports]);
            }
            
            if (documentSnapshots.docs.length < REPORTS_PER_PAGE) {
                setHasMore(false);
            }

        } catch (error) {
            console.error("Error fetching reports:", error);
            toast({ variant: 'destructive', title: 'Gagal Memuat Laporan', description: 'Terjadi kesalahan saat mengambil riwayat laporan Anda.' });
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    };
    
    useEffect(() => {
        fetchReports(true);
    }, [user]);

    const handleDelete = async (reportId: string) => {
        try {
            await deleteDoc(doc(db, "reports", reportId));
            setReports(prev => prev.filter(r => r.id !== reportId));
            toast({ title: 'Berhasil', description: 'Laporan Anda telah dihapus.' });
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

            {hasMore && !loading && (
                <div className="text-center">
                    <Button onClick={() => fetchReports(false)} disabled={loadingMore}>
                        {loadingMore && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Muat Lebih Banyak
                    </Button>
                </div>
            )}
        </div>
    );
}


    