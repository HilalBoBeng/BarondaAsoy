
"use client";

import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy, limit, startAfter, getDocs, QueryDocumentSnapshot, DocumentData, Timestamp, where } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import type { Report, Reply } from '@/lib/types';
import { Skeleton } from '../ui/skeleton';
import { Card, CardContent, CardFooter } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { ChevronLeft, ChevronRight, MessageSquare } from 'lucide-react';
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

    useEffect(() => {
        if (!user) {
            setLoading(false);
            return;
        }

        const reportsRef = collection(db, 'reports');
        const q = query(reportsRef, where('userId', '==', user.uid), orderBy('createdAt', 'desc'), limit(10)); // Fetch last 10 reports

        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            setLoading(true);
            if (querySnapshot.empty) {
                setReports([]);
                setLoading(false);
                return;
            }

            const reportsData: Report[] = querySnapshot.docs.map(doc => {
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
            
            setReports(reportsData);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching reports:", error);
            setLoading(false);
        });

        return () => unsubscribe();
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
                        {report.replies && report.replies.length > 0 && (
                            <CardFooter className="flex-col items-start gap-2 p-4 pt-0">
                                 <h4 className="text-xs font-semibold flex items-center gap-1">
                                    <MessageSquare className="h-3 w-3" />
                                    Balasan:
                                 </h4>
                                {report.replies.map((reply, index) => (
                                    <ReplyCard key={index} reply={reply} />
                                ))}
                            </CardFooter>
                        )}
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
