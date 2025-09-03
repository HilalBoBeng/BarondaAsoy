
"use client";

import { useState, useEffect, use } from 'react';
import { db } from '@/lib/firebase/client';
import { doc, getDoc, Timestamp } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { ScheduleEntry } from '@/lib/types';
import { notFound } from 'next/navigation';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { Calendar, Clock, User, MapPin } from 'lucide-react';
import Image from 'next/image';

export default function ScheduleDetailPage({ params }: { params: { scheduleId: string } }) {
  const { scheduleId } = params;
  const [schedule, setSchedule] = useState<ScheduleEntry | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!scheduleId) {
      notFound();
      return;
    }

    const fetchSchedule = async () => {
      setLoading(true);
      const docRef = doc(db, 'schedules', scheduleId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        setSchedule({ id: docSnap.id, ...docSnap.data() } as ScheduleEntry);
      } else {
        notFound();
      }
      setLoading(false);
    };

    fetchSchedule();
  }, [scheduleId]);

  if (loading) {
    return (
        <Card>
            <CardHeader><Skeleton className="h-8 w-3/4" /></CardHeader>
            <CardContent className="space-y-4">
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-1/2" />
                <Skeleton className="h-48 w-48 mx-auto" />
                <Skeleton className="h-5 w-full" />
            </CardContent>
        </Card>
    )
  }

  if (!schedule) {
    notFound();
  }

  const scheduleDate = (schedule.date as Timestamp).toDate();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Detail Jadwal & QR Absensi</CardTitle>
        <CardDescription>
            Petugas akan memindai QR code ini untuk memulai patroli.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center text-center space-y-6">
        <div className="space-y-2">
            <div className="flex items-center justify-center gap-2 text-lg">
                <User className="h-5 w-5" />
                <span className="font-bold">{schedule.officer}</span>
            </div>
             <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span>{schedule.area}</span>
            </div>
             <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>{format(scheduleDate, "EEEE, d MMMM yyyy", { locale: id })}</span>
            </div>
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>{schedule.time}</span>
            </div>
        </div>

        <div className="p-4 border rounded-lg bg-white">
             <Image
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${schedule.id}`}
                alt={`QR Code untuk jadwal ${schedule.id}`}
                width={200}
                height={200}
                priority
            />
        </div>
        <p className="text-xs text-muted-foreground max-w-xs">
            Tunjukkan kode ini kepada petugas yang bersangkutan. Kode ini unik untuk setiap jadwal.
        </p>
      </CardContent>
    </Card>
  );
}
