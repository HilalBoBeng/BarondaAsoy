
"use client";

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase/client';
import { collection, onSnapshot, query, where, Timestamp } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { ScheduleEntry } from '@/lib/types';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Calendar, User, Clock, MapPin } from 'lucide-react';

const statusConfig: Record<ScheduleEntry['status'], {
    variant: 'default' | 'secondary' | 'outline' | 'destructive';
    label: string;
}> = {
  'Pending': { variant: 'outline', label: 'Menunggu' },
  'In Progress': { variant: 'default', label: 'Bertugas' },
  'Completed': { variant: 'secondary', label: 'Selesai' },
  'Izin': { variant: 'destructive', label: 'Izin' },
  'Sakit': { variant: 'destructive', label: 'Sakit' },
};


export default function PetugasSchedulePage() {
  const [schedules, setSchedules] = useState<ScheduleEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [petugasName, setPetugasName] = useState<string | null>(null); // Placeholder for auth

  useEffect(() => {
    // TODO: This should be fetched from a proper auth session
    const name = "Petugas A"; // Placeholder
    setPetugasName(name);

    const q = query(
      collection(db, "schedules"),
      where("officer", "==", name)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const scheduleData = snapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data(),
          date: (doc.data().date as Timestamp).toDate(),
        }))
        .sort((a, b) => b.date.getTime() - a.date.getTime()) as ScheduleEntry[];

      setSchedules(scheduleData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching schedules:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);
  
  const ScheduleCard = ({ schedule }: { schedule: ScheduleEntry }) => {
    const { status, area, time, date, officer } = schedule;

    return (
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="h-4 w-4" /> {area}
            </CardTitle>
            <Badge variant={statusConfig[status].variant}>{statusConfig[status].label}</Badge>
          </div>
          <CardDescription className="flex items-center gap-2 pt-1">
             <Calendar className="h-4 w-4" />
             {format(date as Date, "EEEE, d MMMM yyyy", { locale: id })}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
           <p className="flex items-center gap-2"><Clock className="h-4 w-4 text-muted-foreground" /> {time}</p>
           <p className="flex items-center gap-2"><User className="h-4 w-4 text-muted-foreground" /> {officer}</p>
        </CardContent>
      </Card>
    );
  };


  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Riwayat Jadwal Patroli Saya</CardTitle>
          <CardDescription>Berikut adalah semua jadwal patroli yang telah dan akan Anda lakukan.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
            {loading ? (
                Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)
            ) : schedules.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {schedules.map(schedule => (
                        <ScheduleCard key={schedule.id} schedule={schedule} />
                    ))}
                </div>
            ) : (
                <div className="text-center py-12 text-muted-foreground">
                    Anda belum memiliki riwayat jadwal.
                </div>
            )}
        </CardContent>
      </Card>
    </div>
  );
}
