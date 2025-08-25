
"use client";

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { db } from '@/lib/firebase/client';
import { collection, addDoc, serverTimestamp, query, where, onSnapshot, doc, updateDoc, getDocs, writeBatch } from 'firebase/firestore';
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

const logSchema = z.object({
  title: z.string().min(1, "Judul kejadian tidak boleh kosong."),
  description: z.string().min(10, "Deskripsi minimal 10 karakter."),
  // photo: z.instanceof(File).optional(), // File upload handling is complex for this demo
});
type LogFormValues = z.infer<typeof logSchema>;

const initialEquipment: EquipmentStatus[] = [
    { id: 'senter', name: 'Senter', status: 'good', lastChecked: new Date() },
    { id: 'borgol', name: 'Borgol', status: 'good', lastChecked: new Date() },
    { id: 'tongkat', name: 'Tongkat', status: 'good', lastChecked: new Date() },
];


export default function PatrolLogPage() {
    const [logs, setLogs] = useState<PatrolLog[]>([]);
    const [equipment, setEquipment] = useState<EquipmentStatus[]>(initialEquipment);
    const [loadingLogs, setLoadingLogs] = useState(true);
    const [loadingEquipment, setLoadingEquipment] = useState(true);
    const [isSubmittingLog, setIsSubmittingLog] = useState(false);
    const [petugasName, setPetugasName] = useState("Petugas A"); // Placeholder
    const { toast } = useToast();

    const logForm = useForm<LogFormValues>({
        resolver: zodResolver(logSchema),
        defaultValues: { title: '', description: '' },
    });

    useEffect(() => {
        // Fetch logs
        const logsQuery = query(collection(db, "patrol_logs"), where("officerName", "==", petugasName));
        const unsubLogs = onSnapshot(logsQuery, (snapshot) => {
            const logsData = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as PatrolLog))
                .sort((a, b) => (b.createdAt as any).toDate() - (a.createdAt as any).toDate());
            setLogs(logsData);
            setLoadingLogs(false);
        });

        // Fetch or initialize equipment status
        const equipmentRef = collection(db, 'equipment_status');
        const unsubEquipment = onSnapshot(equipmentRef, (snapshot) => {
            if (snapshot.empty) {
                // Initialize if not present
                const batch = writeBatch(db);
                initialEquipment.forEach(item => {
                    const docRef = doc(db, 'equipment_status', item.id);
                    batch.set(docRef, { ...item, lastChecked: serverTimestamp() });
                });
                batch.commit();
                setEquipment(initialEquipment);
            } else {
                const equipmentData = snapshot.docs.map(d => ({...d.data() as EquipmentStatus, id: d.id }));
                setEquipment(equipmentData);
            }
            setLoadingEquipment(false);
        });

        return () => {
            unsubLogs();
            unsubEquipment();
        };
    }, [petugasName]);

    const onLogSubmit = async (values: LogFormValues) => {
        setIsSubmittingLog(true);
        try {
            await addDoc(collection(db, 'patrol_logs'), {
                ...values,
                officerName: petugasName,
                officerId: 'petugas_1', // Placeholder
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
    
    const handleEquipmentStatusChange = async (id: string, status: EquipmentStatus['status']) => {
        const docRef = doc(db, 'equipment_status', id);
        await updateDoc(docRef, { status, lastChecked: serverTimestamp() });
        toast({title: 'Status Peralatan Diperbarui'});
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
                            <Button type="submit" disabled={isSubmittingLog} className="w-full">
                                {isSubmittingLog ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                                Kirim Laporan
                            </Button>
                        </CardFooter>
                    </form>
                </Form>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Status Pos Ronda</CardTitle>
                    <CardDescription>Periksa kondisi peralatan dan fasilitas di pos ronda.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                     {loadingEquipment ? (
                        Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)
                     ) : (
                        equipment.map(item => (
                            <div key={item.id} className="flex justify-between items-center p-2 border rounded-lg">
                                <p className="font-medium">{item.name}</p>
                                <div className="flex gap-1">
                                    <Button variant={item.status === 'good' ? 'default' : 'ghost'} size="icon" onClick={() => handleEquipmentStatusChange(item.id, 'good')}><ShieldCheck/></Button>
                                    <Button variant={item.status === 'broken' ? 'destructive' : 'ghost'} size="icon" onClick={() => handleEquipmentStatusChange(item.id, 'broken')}><Wrench/></Button>
                                    <Button variant={item.status === 'missing' ? 'destructive' : 'ghost'} size="icon" onClick={() => handleEquipmentStatusChange(item.id, 'missing')}><ShieldOff/></Button>
                                </div>
                            </div>
                        ))
                     )}
                     <Button className="w-full" variant="outline" disabled><Wrench className="mr-2 h-4 w-4" /> Laporkan Kerusakan Lain</Button>
                </CardContent>
            </Card>
        </div>

        {/* Right Column: History */}
        <Card>
            <CardHeader>
                <CardTitle>Riwayat Laporan Patroli</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 max-h-[600px] overflow-y-auto">
                {loadingLogs ? (
                    Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)
                ) : logs.length > 0 ? (
                    logs.map(log => (
                        <div key={log.id} className="border-b pb-2">
                             <p className="text-sm text-muted-foreground">{format((log.createdAt as any).toDate(), "PPP, HH:mm", { locale: id })}</p>
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
