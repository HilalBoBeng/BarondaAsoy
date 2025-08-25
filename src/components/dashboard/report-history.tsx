
"use client";

import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy, limit, startAfter, getDocs, QueryDocumentSnapshot, DocumentData, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import type { Report } from '@/lib/types';
import { Skeleton } from '../ui/skeleton';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { id } from 'date-fns/locale';

const categoryDisplay: Record<string, string> = {
    theft: "Pencurian",
    vandalism: "Vandalisme",
    suspicious_person: "Orang Mencurigakan",
    other: "Lainnya",
};

const statusDisplay: Record<string, { text: string; variant: 'destructive' | 'default' | 'secondary' }> = {
  new: { text: 'Belum Ditangani', variant: 'destructive' },
  in_progress: { text: 'Sedang Ditangani', variant: 'default' },
  resolved: { text: 'Selesai', variant: 'secondary' },
};

export default function ReportHistory() {
    const [reports, setReports] = useState<Report[]>([]);
    const [loading, setLoading] = useState(true);
    const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
    const [isLastPage, setIsLastPage] = useState(false);
    const [page, setPage] = useState(1);

    const reportsPerPage = 5;

    const fetchReports = (direction: 'next' | 'prev' | 'initial' = 'initial') => {
        setLoading(true);
        let q;

        if (direction === 'next' && lastDoc) {
            q = query(collection(db, 'reports'), orderBy('createdAt', 'desc'), startAfter(lastDoc), limit(reportsPerPage));
        } else {
            q = query(collection(db, 'reports'), orderBy('createdAt', 'desc'), limit(reportsPerPage));
        }

        const unsubscribe = onSnapshot(q, async (querySnapshot) => {
            if (querySnapshot.empty) {
                setLoading(false);
                setIsLastPage(true);
                if (direction === 'initial') setReports([]);
                return;
            }

            const reportsData: Report[] = querySnapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(),
                } as Report;
            });
            
            setReports(reportsData);
            const newLastDoc = querySnapshot.docs[querySnapshot.docs.length - 1];
            setLastDoc(newLastDoc);
            
            // Check if it's the last page
            const nextQuery = query(collection(db, 'reports'), orderBy('createdAt', 'desc'), startAfter(newLastDoc), limit(1));
            const nextDocs = await getDocs(nextQuery);
            setIsLastPage(nextDocs.empty);

            setLoading(false);
        });

        return unsubscribe;
    };
    
    useEffect(() => {
        const unsubscribe = fetchReports('initial');
        return () => {
            if (typeof unsubscribe === 'function') {
                unsubscribe();
            }
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleNextPage = () => {
        setPage(prev => prev + 1);
        fetchReports('next');
    };

    const handlePrevPage = () => {
        // This is a simplified pagination for demonstration. 
        // A full implementation would require storing previous cursors.
        setPage(1);
        fetchReports('initial');
    };


    return (
        <div className="space-y-4">
            {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                    <Card key={i}>
                        <CardContent className="p-4">
                            <Skeleton className="h-6 w-1/2 mb-2" />
                            <Skeleton className="h-4 w-1/3 mb-4" />
                            <Skeleton className="h-4 w-full mb-2" />
                            <Skeleton className="h-4 w-3/4" />
                        </CardContent>
                    </Card>
                ))
            ) : reports.length > 0 ? (
                reports.map((report) => (
                    <Card key={report.id}>
                       <CardContent className="p-4">
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <h3 className="font-bold">{report.reporterName}</h3>
                                    <p className="text-xs text-muted-foreground">
                                        {formatDistanceToNow(new Date(report.createdAt as Date), { addSuffix: true, locale: id })}
                                    </p>
                                </div>
                                <div className="flex gap-2 items-center">
                                    <Badge variant={statusDisplay[report.status]?.variant || 'secondary'}>
                                        {statusDisplay[report.status]?.text || report.status}
                                    </Badge>
                                    <Badge variant="outline">
                                        {categoryDisplay[report.category] || report.category}
                                    </Badge>
                                </div>
                            </div>
                            <p className="text-sm text-foreground/90">
                                {report.reportText}
                            </p>
                        </CardContent>
                    </Card>
                ))
            ) : (
                <Card>
                    <CardContent className="p-6 text-center text-muted-foreground">
                        Belum ada laporan yang dibuat.
                    </CardContent>
                </Card>
            )}
            <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Halaman {page}</span>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handlePrevPage} disabled={page === 1 || loading}>
                        <ChevronLeft className="h-4 w-4 mr-1" />
                        Sebelumnya
                    </Button>
                     <Button variant="outline" size="sm" onClick={handleNextPage} disabled={isLastPage || loading}>
                        Selanjutnya
                        <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                </div>
            </div>
        </div>
    );
}
