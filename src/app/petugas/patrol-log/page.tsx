
"use client";

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { db } from '@/lib/firebase/client';
import { collection, addDoc, serverTimestamp, query, where, onSnapshot, doc, updateDoc, writeBatch, orderBy, Timestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Send, Upload, Wrench, Check, ShieldCheck, ShieldOff } from 'lucide-react';
import type { PatrolLog, EquipmentStatus } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const logSchema = z.object({
  title: z.string().min(1, "Judul kejadian tidak boleh kosong."),
  description: z.string().min(10, "Deskripsi minimal 10 karakter."),
});
type LogFormValues = z.infer<typeof logSchema>;

const equipmentUpdateSchema = z.object({
    equipmentName: z.string().min(1, "Nama peralatan harus diisi."),
    status: z.enum(['good', 'broken', 'missing'], { required_error: "Status harus dipilih"}),
    notes: z.string().optional(),
});
type EquipmentUpdateFormValues = z.infer<typeof equipmentUpdateSchema>;


export default function PatrolLogPage() {
    const [logs, setLogs] = useState<PatrolLog[]>([]);
    const [loadingLogs, setLoadingLogs] = useState(true);
    const [isSubmittingLog, setIsSubmittingLog] = useState(false);
    const [isSubmittingEquipment, setIsSubmittingEquipment] = useState(false);
    const [staffInfo, setStaffInfo] = useState<{name: string, id: string} | null>(null);
    const { toast } = useToast();

    const logForm = useForm<LogFormValues>({
        resolver: zodResolver(logSchema),
        defaultValues: { title: '', description: '' },
    });
    
    const equipmentForm = useForm<EquipmentUpdateFormValues>({
        resolver: zodResolver(equipmentUpdateSchema),
        defaultValues: { notes: '', equipmentName: '' }
    });

    useEffect(() => {
        const info = JSON.parse(localStorage.getItem('staffInfo') || '{}');
        setStaffInfo(info);

        if (info.name) {
            // Fetch logs
            const logsQuery = query(
                collection(db, "patrol_logs"),
                where("officerName", "==", info.name)
            );
            const unsubLogs = onSnapshot(logsQuery, (snapshot) => {
                const logsData = snapshot.docs.map(d => ({ 
                    id: d.id, 
                    ...d.data(),
                    createdAt: (d.data().createdAt as Timestamp).toDate(),
                } as PatrolLog));
                
                // Sort client-side
                logsData.sort((a, b) => (b.createdAt as Date).getTime() - (a.createdAt as Date).getTime());

                setLogs(logsData);
                setLoadingLogs(false);
            });
            
            return () => unsubLogs();

        } else {
            setLoadingLogs(false);
        }
    }, []);

    const onLogSubmit = async (values: LogFormValues) => {
        if (!staffInfo) return;
        setIsSubmittingLog(true);
        try {
            await addDoc(collection(db, 'patrol_logs'), {
                ...values,
                officerName: staffInfo.name,
                officerId: staffInfo.id,
                createdAt: serverTimestamp()
            });
            toast({ title: 'Berhasil', description: 'Laporan patroli berhasil dikirim.' });
            logForm.reset();
        } catch (error) {
            toast({ variant: 'destructive', title: 'Gagal', description: 'Gagal mengirim laporan.' });
        } finally {
            setIsSubmittingLog(false);
        }
    };
    
    const onEquipmentSubmit = async (values: EquipmentUpdateFormValues) => {
        setIsSubmittingEquipment(true);
        try {
            await addDoc(collection(db, 'equipment_logs'), { 
                equipmentName: values.equipmentName,
                status: values.status,
                notes: values.notes || '',
                checkedAt: serverTimestamp(),
                checkedBy: staffInfo?.name || 'Unknown',
                officerId: staffInfo?.id || 'Unknown',
            });
            toast({ title: 'Berhasil', description: 'Status peralatan berhasil dilaporkan.' });
            equipmentForm.reset();
        } catch (error) {
             toast({ variant: 'destructive', title: 'Gagal', description: 'Gagal melaporkan status.' });
        } finally {
            setIsSubmittingEquipment(false);
        }
    };


  return (
    <div className="grid lg:grid-cols-2 gap-6 items-start">
        {/* Left Column: Forms */}
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Laporan Patroli</CardTitle>
                    <CardDescription>Catat kejadian atau temuan penting selama patroli.</CardDescription>
                </CardHeader>
                <Form {...logForm}>
                    <form onSubmit={logForm.handleSubmit(onLogSubmit)}>
                        <CardContent className="space-y-4">
                             <FormField control={logForm.control} name="title" render={({ field }) => (
                                <FormItem><FormLabel>Judul Kejadian</FormLabel><FormControl><Input {...field} placeholder="Contoh: Lampu jalan mati" /></FormControl><FormMessage /></FormItem>
                            )} />
                             <FormField control={logForm.control} name="description" render={({ field }) => (
                                <FormItem><FormLabel>Deskripsi</FormLabel><FormControl><Textarea {...field} rows={4} placeholder="Jelaskan detail kejadian..." /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormItem>
                                <FormLabel>Upload Foto</FormLabel>
                                <FormControl><Input type="file" disabled /></FormControl>
                                <FormMessage />
                                <p className="text-xs text-muted-foreground">Fitur upload foto akan segera tersedia.</p>
                            </FormItem>
                        </CardContent>
                        <CardFooter>
                            <Button type="submit" disabled={isSubmittingLog || !staffInfo} className="w-full">
                                {isSubmittingLog ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                                Kirim Laporan
                            </Button>
                        </CardFooter>
                    </form>
                </Form>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Perbarui Status Pos Ronda</CardTitle>
                    <CardDescription>Laporkan kondisi peralatan dan fasilitas di pos ronda.</CardDescription>
                </CardHeader>
                <Form {...equipmentForm}>
                    <form onSubmit={equipmentForm.handleSubmit(onEquipmentSubmit)}>
                        <CardContent className="space-y-4">
                            <FormField control={equipmentForm.control} name="equipmentName" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Nama Peralatan</FormLabel>
                                    <FormControl><Input {...field} placeholder="Contoh: Senter, Borgol, HT" /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={equipmentForm.control} name="status" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Status</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl><SelectTrigger><SelectValue placeholder="Pilih status..." /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            <SelectItem value="good">Baik</SelectItem>
                                            <SelectItem value="broken">Rusak</SelectItem>
                                            <SelectItem value="missing">Hilang</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={equipmentForm.control} name="notes" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Catatan (Opsional)</FormLabel>
                                    <FormControl><Textarea {...field} rows={2} placeholder="Contoh: Baterai lemah" /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </CardContent>
                        <CardFooter>
                             <Button type="submit" disabled={isSubmittingEquipment || !staffInfo} className="w-full">
                                {isSubmittingEquipment ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                                Perbarui Status
                            </Button>
                        </CardFooter>
                    </form>
                </Form>
            </Card>
        </div>

        {/* Right Column: History */}
        <Card>
            <CardHeader>
                <CardTitle>Riwayat Laporan Patroli Saya</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 max-h-[600px] overflow-y-auto">
                {loadingLogs ? (
                    Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)
                ) : logs.length > 0 ? (
                    logs.map(log => (
                        <div key={log.id} className="border-b pb-2">
                             <p className="text-sm text-muted-foreground">{format(log.createdAt as Date, "PPP, HH:mm", { locale: id })}</p>
                             <p className="font-semibold">{log.title}</p>
                             <p className="text-sm text-muted-foreground">{log.description}</p>
                        </div>
                    ))
                ) : (
                    <p className="text-center text-muted-foreground py-8">Belum ada laporan.</p>
                )}
            </CardContent>
        </Card>
    </div>
  );
}
