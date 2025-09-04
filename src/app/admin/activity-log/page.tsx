
"use client";

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase/client';
import { collection, onSnapshot, query, orderBy, Timestamp, limit, startAfter, endBefore, limitToLast, type DocumentData, type QueryDocumentSnapshot } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import type { AdminLog } from '@/lib/types';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { Button } from '@/components/ui/button';

const LOGS_PER_PAGE = 20;

export default function AdminActivityLogPage() {
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [firstVisible, setFirstVisible] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [lastVisible, setLastVisible] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [isLastPage, setIsLastPage] = useState(false);

  useEffect(() => {
    const fetchLogs = (direction: 'next' | 'prev' | 'initial' = 'initial') => {
        setLoading(true);
        let logsQuery;
        const logsRef = collection(db, 'admin_logs');

        if (direction === 'next' && lastVisible) {
            logsQuery = query(logsRef, orderBy('timestamp', 'desc'), startAfter(lastVisible), limit(LOGS_PER_PAGE));
        } else if (direction === 'prev' && firstVisible) {
             logsQuery = query(logsRef, orderBy('timestamp', 'desc'), endBefore(firstVisible), limitToLast(LOGS_PER_PAGE));
        } else {
            logsQuery = query(logsRef, orderBy('timestamp', 'desc'), limit(LOGS_PER_PAGE));
        }

        const unsubscribe = onSnapshot(logsQuery, (snapshot) => {
            if (snapshot.empty) {
                setIsLastPage(true);
                setLoading(false);
                return;
            }

            const logsData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                timestamp: (doc.data().timestamp as Timestamp).toDate(),
            })) as AdminLog[];
            
            setLogs(logsData);
            setFirstVisible(snapshot.docs[0]);
            setLastVisible(snapshot.docs[snapshot.docs.length - 1]);
            setIsLastPage(snapshot.docs.length < LOGS_PER_PAGE);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching logs:", error);
            setLoading(false);
        });

        return unsubscribe;
    };
    
    const unsubscribe = fetchLogs();
    return () => unsubscribe();
  }, []);

  const goToNextPage = () => {
    setCurrentPage(prev => prev + 1);
    // The useEffect will re-run and fetch the next page because lastVisible will be updated
  };

  const goToPrevPage = () => {
    setCurrentPage(prev => prev - 1);
     // The useEffect will re-run and fetch the previous page
  };


  return (
    <Card>
      <CardHeader>
        <CardTitle>Log Aktivitas Admin</CardTitle>
        <CardDescription>Catatan semua tindakan penting yang dilakukan oleh administrator.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Waktu</TableHead>
                  <TableHead>Nama Admin</TableHead>
                  <TableHead>Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 10 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-5 w-36" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-full" /></TableCell>
                    </TableRow>
                  ))
                ) : logs.length > 0 ? (
                  logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="whitespace-nowrap">{format(log.timestamp as Date, 'd MMM yyyy, HH:mm:ss', { locale: id })}</TableCell>
                      <TableCell>{log.adminName}</TableCell>
                      <TableCell>{log.action}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={3} className="h-24 text-center">
                      Belum ada aktivitas admin yang tercatat.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
       <CardFooter>
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
      </CardFooter>
    </Card>
  );
}
