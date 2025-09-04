
"use client";

import { useState, useEffect, useRef } from 'react';
import { db } from '@/lib/firebase/client';
import { collection, onSnapshot, query, orderBy, Timestamp } from 'firebase/firestore';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Printer, Loader2, FileText, Download } from 'lucide-react';
import type { ScheduleEntry } from '@/lib/types';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import jsPDF from 'jspdf';
import { Skeleton } from '@/components/ui/skeleton';

const letterSchema = z.object({
  scheduleId: z.string({ required_error: "Jadwal harus dipilih." }),
});

type LetterFormValues = z.infer<typeof letterSchema>;

export default function LettersPage() {
  const [schedules, setSchedules] = useState<ScheduleEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();
  const letterRef = useRef<HTMLDivElement>(null);

  const form = useForm<LetterFormValues>({
    resolver: zodResolver(letterSchema),
  });

  useEffect(() => {
    const q = query(collection(db, 'schedules'), orderBy('startDate', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            startDate: (doc.data().startDate as Timestamp).toDate(),
            endDate: (doc.data().endDate as Timestamp).toDate(),
        })) as ScheduleEntry[];
        setSchedules(data);
        setLoading(false);
    });
    return () => unsubscribe();
  }, []);
  
  const selectedSchedule = useMemo(() => {
    const scheduleId = form.watch('scheduleId');
    return schedules.find(s => s.id === scheduleId);
  }, [form.watch('scheduleId'), schedules]);

  const handleGeneratePdf = () => {
    if (!selectedSchedule || !letterRef.current) return;
    setIsGenerating(true);
    
    const doc = new jsPDF({
        orientation: 'p',
        unit: 'px',
        format: 'a4',
    });
    
    doc.html(letterRef.current, {
        callback: function(doc) {
            doc.save(`Surat_Tugas_${selectedSchedule.officer}_${format(selectedSchedule.startDate as Date, "dd-MM-yyyy")}.pdf`);
            setIsGenerating(false);
        },
        x: 15,
        y: 15,
        width: 170,
        windowWidth: 650
    });
  };

  const formatDateRange = (startDate: Date, endDate: Date) => {
    const startStr = format(startDate, "d MMMM yyyy", { locale: id });
    const endStr = format(endDate, "d MMMM yyyy", { locale: id });
    if (format(startDate, 'yyyy-MM-dd') === format(endDate, 'yyyy-MM-dd')) {
        return startStr;
    }
    return `${startStr} s.d. ${endStr}`;
  };

  return (
    <div className="grid lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-1 space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Generator Surat</CardTitle>
                    <CardDescription>Buat dokumen surat otomatis berdasarkan data yang ada.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Form {...form}>
                        <form className="space-y-4">
                            <FormField
                                control={form.control}
                                name="scheduleId"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Pilih Jadwal untuk Surat Tugas</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value} disabled={loading}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Pilih jadwal patroli..." />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {schedules.map(s => (
                                                <SelectItem key={s.id} value={s.id}>
                                                    {s.officer} - {format(s.startDate as Date, "d MMM yyyy")}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                        </form>
                    </Form>
                </CardContent>
            </Card>
        </div>
        <div className="lg:col-span-2">
            <Card>
                <CardHeader className="flex-row justify-between items-center">
                    <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5"/>Pratinjau Surat Tugas</CardTitle>
                    <Button onClick={handleGeneratePdf} disabled={!selectedSchedule || isGenerating}>
                        {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Download className="mr-2 h-4 w-4" />}
                        Unduh PDF
                    </Button>
                </CardHeader>
                <CardContent>
                    <div className="border rounded-lg p-8 bg-white text-black min-h-[500px]">
                        {!selectedSchedule ? (
                            <div className="flex items-center justify-center h-full text-muted-foreground">
                                Pilih jadwal untuk melihat pratinjau surat.
                            </div>
                        ) : (
                             <div ref={letterRef} className="prose prose-sm max-w-none">
                                <div style={{ textAlign: 'center', borderBottom: '2px solid black', paddingBottom: '10px', marginBottom: '20px' }}>
                                    <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>PEMERINTAH KELURAHAN KILONGAN</h2>
                                    <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold' }}>TIM KEAMANAN BARONDA</h3>
                                    <p style={{ margin: 0, fontSize: '10px' }}>Sekretariat: Jln. Raya Kilongan, Kec. Luwuk Utara, Kab. Banggai</p>
                                </div>
                                <h4 style={{ textDecoration: 'underline', textAlign: 'center', fontWeight: 'bold', fontSize: '14px', margin: '20px 0' }}>SURAT TUGAS</h4>
                                <p style={{ textAlign: 'center', fontSize: '12px', marginTop: '-15px' }}>Nomor: 001/ST-BRD/{format(new Date(), "MM/yyyy")}</p>
                                <div style={{ fontSize: '12px', marginTop: '30px', lineHeight: '1.6' }}>
                                    <p>Yang bertanda tangan di bawah ini selaku Koordinator Keamanan Baronda Kelurahan Kilongan, dengan ini menugaskan kepada:</p>
                                    <table style={{ border: 'none', marginLeft: '20px' }}>
                                        <tbody>
                                            <tr><td style={{ padding: '2px 10px 2px 0' }}>Nama</td><td>: {selectedSchedule.officer}</td></tr>
                                            <tr><td style={{ padding: '2px 10px 2px 0' }}>Jabatan</td><td>: Petugas Keamanan</td></tr>
                                        </tbody>
                                    </table>
                                    <p>Untuk melaksanakan tugas patroli keamanan (siskamling) di wilayah Kelurahan Kilongan, dengan jadwal sebagai berikut:</p>
                                    <table style={{ border: 'none', marginLeft: '20px' }}>
                                        <tbody>
                                            <tr><td style={{ padding: '2px 10px 2px 0' }}>Hari, Tanggal</td><td>: {format(selectedSchedule.startDate as Date, "EEEE", { locale: id })}, {formatDateRange(selectedSchedule.startDate as Date, selectedSchedule.endDate as Date)}</td></tr>
                                            <tr><td style={{ padding: '2px 10px 2px 0' }}>Waktu</td><td>: {selectedSchedule.time} WITA</td></tr>
                                            <tr><td style={{ padding: '2px 10px 2px 0' }}>Lokasi</td><td>: {selectedSchedule.area}</td></tr>
                                        </tbody>
                                    </table>
                                    <p>Demikian surat tugas ini dibuat untuk dapat dilaksanakan dengan sebaik-baiknya dan penuh tanggung jawab.</p>
                                </div>
                                 <div style={{ float: 'right', marginTop: '50px', textAlign: 'center', fontSize: '12px' }}>
                                    <p>Kilongan, {format(new Date(), "d MMMM yyyy", { locale: id })}</p>
                                    <p>Koordinator Keamanan,</p>
                                    <br/><br/><br/>
                                    <p style={{ textDecoration: 'underline', fontWeight: 'bold' }}>Bambang Sugiono</p>
                                </div>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    </div>
  );
}
