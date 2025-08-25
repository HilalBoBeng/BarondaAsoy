
"use client";

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { db } from '@/lib/firebase/client';
import { collection, query, where, onSnapshot, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Calendar, Clock, Loader2, Info, Check, X, FileText } from 'lucide-react';
import type { ScheduleEntry } from '@/lib/types';
import { isToday, format } from 'date-fns';
import { id } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';

const reasonSchema = z.object({
  reason: z.string().min(5, "Alasan harus diisi (minimal 5 karakter)."),
});

type ReasonFormValues = z.infer<typeof reasonSchema>;
type AbsenceType = 'Izin' | 'Sakit';

const statusConfig: Record<ScheduleEntry['status'], {
    variant: 'default' | 'secondary' | 'outline' | 'destructive';
    label: string;
}> = {
  'Pending': { variant: 'outline', label: 'Menunggu' },
  'In Progress': { variant: 'default', label: 'Sedang Bertugas' },
  'Completed': { variant: 'secondary', label: 'Selesai' },
  'Izin': { variant: 'destructive', label: 'Izin' },
  'Sakit': { variant: 'destructive', label: 'Sakit' },
};


export default function PetugasPage() {
  const [scheduleToday, setScheduleToday] = useState<ScheduleEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [petugasName, setPetugasName] = useState<string | null>(null);
  const [isAbsenceDialogOpen, setIsAbsenceDialogOpen] = useState(false);
  const [absenceType, setAbsenceType] = useState<AbsenceType>('Izin');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const [greeting, setGreeting] = useState("Selamat Datang");
  const [currentTime, setCurrentTime] = useState("");
  const [currentDate, setCurrentDate] = useState("");

  const reasonForm = useForm<ReasonFormValues>({ resolver: zodResolver(reasonSchema) });

  useEffect(() => {
    const getGreeting = () => {
      const hour = new Date().getHours();
      if (hour >= 5 && hour < 12) return "Selamat Pagi";
      if (hour >= 12 && hour < 15) return "Selamat Siang";
      if (hour >= 15 && hour < 19) return "Selamat Sore";
      return "Selamat Malam";
    };
    setGreeting(getGreeting());

    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('id-ID'));
      setCurrentDate(now.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }));
    }, 1000);
    
    const staffInfo = JSON.parse(localStorage.getItem('staffInfo') || '{}');
    if (staffInfo.name) {
      setPetugasName(staffInfo.name);

      const q = query(
        collection(db, "schedules"),
        where("officer", "==", staffInfo.name)
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const allSchedules = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as ScheduleEntry))
          .sort((a, b) => (b.date as Timestamp).toMillis() - (a.date as Timestamp).toMillis());
          
        const todaySchedule = allSchedules.find(schedule => isToday(schedule.date instanceof Timestamp ? schedule.date.toDate() : schedule.date as Date));
        
        setScheduleToday(todaySchedule || null);
        setLoading(false);
      }, (error) => {
          console.error("Error fetching schedule:", error);
          toast({variant: "destructive", title: "Gagal", description: "Tidak dapat memuat jadwal."})
          setLoading(false);
      });
      
      return () => {
        clearInterval(timer);
        unsubscribe();
      }
    } else {
        setLoading(false);
        return () => clearInterval(timer);
    }
  }, [toast]);
  
  const handleUpdateStatus = async (status: ScheduleEntry['status'], reason?: string) => {
    if (!scheduleToday) return;
    setIsSubmitting(true);
    try {
        const docRef = doc(db, 'schedules', scheduleToday.id);
        const updateData: Partial<ScheduleEntry> = { status };
        if (reason) {
            updateData.reason = reason.toUpperCase();
        }
        await updateDoc(docRef, updateData);
        toast({ title: 'Berhasil', description: `Status tugas berhasil diperbarui menjadi ${status}.` });
        if(isAbsenceDialogOpen) setIsAbsenceDialogOpen(false);
    } catch (error) {
        toast({ variant: 'destructive', title: 'Gagal', description: 'Gagal memperbarui status tugas.' });
    } finally {
        setIsSubmitting(false);
    }
  }

  const onAbsenceSubmit = (values: ReasonFormValues) => {
    handleUpdateStatus(absenceType, values.reason);
  };
  
  const handleOpenAbsenceDialog = (type: AbsenceType) => {
      setAbsenceType(type);
      reasonForm.reset({ reason: '' });
      setIsAbsenceDialogOpen(true);
  }

  const renderScheduleCard = () => {
    if (loading) {
      return <Skeleton className="h-48 w-full max-w-md" />;
    }

    if (!scheduleToday) {
      return (
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Tidak Ada Jadwal Hari Ini</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Anda tidak memiliki jadwal patroli untuk hari ini.</p>
          </CardContent>
        </Card>
      );
    }

    const { status, area, time, reason } = scheduleToday;
    const isPending = status === 'Pending';
    const isOngoing = status === 'In Progress';

    return (
        <Card className="max-w-md w-full">
            <CardHeader>
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle>Jadwal Anda Hari Ini</CardTitle>
                        <CardDescription>{format(new Date(), "EEEE, d MMMM yyyy", { locale: id })}</CardDescription>
                    </div>
                    <Badge variant={statusConfig[status].variant}>{statusConfig[status].label}</Badge>
                </div>
            </CardHeader>
            <CardContent className="space-y-3">
                <div className="flex items-center gap-3 text-muted-foreground">
                    <Clock className="h-5 w-5" />
                    <span className="font-semibold text-foreground">{time}</span>
                </div>
                <div className="flex items-center gap-3 text-muted-foreground">
                    <Calendar className="h-5 w-5" />
                    <span className="font-semibold text-foreground">{area}</span>
                </div>
                {(status === 'Izin' || status === 'Sakit') && reason && (
                    <div className="flex items-start gap-3 text-muted-foreground border-t pt-3 mt-3">
                        <Info className="h-5 w-5 mt-1" />
                        <div className="flex-1">
                            <span className="font-semibold text-foreground">Alasan:</span>
                            <p className="text-sm text-foreground/80">{reason}</p>
                        </div>
                    </div>
                )}
            </CardContent>
            <CardFooter className="flex-col sm:flex-row gap-2">
                 {isPending && (
                    <>
                        <Button className="w-full sm:w-auto" onClick={() => handleUpdateStatus('In Progress')}><Check className="mr-2 h-4 w-4" /> Konfirmasi Hadir</Button>
                        <Button variant="secondary" className="w-full sm:w-auto" onClick={() => handleOpenAbsenceDialog('Izin')}><FileText className="mr-2 h-4 w-4" /> Ajukan Izin</Button>
                        <Button variant="secondary" className="w-full sm:w-auto" onClick={() => handleOpenAbsenceDialog('Sakit')}><Info className="mr-2 h-4 w-4" /> Lapor Sakit</Button>
                    </>
                 )}
                 {isOngoing && (
                    <Button className="w-full" onClick={() => handleUpdateStatus('Completed')}><Check className="mr-2 h-4 w-4" /> Selesaikan Tugas</Button>
                 )}
                 {(status === 'Completed' || status === 'Izin' || status === 'Sakit') && (
                     <p className="text-sm text-muted-foreground text-center w-full">Tugas untuk hari ini telah ditandai.</p>
                 )}
            </CardFooter>
        </Card>
    );
  };

  return (
    <div className="space-y-4">
      <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
              {greeting}, {petugasName || 'Petugas'}!
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base mt-1">
              Ini adalah dasbor Anda. Silakan periksa jadwal dan laporan yang masuk.
          </p>
          <p className="text-muted-foreground text-sm sm:text-base">
              {currentDate} | {currentTime}
          </p>
      </div>
      
      <div className="pt-4">
         {renderScheduleCard()}
      </div>

       <Dialog open={isAbsenceDialogOpen} onOpenChange={setIsAbsenceDialogOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Formulir Pengajuan {absenceType}</DialogTitle>
            </DialogHeader>
            <Form {...reasonForm}>
                <form onSubmit={reasonForm.handleSubmit(onAbsenceSubmit)} className="space-y-4">
                    <FormField
                        control={reasonForm.control}
                        name="reason"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Alasan {absenceType}</FormLabel>
                            <FormControl>
                                <Textarea {...field} rows={4} placeholder={`Tulis alasan Anda ${absenceType.toLowerCase()} di sini...`} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    <DialogFooter>
                        <DialogClose asChild><Button type="button" variant="secondary">Batal</Button></DialogClose>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Kirim
                        </Button>
                    </DialogFooter>
                </form>
            </Form>
        </DialogContent>
    </Dialog>
    </div>
  );
}
