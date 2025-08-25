"use client";

import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { db } from '@/lib/firebase/client';
import type { ScheduleEntry } from '@/lib/types';
import { Skeleton } from '../ui/skeleton';

const statusMap: Record<ScheduleEntry['status'], string> = {
  Completed: 'Selesai',
  Pending: 'Tertunda',
  'In Progress': 'Berlangsung',
};

const statusVariant: Record<
  ScheduleEntry['status'],
  'default' | 'secondary' | 'outline'
> = {
  Completed: 'secondary',
  Pending: 'outline',
  'In Progress': 'default',
};

export default function Schedule() {
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'schedules'), orderBy('date', 'asc'));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const scheduleData: ScheduleEntry[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        scheduleData.push({ 
            id: doc.id,
             ...data,
            date: data.date.toDate ? data.date.toDate().toLocaleDateString('id-ID') : data.date
        } as ScheduleEntry);
      });
      setSchedule(scheduleData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tanggal</TableHead>
            <TableHead>Waktu</TableHead>
            <TableHead>Petugas</TableHead>
            <TableHead>Area</TableHead>
            <TableHead className="text-right">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-6 w-24 ml-auto" /></TableCell>
                </TableRow>
            ))
          ) : (
            schedule.map((entry) => (
                <TableRow key={entry.id}>
                <TableCell className="font-medium">{entry.date as string}</TableCell>
                <TableCell>{entry.time}</TableCell>
                <TableCell>{entry.officer}</TableCell>
                <TableCell>{entry.area}</TableCell>
                <TableCell className="text-right">
                    <Badge variant={statusVariant[entry.status]}>
                    {statusMap[entry.status]}
                    </Badge>
                </TableCell>
                </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
