
"use client";

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { db } from '@/lib/firebase/client';
import { collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, serverTimestamp, query, orderBy, Timestamp, getDocs } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Edit, Trash, Loader2, Calendar as CalendarIcon, MapPin, User, Clock } from 'lucide-react';
import type { ScheduleEntry } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';

interface Staff {
  id: string;
  name: string;
}

const scheduleSchema = z.object({
  officer: z.string().min(1, "Nama petugas harus dipilih."),
  area: z.string().min(1, "Area tidak boleh kosong."),
  date: z.date({ required_error: "Tanggal patroli harus diisi." }),
  time: z.string().min(1, "Waktu patroli tidak boleh kosong.").regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]\s?-\s?([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Format waktu salah. Contoh: 20:00 - 22:00"),
  status: z.enum(['Pending', 'In Progress', 'Completed']),
});

type ScheduleFormValues = z.infer<typeof scheduleSchema>;

export default function ScheduleAdminPage() {
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentSchedule, setCurrentSchedule] = useState<ScheduleEntry | null>(null);
  const { toast } = useToast();

  const form = useForm<ScheduleFormValues>({
    resolver: zodResolver(scheduleSchema),
    defaultValues: {
      officer: '',
      area: '',
      time: '',
      status: 'Pending',
    },
  });
  
  useEffect(() => {
    const fetchStaff = async () => {
      const staffQuery = query(collection(db, "staff"), orderBy("name"));
      const staffSnapshot = await getDocs(staffQuery);
      const staffData = staffSnapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name })) as Staff[];
      setStaff(staffData);
    };
    fetchStaff();

    const q = query(collection(db, 'schedules'), orderBy('date', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const scheduleData: ScheduleEntry[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date?.toDate(),
      })) as ScheduleEntry[];
      setSchedule(scheduleData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching schedules:", error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);
  
  useEffect(() => {
    if (isDialogOpen) {
      if (currentSchedule) {
        form.reset({
          ...currentSchedule,
          date: currentSchedule.date instanceof Timestamp ? currentSchedule.date.toDate() : (currentSchedule.date as Date),
        });
      } else {
        form.reset({ officer: '', area: '', time: '', status: 'Pending', date: undefined });
      }
    }
  }, [isDialogOpen, currentSchedule, form]);

  const handleDialogOpen = (schedule: ScheduleEntry | null = null) => {
    setCurrentSchedule(schedule);
    setIsDialogOpen(true);
  };

  const onSubmit = async (values: ScheduleFormValues) => {
    setIsSubmitting(true);
    try {
      const dataToSave = {
        ...values,
        date: Timestamp.fromDate(values.date)
      };

      if (currentSchedule) {
        const docRef = doc(db, 'schedules', currentSchedule.id);
        await updateDoc(docRef, dataToSave);
        toast({ title: "Berhasil", description: "Jadwal berhasil diperbarui." });
      } else {
        await addDoc(collection(db, 'schedules'), dataToSave);
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

  const renderActions = (item: ScheduleEntry) => (
    <div className="flex gap-2 justify-end">
      <Button variant="outline" size="sm" onClick={() => handleDialogOpen(item)}>
        <Edit className="h-4 w-4" />
      </Button>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" size="sm"><Trash className="h-4 w-4" /></Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Anda yakin?</AlertDialogTitle>
            <AlertDialogDescription>Tindakan ini tidak dapat dibatalkan.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleDelete(item.id)}>Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );

  const StatusBadge = ({ status }: { status: ScheduleEntry['status'] }) => (
     <Badge variant={status === 'Completed' ? 'secondary' : status === 'In Progress' ? 'default' : 'outline'}>{status}</Badge>
  );

  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <CardTitle>Manajemen Jadwal Patroli</CardTitle>
          <CardDescription>Buat, edit, atau hapus jadwal patroli petugas.</CardDescription>
        </div>
        <Button onClick={() => handleDialogOpen()}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Buat Jadwal
        </Button>
      </CardHeader>
      <CardContent>
         {/* Mobile View */}
        <div className="sm:hidden space-y-4">
           {loading ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40 w-full" />)
          ) : schedule.length > 0 ? (
            schedule.map((item) => (
              <Card key={item.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-base flex items-center gap-2"><User className="h-4 w-4" /> {item.officer}</CardTitle>
                    <StatusBadge status={item.status} />
                  </div>
                  <CardDescription className="flex items-center gap-2 pt-1"><MapPin className="h-4 w-4" />{item.area}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                   <p className="flex items-center gap-2"><CalendarIcon className="h-4 w-4 text-muted-foreground" /> {item.date instanceof Date ? format(item.date, "PPP", { locale: id }) : 'N/A'}</p>
                   <p className="flex items-center gap-2"><Clock className="h-4 w-4 text-muted-foreground" /> {item.time}</p>
                </CardContent>
                <CardFooter>
                   {renderActions(item)}
                </CardFooter>
              </Card>
            ))
           ) : (
            <div className="text-center py-12 text-muted-foreground">Belum ada jadwal.</div>
          )}
        </div>

        {/* Desktop View */}
        <div className="hidden sm:block rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tanggal</TableHead>
                <TableHead>Waktu</TableHead>
                <TableHead>Petugas</TableHead>
                <TableHead>Area</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right w-[100px]">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-28" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-8 w-[88px] ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : schedule.length > 0 ? (
                schedule.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.date instanceof Date ? format(item.date, "PPP", { locale: id }) : 'N/A'}</TableCell>
                    <TableCell>{item.time}</TableCell>
                    <TableCell>{item.officer}</TableCell>
                    <TableCell>{item.area}</TableCell>
                    <TableCell><StatusBadge status={item.status} /></TableCell>
                    <TableCell className="text-right">
                     {renderActions(item)}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center h-24">
                    Belum ada jadwal.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-lg w-[90%] rounded-lg">
            <DialogHeader>
              <DialogTitle>{currentSchedule ? 'Edit' : 'Buat'} Jadwal</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="officer"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nama Petugas</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Pilih petugas" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {staff.map(s => (
                            <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
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
                <FormField control={form.control} name="date" render={({ field }) => (
                  <FormItem className="flex flex-col"><FormLabel>Tanggal</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                            {field.value ? format(field.value, "PPP", { locale: id }) : <span>Pilih tanggal</span>}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={field.value} onSelect={field.onChange} disabled={(date) => date < new Date("1900-01-01")} initialFocus locale={id} />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="time" render={({ field }) => (
                  <FormItem><FormLabel>Waktu</FormLabel><FormControl><Input placeholder="20:00 - 22:00" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="status" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Pilih status" /></SelectTrigger></FormControl>
                            <SelectContent>
                                <SelectItem value="Pending">Tertunda</SelectItem>
                                <SelectItem value="In Progress">Berlangsung</SelectItem>
                                <SelectItem value="Completed">Selesai</SelectItem>
                            </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                )} />
                <DialogFooter>
                    <DialogClose asChild><Button type="button" variant="secondary">Batal</Button></DialogClose>
                    <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Simpan
                    </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
