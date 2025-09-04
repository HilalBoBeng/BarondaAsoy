
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { KeyRound, User, Phone, MapPin, Lock, Pencil, Camera, Trash } from "lucide-react";
import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { Staff } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { doc, onSnapshot, Timestamp, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { isBefore, addDays, formatDistanceToNow, subDays } from 'date-fns';
import { id } from 'date-fns/locale';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { resetStaffAccessCode } from "@/ai/flows/reset-staff-access-code";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogHeader, AlertDialogTrigger } from "@/components/ui/alert-dialog";

const profileEditSchema = z.object({
  displayName: z.string().optional(),
  phone: z.string().optional(),
  addressDetail: z.string().optional(),
  photoURL: z.string().optional(),
});
const accessCodeSchema = z.object({
  currentAccessCode: z.string().min(1, "Kode akses saat ini harus diisi."),
});

type ProfileEditFormValues = z.infer<typeof profileEditSchema>;
type AccessCodeFormValues = z.infer<typeof accessCodeSchema>;
type FieldName = 'displayName' | 'phone' | 'addressDetail' | 'photoURL';

export default function AdminProfilePage() {
    const [adminInfo, setAdminInfo] = useState<Staff | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<{ [key in FieldName]?: Date | null }>({});
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [editingField, setEditingField] = useState<FieldName | null>(null);
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const router = useRouter();
    const { toast } = useToast();

    const form = useForm<ProfileEditFormValues>({ resolver: zodResolver(profileEditSchema) });
    const accessCodeForm = useForm<AccessCodeFormValues>({ resolver: zodResolver(accessCodeSchema) });
    
    const canEditField = useCallback((field: FieldName) => {
        const lastUpdateDate = lastUpdated[field];
        if (!lastUpdateDate) return true;
        const cooldownDays = field === 'photoURL' ? 1 : 7;
        return isBefore(lastUpdateDate, subDays(new Date(), cooldownDays));
    }, [lastUpdated]);

    useEffect(() => {
        const info = JSON.parse(localStorage.getItem('staffInfo') || '{}');
        if (info.email === 'admin@baronda.app' && info.name === 'Admin Utama') {
            const mainAdminInfo = {
                id: 'admin_utama',
                name: 'Admin Utama',
                email: 'admin@baronda.app',
                status: 'active',
                phone: 'N/A',
                addressDetail: 'Kantor Pusat Baronda',
                accessCode: 'Admin123',
            } as Staff;
             setAdminInfo(mainAdminInfo);
        } else if (info.id) {
            const unsub = onSnapshot(doc(db, "staff", info.id), (docSnap) => {
                if (docSnap.exists()) {
                    const staffData = { id: docSnap.id, ...docSnap.data() } as Staff;
                    setAdminInfo(staffData);
                    const newLastUpdated: { [key in FieldName]?: Date | null } = {};
                    if(staffData.lastCodeChangeTimestamp) {
                        newLastUpdated.displayName = (staffData.lastCodeChangeTimestamp as Timestamp).toDate(); // Assuming name and code changed together
                    }
                    setLastUpdated(newLastUpdated);
                } else {
                     router.push('/auth/staff-login');
                }
            });
            return () => unsub();
        } else {
             router.push('/auth/staff-login');
        }
    }, [router]);
    
    const handleEditClick = (field: FieldName) => {
        if (!adminInfo) return;
        if (adminInfo.id === 'admin_utama' && field !== 'currentAccessCode') {
            toast({ variant: 'destructive', title: 'Aksi Ditolak', description: 'Profil Admin Utama tidak dapat diubah.' });
            return;
        }

        if (field !== 'photoURL' && !canEditField(field)) {
            toast({ variant: 'destructive', title: 'Data Dikunci', description: `Anda baru bisa mengubah data ini lagi setelah 7 hari.` });
            return;
        }
        setEditingField(field);
        form.reset({
            displayName: adminInfo.name || '',
            phone: adminInfo.phone || '',
            addressDetail: adminInfo.addressDetail || '',
            photoURL: '',
        });
        if (field === 'photoURL') {
            fileInputRef.current?.click();
        } else {
            setIsEditDialogOpen(true);
        }
    };
    
    const compressImage = (file: File, maxSizeKB: number): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = document.createElement('img');
                img.src = event.target?.result as string;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let { width, height } = img;
                    
                    const size = Math.min(width, height);
                    const x = (width - size) / 2;
                    const y = (height - size) / 2;

                    canvas.width = size;
                    canvas.height = size;
                    const ctx = canvas.getContext('2d');
                    ctx?.drawImage(img, x, y, size, size, 0, 0, size, size);

                    let quality = 0.9;
                    let dataUrl = canvas.toDataURL('image/jpeg', quality);
                    const getKB = (str: string) => new Blob([str]).size / 1024;
                    
                    while (getKB(dataUrl) > maxSizeKB && quality > 0.1) {
                        quality -= 0.1;
                        dataUrl = canvas.toDataURL('image/jpeg', quality);
                    }
                    resolve(dataUrl);
                };
                img.onerror = reject;
            };
            reader.onerror = reject;
        });
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!canEditField('photoURL')) {
            toast({ variant: 'destructive', title: 'Foto Profil Dikunci', description: `Anda baru bisa mengubah foto profil lagi setelah 24 jam.` });
            return;
        }
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            if (file.size > 2 * 1024 * 1024) { 
                toast({ variant: "destructive", title: "Ukuran File Terlalu Besar", description: "Ukuran foto maksimal 2 MB." });
                return;
            }
            try {
                const compressedDataUrl = await compressImage(file, 64);
                form.setValue('photoURL', compressedDataUrl);
                setEditingField('photoURL');
                setIsEditDialogOpen(true);
            } catch(err) {
                 toast({ variant: "destructive", title: "Gagal Memproses Gambar", description: "Terjadi kesalahan saat memproses gambar Anda." });
            }
        }
    };
    
    const onProfileEditSubmit = async (data: ProfileEditFormValues) => {
        if (!adminInfo || !editingField) return;
        setIsSubmitting(true);
        try {
            const staffRef = doc(db, 'staff', adminInfo.id);
            const valueToUpdate = data[editingField];
            
            const updateData: { [key: string]: any } = {};
            updateData[editingField === 'displayName' ? 'name' : editingField] = valueToUpdate;
            updateData[`lastUpdated_${editingField}`] = serverTimestamp();
            
            await updateDoc(staffRef, updateData);
            
            toast({ title: 'Berhasil', description: 'Profil berhasil diperbarui.' });
            
            const updatedAdminInfo = { ...adminInfo, [editingField === 'displayName' ? 'name' : editingField]: valueToUpdate };
            setAdminInfo(updatedAdminInfo);
            setLastUpdated(prev => ({ ...prev, [editingField]: new Date() }));
            localStorage.setItem('staffInfo', JSON.stringify(updatedAdminInfo));

            setIsEditDialogOpen(false);
            setEditingField(null);
        } catch (error) {
            console.error("Profile update error:", error);
            toast({ variant: 'destructive', title: 'Gagal', description: 'Gagal memperbarui profil.' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const onAccessCodeSubmit = async (data: AccessCodeFormValues) => {
        if (!adminInfo?.id || !adminInfo.email) {
            toast({ variant: 'destructive', title: 'Gagal', description: 'Informasi admin tidak lengkap untuk aksi ini.' });
            return;
        };
        if (adminInfo.id === 'admin_utama') {
            toast({ variant: 'destructive', title: 'Aksi Ditolak', description: 'Kode akses Admin Utama tidak dapat diubah.' });
            return;
        }
        setIsSubmitting(true);
        
        try {
            const result = await resetStaffAccessCode({
                staffId: adminInfo.id,
                currentAccessCode: data.currentAccessCode,
            });

            if (result.success) {
                toast({ title: 'Berhasil', description: result.message });
                accessCodeForm.reset({currentAccessCode: ''});
                setLastUpdated(prev => ({ ...prev, displayName: new Date() })); // Using displayName as a proxy for any cooldown
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            toast({ variant: 'destructive', title: 'Gagal', description: error instanceof Error ? error.message : "Gagal mengubah kode akses." });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!adminInfo) {
        return <div className="flex items-center justify-center h-full"><Loader2 className="animate-spin h-8 w-8" /></div>;
    }
    
    const fieldLabels: Record<FieldName, string> = {
        displayName: "Nama Lengkap",
        phone: "Nomor HP / WhatsApp",
        addressDetail: "Alamat",
        photoURL: "Foto Profil"
    };

    const dataRows = [
        { field: 'phone' as FieldName, value: adminInfo.phone },
        { field: 'addressDetail' as FieldName, value: adminInfo.addressDetail },
    ];


    return (
        <div className="space-y-6">
            <Card className="overflow-hidden">
                <CardHeader className="bg-gradient-to-br from-primary/80 to-primary p-6">
                    <div className="flex items-center gap-4">
                        <div className="relative">
                            <Avatar className="h-20 w-20 border-4 border-background/50">
                                <AvatarImage src={undefined} />
                                <AvatarFallback className="text-3xl bg-background text-primary">
                                    {adminInfo.name?.charAt(0).toUpperCase()}
                                </AvatarFallback>
                            </Avatar>
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                    <CardTitle className="text-2xl font-bold text-primary-foreground truncate">{adminInfo.name}</CardTitle>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0 text-primary-foreground/80 hover:text-primary-foreground hover:bg-white/20" onClick={() => handleEditClick("displayName")}>
                                        <Pencil className="h-4 w-4" />
                                    </Button>
                            </div>
                            <CardDescription className="text-primary-foreground/80 truncate">{adminInfo.email}</CardDescription>
                            <Badge variant="secondary" className="mt-2">Administrator</Badge>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="divide-y">
                        {dataRows.map(row => (
                            <div key={row.field} className="flex items-start justify-between gap-4 p-4">
                                <div className="flex items-center gap-4">
                                    {row.field === 'phone' && <Phone className="h-5 w-5 text-muted-foreground" />}
                                    {row.field === 'addressDetail' && <MapPin className="h-5 w-5 text-muted-foreground" />}
                                    <div className="flex-1">
                                        <p className="text-xs text-muted-foreground">{fieldLabels[row.field]}</p>
                                        <p className="font-medium">{row.value || 'Belum diisi'}</p>
                                    </div>
                                </div>
                                <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={() => handleEditClick(row.field)}>
                                    <Pencil className="h-4 w-4" />
                                </Button>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Ubah Kode Akses</CardTitle>
                    <CardDescription>Jika Anda merasa kode akses Anda tidak aman, Anda dapat mengubahnya di sini. Kode akses baru akan dikirimkan ke email Anda.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Form {...accessCodeForm}>
                        <form onSubmit={accessCodeForm.handleSubmit(onAccessCodeSubmit)} className="space-y-4">
                            {canEditField('displayName') ? ( // Using displayName as a proxy for cooldown
                                <FormField control={accessCodeForm.control} name="currentAccessCode" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Kode Akses Saat Ini</FormLabel>
                                        <FormControl><Input type="password" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                            ) : (
                                <FormItem>
                                    <FormLabel>Kode Akses Saat Ini</FormLabel>
                                    <FormControl><Input readOnly value="••••••••" className="bg-muted" /></FormControl>
                                    {lastUpdated.displayName && <p className="text-xs text-muted-foreground pt-2">Bisa diubah lagi {formatDistanceToNow(addDays(lastUpdated.displayName, 7), { addSuffix: true, locale: id })}.</p>}
                                </FormItem>
                            )}

                            <Button type="submit" disabled={isSubmitting || !canEditField('displayName')}>
                                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4"/>}
                                Kirim Kode Akses Baru
                            </Button>
                        </form>
                    </Form>
                </CardContent>
            </Card>

            <Dialog open={isEditDialogOpen} onOpenChange={(isOpen) => { if (!isOpen) setEditingField(null); setIsEditDialogOpen(isOpen); }}>
                <DialogContent className="rounded-lg">
                    <DialogHeader>
                        <DialogTitle>Edit {editingField ? fieldLabels[editingField] : ''}</DialogTitle>
                    </DialogHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onProfileEditSubmit)} className="space-y-4 pt-4">
                            {editingField && (
                            <FormField
                                control={form.control}
                                name={editingField}
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{fieldLabels[editingField]}</FormLabel>
                                    <FormControl><Input {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                            )}
                            <DialogFooter>
                                <Button type="button" variant="secondary" onClick={() => setIsEditDialogOpen(false)}>Batal</Button>
                                <Button type="submit" disabled={isSubmitting}>
                                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Simpan
                                </Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
