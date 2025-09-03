
"use client";

import { useState, useEffect, use } from 'react';
import { db } from '@/lib/firebase/client';
import { doc, getDoc, onSnapshot, Timestamp } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { ScheduleEntry } from '@/lib/types';
import { notFound } from 'next/navigation';
import { format, formatDistanceToNow } from 'date-fns';
import { id } from 'date-fns/locale';
import { Calendar, Clock, User, MapPin, Loader2, RefreshCw, QrCode, CheckCircle } from 'lucide-react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { generateScheduleToken } from '@/ai/flows/generate-schedule-token';

export default function ScheduleDetailPage({ params }: { params: { scheduleId: string } }) {
  const { scheduleId } = use(params);
  const [schedule, setSchedule] = useState<ScheduleEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!scheduleId) {
      notFound();
      return;
    }

    const docRef = doc(db, 'schedules', scheduleId);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
            setSchedule({ id: docSnap.id, ...docSnap.data() } as ScheduleEntry);
        } else {
            notFound();
        }
        setLoading(false);
    });

    return () => unsubscribe();
  }, [scheduleId]);
  
  const handleGenerateToken = async () => {
    setIsGenerating(true);
    try {
        const result = await generateScheduleToken({ scheduleId });
        if (result.success) {
            toast({ title: "Berhasil", description: "Kode QR absensi baru telah dibuat." });
        } else {
            throw new Error(result.message);
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Terjadi kesalahan";
        toast({ variant: 'destructive', title: "Gagal", description: `Tidak dapat membuat token: ${errorMessage}` });
    } finally {
        setIsGenerating(false);
    }
  }


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
  const tokenExpires = schedule.qrTokenExpires ? (schedule.qrTokenExpires as Timestamp).toDate() : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Detail Jadwal & Kode Absensi</CardTitle>
        <CardDescription>
            Buat kode untuk memulai sesi patroli. Kode hanya berlaku selama 24 jam setelah dibuat.
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

        {schedule.status === 'In Progress' || schedule.status === 'Completed' ? (
           <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg bg-green-50 text-green-800">
                 <CheckCircle className="h-10 w-10 mb-2" />
                 <p className="font-semibold">Kode absensi telah digunakan.</p>
                 <p className="text-xs">Sesi patroli ini sedang atau telah berlangsung.</p>
            </div>
        ) : schedule.qrToken ? (
            <div className="flex flex-col items-center gap-4">
                <div className="p-4 border rounded-lg bg-white">
                    <Image
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${schedule.qrToken}`}
                        alt={`QR Code untuk jadwal ${schedule.id}`}
                        width={200}
                        height={200}
                        priority
                    />
                </div>
                {tokenExpires && (
                    <p className="text-xs text-muted-foreground">
                        Berlaku hingga: {format(tokenExpires, "d MMM yyyy, HH:mm", { locale: id })} ({formatDistanceToNow(tokenExpires, { addSuffix: true, locale: id })})
                    </p>
                )}
                 <Button onClick={handleGenerateToken} disabled={isGenerating}>
                    {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                    Buat Ulang Kode
                </Button>
            </div>
        ) : (
            <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg">
                 <p className="text-muted-foreground mb-4">Belum ada kode absensi untuk jadwal ini.</p>
                 <Button onClick={handleGenerateToken} disabled={isGenerating}>
                    {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <QrCode className="mr-2 h-4 w-4" />}
                    Buat Kode Absensi
                </Button>
            </div>
        )}
       
        <p className="text-xs text-muted-foreground max-w-xs pt-4">
            Petugas akan memindai kode ini untuk memulai patroli. Kode ini unik dan memiliki batas waktu.
        </p>
      </CardContent>
    </Card>
  );
}
