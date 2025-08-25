
"use client";

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { db } from '@/lib/firebase/client';
import { collection, query, where, onSnapshot, doc, updateDoc, Timestamp, getCountFromServer } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Calendar, Clock, Loader2, Info, Check, X, FileText, Shield, Star, ClipboardCheck } from 'lucide-react';
import type { ScheduleEntry, Notification } from '@/lib/types';
import { isToday, format, formatDistanceToNow } from 'date-fns';
import { id } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

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
  'In Progress': { variant: 'default', label: 'Sedang Bertugas' },
  'Completed': { variant: 'secondary', label: 'Selesai' },
  'Izin': { variant: 'destructive', label: 'Izin' },
  'Sakit': { variant: 'destructive', label: 'Sakit' },
  'Pending Review': { variant: 'default', className:'bg-yellow-500 hover:bg-yellow-600', label: 'Menunggu Persetujuan' },
};


export default function PetugasPage() {
  const [scheduleToday, setScheduleToday] = useState<ScheduleEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [petugasId, setPetugasId] = useState<string | null>(null);
  const [petugasName, setPetugasName] = useState<string | null>(null);
  const { toast } = useToast();
  const [greeting, setGreeting] = useState("Selamat Datang");
  const [currentTime, setCurrentTime] = useState("");
  const [currentDate, setCurrentDate] = useState("");
  const [stats, setStats] = useState({ assignedReports: 0, completedReports: 0, points: 0 });
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loadingNotifications, setLoadingNotifications] = useState(true);

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
    if (staffInfo.id && staffInfo.name) {
      setPetugasId(staffInfo.id);
      setPetugasName(staffInfo.name);

      // Fetch schedule
      const scheduleQuery = query(collection(db, "schedules"), where("officer", "==", staffInfo.name));
      const unsubSchedule = onSnapshot(scheduleQuery, (snapshot) => {
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

      // Fetch stats
      const reportsRef = collection(db, "reports");
      const assignedQuery = query(reportsRef, where("handlerId", "==", staffInfo.id), where("status", "==", "in_progress"));
      const completedQuery = query(reportsRef, where("handlerId", "==", staffInfo.id), where("status", "==", "resolved"));
      const staffDocRef = doc(db, "staff", staffInfo.id);

      const unsubStats = onSnapshot(staffDocRef, (doc) => {
          if (doc.exists()) {
              setStats(prev => ({ ...prev, points: doc.data().points || 0 }));
          }
      });
      getCountFromServer(assignedQuery).then(snap => setStats(prev => ({ ...prev, assignedReports: snap.data().count })));
      getCountFromServer(completedQuery).then(snap => setStats(prev => ({ ...prev, completedReports: snap.data().count })));
      
      // Fetch Notifications
      const notifsQuery = query(collection(db, "notifications"), where("userId", "==", staffInfo.id));
      const unsubNotifs = onSnapshot(notifsQuery, (snapshot) => {
        const notifs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as Notification}));
        setNotifications(notifs);
        setLoadingNotifications(false);
      });

      return () => {
        clearInterval(timer);
        unsubSchedule();
        unsubStats();
        unsubNotifs();
      }
    } else {
        setLoading(false);
        setLoadingNotifications(false);
        return () => clearInterval(timer);
    }
  }, [toast]);

  const statCards = [
    { title: "Laporan Ditugaskan", value: stats.assignedReports, icon: Shield },
    { title: "Total Poin", value: stats.points, icon: Star },
    { title: "Laporan Selesai", value: stats.completedReports, icon: ClipboardCheck },
  ];

  return (
    <div className="space-y-6">
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
      
        {loading ? <Skeleton className="h-56 w-full" /> :
          !scheduleToday ? (
            <Card>
              <CardHeader><CardTitle>Tidak Ada Jadwal Hari Ini</CardTitle></CardHeader>
              <CardContent><p className="text-muted-foreground">Anda tidak memiliki jadwal patroli untuk hari ini.</p></CardContent>
            </Card>
          ) : (
            <Card className="w-full">
                <CardHeader>
                    <div className="flex justify-between items-start">
                        <div>
                            <CardTitle>Jadwal Anda Hari Ini</CardTitle>
                            <CardDescription>{format(new Date(), "EEEE, d MMMM yyyy", { locale: id })}</CardDescription>
                        </div>
                        <Badge variant={statusConfig[scheduleToday.status].variant} className={statusConfig[scheduleToday.status].className}>
                            {statusConfig[scheduleToday.status].label}
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="flex items-center gap-3 text-muted-foreground"><Clock className="h-5 w-5" /><span className="font-semibold text-foreground">{scheduleToday.time}</span></div>
                    <div className="flex items-center gap-3 text-muted-foreground"><Calendar className="h-5 w-5" /><span className="font-semibold text-foreground">{scheduleToday.area}</span></div>
                    {(scheduleToday.status === 'Izin' || scheduleToday.status === 'Sakit') && scheduleToday.reason && (
                        <div className="flex items-start gap-3 text-muted-foreground border-t pt-3 mt-3">
                            <Info className="h-5 w-5 mt-1" /><div className="flex-1"><span className="font-semibold text-foreground">Alasan:</span><p className="text-sm text-foreground/80">{scheduleToday.reason}</p></div>
                        </div>
                    )}
                </CardContent>
            </Card>
        )}

       <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                  <Card key={i}><CardHeader><Skeleton className="h-5 w-2/3" /></CardHeader><CardContent><Skeleton className="h-8 w-1/3" /></CardContent></Card>
              ))
          ) : (
              statCards.map((card, i) => (
                  <Card key={i}>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                          <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
                          <card.icon className="h-5 w-5 text-primary" />
                      </CardHeader>
                      <CardContent>
                          <div className="text-2xl font-bold">{card.value}</div>
                      </CardContent>
                  </Card>
              ))
          )}
      </div>
      
      <div className="grid gap-6 md:grid-cols-2 items-start">
        {/* Notifications Card */}
        <Card className="w-full">
            <CardHeader><CardTitle>Pemberitahuan Terbaru</CardTitle></CardHeader>
            <CardContent className="space-y-3 max-h-56 overflow-auto">
                {loadingNotifications ? <Skeleton className="h-24 w-full" /> : 
                notifications.length > 0 ? (
                    notifications.map(notif => (
                        <Link href={notif.link || '#'} key={notif.id} className="block border-l-4 border-primary pl-3 hover:bg-muted/50 rounded-r-md">
                           <p className="font-semibold text-sm">{notif.title}</p>
                           <p className="text-xs text-muted-foreground truncate">{notif.message}</p>
                           <p className="text-xs text-muted-foreground mt-1">{notif.createdAt ? formatDistanceToNow((notif.createdAt as any).toDate(), { addSuffix: true, locale: id }) : ''}</p>
                        </Link>
                    ))
                ) : (
                    <p className="text-center text-sm text-muted-foreground py-4">Tidak ada pemberitahuan baru.</p>
                )}
            </CardContent>
        </Card>
      </div>
    </div>
  );
}
