
"use client";

import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy, limit, startAfter, getDocs, QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import type { Report } from '@/lib/types';
import { Skeleton } from '../ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { ChevronLeft, ChevronRight, CheckCircle, AlertTriangle } from 'lucide-react';
import { triageReport } from '@/ai/flows/triage-report';

const threatLevelConfig = {
    low: { variant: 'secondary', className: 'bg-green-100 text-green-800', label: 'Rendah' },
    medium: { variant: 'secondary', className: 'bg-yellow-100 text-yellow-800', label: 'Sedang' },
    high: { variant: 'destructive', className: '', label: 'Tinggi' },
} as const;

const ThreatLevelBadge = ({ level }: { level: 'low' | 'medium' | 'high' }) => {
    const config = threatLevelConfig[level];
    const Icon = level === 'high' || level === 'medium' ? AlertTriangle : CheckCircle;
    return (
        <Badge variant={config.variant} className={`capitalize ${config.className}`}>
            <Icon className="mr-1 h-3 w-3" />
            {config.label}
        </Badge>
    );
};

export default function ReportHistory() {
    const [reports, setReports] = useState<Report[]>([]);
    const [loading, setLoading] = useState(true);
    const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
    const [firstDoc, setFirstDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
    const [page, setPage] = useState(1);
    const [isLastPage, setIsLastPage] = useState(false);

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
                    createdAt: data.createdAt?.toDate()?.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }) || 'N/A',
                 } as Report;
            });
            
            setReports(reportsData);
            setFirstDoc(querySnapshot.docs[0]);
            setLastDoc(querySnapshot.docs[querySnapshot.docs.length - 1]);
            setLoading(false);
            
            // Check if it's the last page
            const nextQuery = query(collection(db, 'reports'), orderBy('createdAt', 'desc'), startAfter(querySnapshot.docs[querySnapshot.docs.length - 1]), limit(1));
            const nextDocs = await getDocs(nextQuery);
            setIsLastPage(nextDocs.empty);
        });

        return () => unsubscribe();
    };
    
    useEffect(() => {
        const unsubscribe = fetchReports('initial');
        return () => {
            if (typeof unsubscribe === 'function') {
                unsubscribe();
            }
        };
    }, []);

    const handleNextPage = () => {
        setPage(prev => prev + 1);
        fetchReports('next');
    };

    const handlePrevPage = () => {
        // This is tricky with cursors. For simplicity, we will just refetch the initial page.
        // A more complex solution would involve storing cursor snapshots for each page.
        setPage(prev => Math.max(1, prev - 1));
        fetchReports('initial'); // Re-fetching the first page for simplicity
    };


    return (
        <div className="space-y-4">
             <div className="rounded-lg border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Tanggal</TableHead>
                            <TableHead>Pelapor</TableHead>
                            <TableHead>Laporan</TableHead>
                            <TableHead className="text-right">Tingkat Ancaman</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <TableRow key={i}>
                                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                                    <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                                    <TableCell><Skeleton className="h-5 w-full" /></TableCell>
                                    <TableCell className="text-right"><Skeleton className="h-6 w-24 ml-auto" /></TableCell>
                                </TableRow>
                            ))
                        ) : reports.length > 0 ? (
                            reports.map((report) => (
                                <TableRow key={report.id}>
                                    <TableCell className="font-medium">{report.createdAt as string}</TableCell>
                                    <TableCell>{report.reporterName}</TableCell>
                                    <TableCell className="max-w-xs truncate">{report.reportText}</TableCell>
                                    <TableCell className="text-right">
                                        <ThreatLevelBadge level={report.triageResult.threatLevel} />
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center h-24">
                                    Belum ada laporan yang dibuat.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
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

