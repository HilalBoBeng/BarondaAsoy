
"use client";

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase/client';
import { doc, onSnapshot, Timestamp } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { ScheduleEntry } from '@/lib/types';
import { notFound, useParams } from 'next/navigation';
import { format, formatDistanceToNow } from 'date-fns';
import { id } from 'date-fns/locale';
import { Calendar, Clock, User, MapPin, Loader2, RefreshCw, QrCode, CheckCircle, Hourglass } from 'lucide-react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { generateScheduleToken } from '@/ai/flows/generate-schedule-token';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';


export default function ScheduleDetailPage() {
  const params = useParams();
  const scheduleId = params.scheduleId as string;
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
            const data = docSnap.data();
            setSchedule({ 
                id: docSnap.id, 
                ...data,
                startDate: (data.startDate as Timestamp).toDate(),
                endDate: (data.endDate as Timestamp).toDate(),
            } as ScheduleEntry);
        } else {
            notFound();
        }
        setLoading(false);
    });

    return () => unsubscribe();
  }, [scheduleId]);
  
  const handleGenerateToken = async (type: 'start' | 'end') => {
    setIsGenerating(true);
    try {
        const result = await generateScheduleToken({ scheduleId, type });
        if (result.success) {
            toast({ title: "Berhasil", description: `Kode QR untuk ${type === 'start' ? 'memulai' : 'mengakhiri'} tugas telah dibuat.` });
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

  const scheduleStartDate = (schedule.startDate as Date);
  const scheduleEndDate = (schedule.endDate as Date);
  const isSameDay = format(scheduleStartDate, 'yyyy-MM-dd') === format(scheduleEndDate, 'yyyy-MM-dd');
  const dateDisplay = isSameDay 
    ? format(scheduleStartDate, "EEEE, d MMMM yyyy", { locale: id })
    : `${format(scheduleStartDate, "d MMM", { locale: id })} - ${format(scheduleEndDate, "d MMM yyyy", { locale: id })}`;

  const TokenDisplay = ({ type, token, expires, isTaskInProgress, isTaskCompleted }: { type: 'start' | 'end', token?: string, expires?: Timestamp, isTaskInProgress: boolean, isTaskCompleted: boolean }) => {
    const tokenExpiresDate = expires ? expires.toDate() : null;
    const isUsed = type === 'start' ? isTaskInProgress || isTaskCompleted : isTaskCompleted;
    
    if (isUsed) {
         return (
           <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg bg-green-50 text-green-800">
                 <CheckCircle className="h-10 w-10 mb-2" />
                 <p className="font-semibold">Kode QR telah digunakan.</p>
                 <p className="text-xs">Sesi ini telah {type === 'start' ? 'dimulai' : 'selesai'}.</p>
            </div>
        )
    }

    if (token) {
       return (
            <div className="flex flex-col items-center gap-4">
                <div className="p-4 border rounded-lg bg-white">
                    <Image
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${token}`}
                        alt={`QR Code untuk ${type}`}
                        width={200}
                        height={200}
                        priority
                    />
                </div>
                {tokenExpiresDate && (
                    <p className="text-xs text-muted-foreground">
                        Berlaku hingga: {format(tokenExpiresDate, "d MMM yyyy, HH:mm", { locale: id })} ({formatDistanceToNow(tokenExpiresDate, { addSuffix: true, locale: id })})
                    </p>
                )}
                 <Button onClick={() => handleGenerateToken(type)} disabled={isGenerating}>
                    {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                    Buat Ulang Kode
                </Button>
            </div>
        )
    }
    
    return (
        <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg">
             <p className="text-muted-foreground mb-4 text-center">Belum ada kode absensi untuk {type === 'start' ? 'memulai' : 'mengakhiri'} tugas.</p>
             <Button onClick={() => handleGenerateToken(type)} disabled={isGenerating}>
                {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <QrCode className="mr-2 h-4 w-4" />}
                Buat Kode
            </Button>
        </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Detail Jadwal & Kode Absensi</CardTitle>
        <CardDescription>
            Buat kode untuk memulai dan mengakhiri sesi patroli. Setiap kode hanya berlaku selama 24 jam.
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
                <span>{dateDisplay}</span>
            </div>
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>{schedule.time}</span>
            </div>
        </div>

        <Tabs defaultValue="start" className="w-full max-w-md">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="start">Mulai Tugas</TabsTrigger>
                <TabsTrigger value="end" disabled={!schedule.patrolStartTime}>Selesai Tugas</TabsTrigger>
            </TabsList>
            <TabsContent value="start" className="mt-4">
                <TokenDisplay type="start" token={schedule.qrTokenStart} expires={schedule.qrTokenStartExpires} isTaskInProgress={!!schedule.patrolStartTime} isTaskCompleted={schedule.status === 'Completed'}/>
            </TabsContent>
            <TabsContent value="end" className="mt-4">
                 <TokenDisplay type="end" token={schedule.qrTokenEnd} expires={schedule.qrTokenEndExpires} isTaskInProgress={!!schedule.patrolStartTime} isTaskCompleted={schedule.status === 'Completed'}/>
            </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
