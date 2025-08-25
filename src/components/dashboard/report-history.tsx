
"use client";

import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy, limit, startAfter, getDocs, QueryDocumentSnapshot, DocumentData, Timestamp, where } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import type { Report } from '@/lib/types';
import { Skeleton } from '../ui/skeleton';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { id } from 'date-fns/locale';
import type { User } from 'firebase/auth';

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

export default function ReportHistory({ user }: { user: User | null }) {
    const [reports, setReports] = useState<Report[]>([]);
    const [loading, setLoading] = useState(true);
    const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
    const [firstDoc, setFirstDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
    const [isLastPage, setIsLastPage] = useState(false);
    const [page, setPage] = useState(1);

    const reportsPerPage = 5;

    useEffect(() => {
        if (!user) {
            setLoading(false);
            return;
        }

        const fetchReports = () => {
            setLoading(true);
            const reportsRef = collection(db, 'reports');
            const q = query(reportsRef, where('userId', '==', user.uid), orderBy('createdAt', 'desc'), limit(reportsPerPage));

            const unsubscribe = onSnapshot(q, async (querySnapshot) => {
                if (querySnapshot.empty) {
                    setReports([]);
                    setLoading(false);
                    setIsLastPage(true);
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
                setFirstDoc(querySnapshot.docs[0]);
                const newLastDoc = querySnapshot.docs[querySnapshot.docs.length - 1];
                setLastDoc(newLastDoc);
                
                const nextQuery = query(collection(db, 'reports'), where('userId', '==', user.uid), orderBy('createdAt', 'desc'), startAfter(newLastDoc), limit(1));
                const nextDocs = await getDocs(nextQuery);
                setIsLastPage(nextDocs.empty);

                setLoading(false);
            }, (error) => {
                console.error("Error fetching reports:", error);
                setLoading(false);
            });

            return unsubscribe;
        };

        const unsubscribe = fetchReports();
        return () => {
            if (unsubscribe) {
                unsubscribe();
            }
        };
    }, [user]);

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
                    </Card>
                ))
            ) : (
                <Card>
                    <CardContent className="p-6 text-center text-muted-foreground">
                        Anda belum pernah membuat laporan.
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

    