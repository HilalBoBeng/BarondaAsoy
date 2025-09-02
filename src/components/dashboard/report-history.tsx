
"use client";

import { useEffect, useState, useCallback } from 'react';
import { collection, query, where, Timestamp, limit, startAfter, getDocs, QueryDocumentSnapshot, DocumentData, endBefore, limitToLast, orderBy, deleteDoc, doc } from 'firebase/firestore';
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
import { usePathname } from 'next/navigation';


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
    const [allReports, setAllReports] = useState<Report[]>([]);
    const [paginatedReports, setPaginatedReports] = useState<Report[]>([]);
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();
    const pathname = usePathname();
    
    const [currentPage, setCurrentPage] = useState(1);
    
    const fetchReports = useCallback(async () => {
        setLoading(true);
        try {
            let q;
            if (user && user.uid) { // Check if user and user.uid exist
                q = query(collection(db, 'reports'), where('userId', '==', user.uid));
            } else {
                q = query(collection(db, 'reports'), where('visibility', '==', 'public'));
            }
            
            const snapshot = await getDocs(q);
            
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
            
            reportsData.sort((a, b) => (b.createdAt as Date).getTime() - (a.createdAt as Date).getTime());
            
            setAllReports(reportsData);

        } catch (error) {
            console.error("Error fetching reports:", error);
            toast({ variant: 'destructive', title: 'Gagal Memuat Laporan' });
        } finally {
            setLoading(false);
        }
    }, [user, toast]);
    
    useEffect(() => {
        if(user !== undefined) {
           fetchReports();
        }
    }, [user, fetchReports]); 

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

    const showDeleteButton = user && pathname.startsWith('/profile');

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
            {paginatedReports.map((report) => (
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

                        {showDeleteButton && report.userId === user.uid && (
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
                    disabled={currentPage * REPORTS_PER_PAGE >= allReports.length || loading}
                >
                    Berikutnya
                </Button>
            </div>
        </div>
    );
}
