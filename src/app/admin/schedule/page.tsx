
"use client";

import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { db } from '@/lib/firebase/client';
import { collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, serverTimestamp, query, orderBy, Timestamp, getDocs, where, writeBatch } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger, DrawerFooter, DrawerClose, DrawerBody, DrawerDescription } from '@/components/ui/drawer';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger, AlertDialogFooter } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Edit, Trash, Loader2, Calendar as CalendarIcon, MapPin, User, Clock, Check, QrCode, CheckCircle, AlertCircle, Info } from 'lucide-react';
import type { ScheduleEntry, Staff } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { format, startOfDay, subDays } from 'date-fns';
import { id } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';


const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

const scheduleSchema = z.object({
  officerId: z.string().min(1, "Petugas harus dipilih."),
  area: z.string().min(1, "Area tidak boleh kosong."),
  startDate: z.date({ required_error: "Tanggal mulai patroli harus diisi." }),
  endDate: z.date({ required_error: "Tanggal selesai patroli harus diisi." }),
  startTime: z.string().regex(timeRegex, "Format jam mulai tidak valid (HH:MM)."),
  endTime: z.string().regex(timeRegex, "Format jam selesai tidak valid (HH:MM)."),
}).refine(data => data.endDate >= data.startDate, {
    message: "Tanggal selesai tidak boleh sebelum tanggal mulai.",
    path: ["endDate"],
});


type ScheduleFormValues = z.infer<typeof scheduleSchema>;

const daysOfWeek = ["minggu", "senin", "selasa", "rabu", "kamis", "jumat", "sabtu"];

export default function ScheduleAdminPage() {
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentSchedule, setCurrentSchedule] = useState<ScheduleEntry | null>(null);
  const [selectedDay, setSelectedDay] = useState<string>('all');
  const { toast } = useToast();

  const form = useForm<ScheduleFormValues>({
    resolver: zodResolver(scheduleSchema),
    defaultValues: {
      officerId: '',
      area: '',
      startTime: '',
      endTime: '',
    },
  });

  const watchedStartDate = form.watch('startDate');
  const watchedEndDate = form.watch('endDate');

  const availableStaff = useMemo(() => {
    if (!watchedStartDate) {
      return staff;
    }
    const scheduledStaffIds = schedule
      .filter(s => s.startDate && format(s.startDate as Date, 'yyyy-MM-dd') === format(watchedStartDate, 'yyyy-MM-dd'))
      .map(s => s.officerId);

    return staff.filter(s => 
      !scheduledStaffIds.includes(s.id) ||
      (currentSchedule && s.id === currentSchedule.officerId)
    );
  }, [staff, schedule, watchedStartDate, currentSchedule]);

  
  useEffect(() => {
    const staffQuery = query(collection(db, "staff"), where('status', '==', 'active'));
    const unsubStaff = onSnapshot(staffQuery, (snapshot) => {
      const staffData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Staff[];
      staffData.sort((a, b) => a.name.localeCompare(b.name));
      setStaff(staffData);
    });

    const q = query(collection(db, 'schedules'), orderBy('startDate', 'desc'));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const scheduleData: ScheduleEntry[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        startDate: doc.data().startDate?.toDate(),
        endDate: doc.data().endDate?.toDate(),
        patrolStartTime: doc.data().patrolStartTime ? doc.data().patrolStartTime.toDate() : undefined,
        patrolEndTime: doc.data().patrolEndTime ? doc.data().patrolEndTime.toDate() : undefined,
      })) as ScheduleEntry[];

       // Auto-update overdue schedules
      const now = new Date();
      const yesterday = subDays(now, 1);
      const batch = writeBatch(db);
      let updatesMade = false;

      scheduleData.forEach(s => {
        if (s.status === 'Pending' && s.endDate && (s.endDate as Date) < yesterday) {
          const scheduleRef = doc(db, 'schedules', s.id);
          batch.update(scheduleRef, { status: 'Tanpa Keterangan' });
          updatesMade = true;
          s.status = 'Tanpa Keterangan'; // Update local state immediately
        }
      });
      
      if (updatesMade) {
        try {
            await batch.commit();
            toast({ title: 'Jadwal Diperbarui', description: 'Beberapa jadwal yang terlewat telah ditandai.' });
        } catch (error) {
            console.error("Gagal memperbarui jadwal yang terlewat:", error);
        }
      }

      setSchedule(scheduleData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching schedules:", error);
      setLoading(false);
    });
    return () => {
        unsubStaff();
        unsubscribe();
    }
  }, [toast]);
  
  useEffect(() => {
    if (isDialogOpen) {
      if (currentSchedule) {
        const [startTime, endTime] = currentSchedule.time.split(' - ');
        const defaultValues = {
            ...currentSchedule,
            startDate: currentSchedule.startDate instanceof Timestamp ? currentSchedule.startDate.toDate() : (currentSchedule.startDate as Date),
            endDate: currentSchedule.endDate instanceof Timestamp ? currentSchedule.endDate.toDate() : (currentSchedule.endDate as Date),
            startTime: startTime || '',
            endTime: endTime || '',
        };
        form.reset(defaultValues as any);
      } else {
        form.reset({ officerId: '', area: '', startTime: '', endTime: '', startDate: undefined, endDate: undefined });
      }
    }
  }, [isDialogOpen, currentSchedule, form]);

  const handleDialogOpen = (schedule: ScheduleEntry | null = null) => {
    setCurrentSchedule(schedule);
    setIsDialogOpen(true);
  };

  const onSubmit = async (values: ScheduleFormValues) => {
    setIsSubmitting(true);
    const selectedStaff = staff.find(s => s.id === values.officerId);
     if (!selectedStaff) {
        toast({ variant: 'destructive', title: "Gagal", description: "Petugas tidak ditemukan." });
        setIsSubmitting(false);
        return;
    }
    try {
      const dataPayload = {
        officer: selectedStaff.name,
        officerId: selectedStaff.id,
        area: values.area,
        time: `${values.startTime} - ${values.endTime}`,
        startDate: Timestamp.fromDate(values.startDate),
        endDate: Timestamp.fromDate(values.endDate),
      };

      if (currentSchedule) {
        const docRef = doc(db, 'schedules', currentSchedule.id);
        await updateDoc(docRef, dataPayload);
        toast({ title: "Berhasil", description: "Jadwal berhasil diperbarui." });
      } else {
        await addDoc(collection(db, 'schedules'), {
            ...dataPayload,
            status: 'Pending' as ScheduleEntry['status'],
         });
        toast({ title: "Berhasil", description: "Jadwal berhasil dibuat." });
      }
      setIsDialogOpen(false);
      setCurrentSchedule(null);
    } catch (error) {
      toast({ variant: 'destructive', title: "Gagal", description: "Terjadi kesalahan." });
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'schedules', id));
      toast({ title: "Berhasil", description: "Jadwal berhasil dihapus." });
    } catch (error) {
      toast({ variant: 'destructive', title: "Gagal", description: "Tidak dapat menghapus jadwal." });
    }
  };

  const StatusBadge = ({ status }: { status: ScheduleEntry['status'] }) => {
    const config = {
        'Pending': { className: 'bg-yellow-100 text-yellow-800', label: 'Menunggu' },
        'In Progress': { className: 'bg-blue-100 text-blue-800', label: 'Bertugas' },
        'Completed': { className:'bg-green-100 text-green-800', label: 'Selesai' },
        'Izin': { className: 'bg-gray-100 text-gray-800', label: 'Izin' },
        'Sakit': { className: 'bg-orange-100 text-orange-800', label: 'Sakit' },
        'Tanpa Keterangan': { className: 'bg-red-100 text-red-800', label: 'Tanpa Keterangan' }
    } as const;

    const { className, label } = config[status] || { className: 'bg-gray-100 text-gray-800', label: status };
    return <Badge variant={'secondary'} className={className}>{label}</Badge>
  };
  
  const filteredSchedule = schedule.filter(item => {
    if (selectedDay === 'all') return true;
    const itemDayIndex = item.startDate instanceof Date ? item.startDate.getDay() : -1;
    const selectedDayIndex = daysOfWeek.indexOf(selectedDay);
    return itemDayIndex === selectedDayIndex;
  });

  const handleTimeInputChange = (e: React.ChangeEvent<HTMLInputElement>, field: any) => {
    const val = e.target.value;
    let formattedVal = val.replace(/[^0-9]/g, '');

    if (formattedVal.length > 2) {
      formattedVal = formattedVal.slice(0, 2) + ':' + formattedVal.slice(2, 4);
    }
    
    if (formattedVal.length > 5) {
      formattedVal = formattedVal.slice(0, 5);
    }
    
    field.onChange(formattedVal);
  };
  
  const calculatePunctuality = (schedule: ScheduleEntry) => {
    if (!schedule.patrolStartTime || !schedule.time) return null;

    const [startTimeStr] = schedule.time.split(' - ');
    const [startHour, startMinute] = startTimeStr.split(':').map(Number);

    const scheduleDate = schedule.startDate as Date;
    const expectedStartTime = new Date(scheduleDate);
    expectedStartTime.setHours(startHour, startMinute, 0, 0);

    const actualStartTime = schedule.patrolStartTime as Date;
    const diffMinutes = Math.round((actualStartTime.getTime() - expectedStartTime.getTime()) / 60000);

    if (diffMinutes === 0) {
      return { text: 'Tepat Waktu', color: 'text-green-600' };
    } else if (diffMinutes < 0) {
      return { text: `Lebih Cepat ${-diffMinutes} mnt`, color: 'text-green-600' };
    } else {
      return { text: `Terlambat ${diffMinutes} mnt`, color: 'text-red-600' };
    }
  };
  
  const formatDateRange = (startDate: Date, endDate: Date) => {
    const startStr = format(startDate, "d MMM", { locale: id });
    const endStr = format(endDate, "d MMM yyyy", { locale: id });
    if (format(startDate, 'yyyy-MM-dd') === format(endDate, 'yyyy-MM-dd')) {
        return format(startDate, "PPP", { locale: id });
    }
    return `${startStr} - ${endStr}`;
  };


  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <CardTitle>Manajemen Jadwal Patroli</CardTitle>
          <CardDescription>Buat, edit, atau hapus jadwal patroli petugas.</CardDescription>
        </div>
         <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <Select value={selectedDay} onValueChange={setSelectedDay}>
                <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder="Filter hari" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">Semua Hari</SelectItem>
                    <SelectItem value="senin">Senin</SelectItem>
                    <SelectItem value="selasa">Selasa</SelectItem>
                    <SelectItem value="rabu">Rabu</SelectItem>
                    <SelectItem value="kamis">Kamis</SelectItem>
                    <SelectItem value="jumat">Jumat</SelectItem>
                    <SelectItem value="sabtu">Sabtu</SelectItem>
                    <SelectItem value="minggu">Minggu</SelectItem>
                </SelectContent>
            </Select>
            <Button onClick={() => handleDialogOpen()} className="w-full sm:w-auto">
                <PlusCircle className="mr-2 h-4 w-4" />
                Buat Jadwal
            </Button>
         </div>
      </CardHeader>
      <CardContent>
         {/* Mobile View */}
        <div className="sm:hidden grid grid-cols-1 md:grid-cols-2 gap-4">
           {loading ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-48 w-full" />)
          ) : filteredSchedule.length > 0 ? (
            filteredSchedule.map((item) => {
              const punctuality = calculatePunctuality(item);
              const Icon = punctuality && (punctuality.text.includes('Cepat') || punctuality.text.includes('Tepat')) ? CheckCircle : AlertCircle;
              const isActionable = item.status === 'Pending' || item.status === 'In Progress';
              return (
              <Card key={item.id} className="flex flex-col">
                <CardHeader className="flex-grow">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-base flex items-center gap-2"><MapPin className="h-4 w-4" /> {item.area}</CardTitle>
                    <StatusBadge status={item.status} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm flex-grow">
                   <p className="flex items-center gap-2"><User className="h-4 w-4 text-muted-foreground" /> {item.officer}</p>
                   <p className="flex items-center gap-2"><CalendarIcon className="h-4 w-4 text-muted-foreground" /> {item.startDate instanceof Date && item.endDate instanceof Date ? formatDateRange(item.startDate, item.endDate) : 'N/A'}</p>
                   <p className="flex items-center gap-2"><Clock className="h-4 w-4 text-muted-foreground" /> {item.time}</p>
                   {punctuality && (
                     <div className={cn("flex items-center gap-1 text-xs", punctuality.color)}>
                        <Icon className="h-3 w-3"/>
                        <span>{punctuality.text}</span>
                     </div>
                   )}
                   {(item.status === 'Izin' || item.status === 'Sakit') && item.reason && (
                      <p className="flex items-start gap-2 pt-2 text-muted-foreground"><Info className="h-4 w-4 mt-0.5 shrink-0" /> <span className="text-foreground italic">"{item.reason}"</span></p>
                   )}
                </CardContent>
                <CardFooter>
                  <div className="flex gap-2 justify-end items-center w-full">
                      {isActionable && (
                        <Button asChild variant="outline" size="icon">
                          <Link href={`/admin/schedule/${item.id}`}><QrCode className="h-4 w-4" /></Link>
                        </Button>
                      )}
                      <Button variant="outline" size="icon" onClick={() => handleDialogOpen(item)}>
                          <Edit className="h-4 w-4" />
                      </Button>
                       <AlertDialog>
                          <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="icon"><Trash className="h-4 w-4" /></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                          <AlertDialogHeader>
                              <AlertDialogTitle>Anda yakin?</AlertDialogTitle>
                              <AlertDialogDescription>Tindakan ini akan menghapus jadwal secara permanen.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                              <AlertDialogCancel>Batal</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(item.id)}>Hapus</AlertDialogAction>
                          </AlertDialogFooter>
                          </AlertDialogContent>
                      </AlertDialog>
                  </div>
                </CardFooter>
              </Card>
            )})
           ) : (
            <div className="text-center py-12 text-muted-foreground col-span-full">Belum ada jadwal untuk hari yang dipilih.</div>
          )}
        </div>

        {/* Desktop View */}
        <div className="hidden sm:block">
          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Petugas</TableHead>
                  <TableHead>Area</TableHead>
                  <TableHead>Waktu</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Keterangan</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-10 w-[124px] ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : filteredSchedule.length > 0 ? (
                  filteredSchedule.map((item) => {
                    const punctuality = calculatePunctuality(item);
                    const Icon = punctuality && (punctuality.text.includes('Cepat') || punctuality.text.includes('Tepat')) ? CheckCircle : AlertCircle;
                    const isActionable = item.status === 'Pending' || item.status === 'In Progress';
                    return (
                    <TableRow key={item.id}>
                      <TableCell>{item.startDate instanceof Date && item.endDate instanceof Date ? formatDateRange(item.startDate, item.endDate) : 'N/A'}</TableCell>
                      <TableCell>{item.officer}</TableCell>
                      <TableCell>{item.area}</TableCell>
                      <TableCell>{item.time}</TableCell>
                      <TableCell><StatusBadge status={item.status} /></TableCell>
                      <TableCell>
                          {punctuality && (
                            <div className={cn("flex items-center gap-1 text-xs", punctuality.color)}>
                                <Icon className="h-3 w-3"/>
                                <span>{punctuality.text}</span>
                            </div>
                          )}
                          {(item.status === 'Izin' || item.status === 'Sakit') && item.reason && (
                              <p className="text-xs text-muted-foreground italic truncate" title={item.reason}>"{item.reason}"</p>
                          )}
                          {(!punctuality && item.status !== 'Izin' && item.status !== 'Sakit') && '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end items-center">
                            {isActionable && (
                              <Button asChild variant="outline" size="icon">
                                <Link href={`/admin/schedule/${item.id}`}><QrCode className="h-4 w-4" /></Link>
                              </Button>
                            )}
                            <Button variant="outline" size="icon" onClick={() => handleDialogOpen(item)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="destructive" size="icon"><Trash className="h-4 w-4" /></Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Anda yakin?</AlertDialogTitle>
                                  <AlertDialogDescription>Tindakan ini akan menghapus jadwal secara permanen.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Batal</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDelete(item.id)}>Hapus</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  )})
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center h-24">
                      Belum ada jadwal untuk hari yang dipilih.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <Drawer open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>{currentSchedule ? 'Edit' : 'Buat'} Jadwal</DrawerTitle>
              <DrawerDescription>
                Atur detail jadwal patroli untuk petugas.
              </DrawerDescription>
            </DrawerHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)}>
                <DrawerBody className="px-4">
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormField control={form.control} name="startDate" render={({ field }) => (
                            <FormItem className="flex flex-col"><FormLabel>Tanggal Mulai</FormLabel>
                                <Popover>
                                <PopoverTrigger asChild>
                                    <FormControl>
                                    <Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                        {field.value ? format(field.value, "PPP", { locale: id }) : <span>Pilih tanggal</span>}
                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                    </Button>
                                    </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar mode="single" selected={field.value} onSelect={field.onChange} disabled={(date) => date < startOfDay(new Date())} initialFocus locale={id} />
                                </PopoverContent>
                                </Popover>
                                <FormMessage />
                            </FormItem>
                        )} />
                         <FormField control={form.control} name="endDate" render={({ field }) => (
                            <FormItem className="flex flex-col"><FormLabel>Tanggal Selesai</FormLabel>
                                <Popover>
                                <PopoverTrigger asChild>
                                    <FormControl>
                                    <Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                        {field.value ? format(field.value, "PPP", { locale: id }) : <span>Pilih tanggal</span>}
                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                    </Button>
                                    </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar mode="single" selected={field.value} onSelect={field.onChange} disabled={(date) => date < startOfDay(new Date())} initialFocus locale={id} />
                                </PopoverContent>
                                </Popover>
                                <FormMessage />
                            </FormItem>
                        )} />
                    </div>
                    <FormField
                      control={form.control}
                      name="officerId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nama Petugas</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                            <FormControl>
                              <SelectTrigger disabled={!watchedStartDate}>
                                <SelectValue placeholder={!watchedStartDate ? "Pilih tanggal dulu" : "Pilih petugas"} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {availableStaff.map(s => (
                                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField control={form.control} name="area" render={({ field }) => (
                      <FormItem><FormLabel>Area Patroli</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <div className="grid grid-cols-2 gap-4">
                        <FormField control={form.control} name="startTime" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Jam Mulai</FormLabel>
                                <FormControl>
                                  <Input type="text" {...field} placeholder="HH:MM" onChange={(e) => handleTimeInputChange(e, field)} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="endTime" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Jam Selesai</FormLabel>
                                <FormControl>
                                    <Input type="text" {...field} placeholder="HH:MM" onChange={(e) => handleTimeInputChange(e, field)} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                    </div>
                  </div>
                </DrawerBody>
                <DrawerFooter>
                    <DrawerClose asChild><Button type="button" variant="secondary">Batal</Button></DrawerClose>
                    <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Simpan
                    </Button>
                </DrawerFooter>
              </form>
            </Form>
          </DrawerContent>
        </Drawer>
      </CardContent>
    </Card>
  );
}
