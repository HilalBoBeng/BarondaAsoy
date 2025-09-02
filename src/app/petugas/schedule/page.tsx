
"use client";

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase/client';
import { collection, onSnapshot, query, where, Timestamp, doc, updateDoc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { ScheduleEntry } from '@/lib/types';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Calendar, User, Clock, MapPin, Check, FileText, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';

const reasonSchema = z.object({
  reason: z.string().min(5, "Alasan harus diisi (minimal 5 karakter)."),
});

type ReasonFormValues = z.infer<typeof reasonSchema>;
type AbsenceType = 'Izin' | 'Sakit';

const statusConfig: Record<string, {
    variant: 'default' | 'secondary' | 'outline' | 'destructive';
    label: string;
    className?: string;
}> = {
  'Pending': { variant: 'outline', label: 'Menunggu' },
  'In Progress': { variant: 'default', label: 'Bertugas' },
  'Completed': { variant: 'secondary', label: 'Selesai' },
  'Izin': { variant: 'destructive', label: 'Izin' },
  'Sakit': { variant: 'destructive', label: 'Sakit' },
  'Pending Review': { variant: 'default', className:'bg-yellow-500 hover:bg-yellow-600', label: 'Menunggu Persetujuan' },
};


export default function PetugasSchedulePage() {
  const [schedules, setSchedules] = useState<ScheduleEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [petugasName, setPetugasName] = useState<string | null>(null);
  const [currentSchedule, setCurrentSchedule] = useState<ScheduleEntry | null>(null);
  const [isAbsenceDialogOpen, setIsAbsenceDialogOpen] = useState(false);
  const [absenceType, setAbsenceType] = useState<AbsenceType>('Izin');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  
  const reasonForm = useForm<ReasonFormValues>({ resolver: zodResolver(reasonSchema) });

  useEffect(() => {
    const staffInfo = JSON.parse(localStorage.getItem('staffInfo') || '{}');
    if (staffInfo.name) {
      setPetugasName(staffInfo.name);

      const q = query(
        collection(db, "schedules"),
        where("officer", "==", staffInfo.name)
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
    } else {
        setLoading(false);
    }
  }, []);

  const handleUpdateStatus = async (schedule: ScheduleEntry, status: ScheduleEntry['status'], reason?: string) => {
    if (!schedule) return;
    setIsSubmitting(true);
    try {
        const docRef = doc(db, 'schedules', schedule.id);
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
    if(currentSchedule) {
        handleUpdateStatus(currentSchedule, absenceType, values.reason);
    }
  };
  
  const handleOpenAbsenceDialog = (schedule: ScheduleEntry, type: AbsenceType) => {
      setCurrentSchedule(schedule);
      setAbsenceType(type);
      reasonForm.reset({ reason: '' });
      setIsAbsenceDialogOpen(true);
  }
  
  const ScheduleCard = ({ schedule }: { schedule: ScheduleEntry }) => {
    const { status, area, time, date, officer } = schedule;
    const config = statusConfig[status] || statusConfig['Pending'];

    return (
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="h-4 w-4" /> {area}
            </CardTitle>
            <Badge variant={config.variant} className={config.className}>{config.label}</Badge>
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
         <CardFooter className="flex-col sm:flex-row gap-2">
            {schedule.status === 'Pending' && (
                <>
                    <Button className="w-full sm:w-auto" onClick={() => handleUpdateStatus(schedule, 'In Progress')} disabled={isSubmitting}><Check className="mr-2 h-4 w-4" /> Konfirmasi Hadir</Button>
                    <Button variant="secondary" className="w-full sm:w-auto" onClick={() => handleOpenAbsenceDialog(schedule, 'Izin')} disabled={isSubmitting}><FileText className="mr-2 h-4 w-4" /> Ajukan Izin</Button>
                    <Button variant="secondary" className="w-full sm:w-auto" onClick={() => handleOpenAbsenceDialog(schedule, 'Sakit')} disabled={isSubmitting}><Info className="mr-2 h-4 w-4" /> Lapor Sakit</Button>
                </>
            )}
            {schedule.status === 'In Progress' && <Button className="w-full" onClick={() => handleUpdateStatus(schedule, 'Pending Review')} disabled={isSubmitting}><Check className="mr-2 h-4 w-4" /> Ajukan Penyelesaian</Button>}
            {(schedule.status === 'Completed' || schedule.status === 'Izin' || schedule.status === 'Sakit' || schedule.status === 'Pending Review') && <p className="text-sm text-muted-foreground text-center w-full">Tugas untuk hari ini telah ditandai.</p>}
        </CardFooter>
      </Card>
    );
  };


  return (
    <>
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
        <Dialog open={isAbsenceDialogOpen} onOpenChange={setIsAbsenceDialogOpen}>
            <DialogContent className="rounded-lg">
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
    </>
  );
}
