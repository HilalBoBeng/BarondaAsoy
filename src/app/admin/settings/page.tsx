
"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { app, db } from '@/lib/firebase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Loader2, User, Mail, Shield, Phone, MapPin, KeyRound, Camera, Pencil, Lock, LogOut } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { isBefore, subDays, addDays, formatDistanceToNow } from 'date-fns';
import { id } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { resetStaffAccessCode } from '@/ai/flows/reset-staff-access-code';

const adminProfileSchema = z.object({
  displayName: z.string().optional(),
  phone: z.string().optional(),
  addressDetail: z.string().optional(),
  photoURL: z.string().optional(),
});

const accessCodeSchema = z.object({
  currentAccessCode: z.string().min(1, "Kode akses saat ini harus diisi."),
});

type AdminProfileFormValues = z.infer<typeof adminProfileSchema>;
type AccessCodeFormValues = z.infer<typeof accessCodeSchema>;
type FieldName = keyof AdminProfileFormValues;

export default function AdminSettingsPage() {
    const [adminInfo, setAdminInfo] = useState<{ id: string, name: string; email: string, photoURL?: string, phone?: string, addressDetail?: string } | null>(null);
    const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);
    
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [editingField, setEditingField] = useState<FieldName | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<{ [key in FieldName]?: Date | null }>({});
    const fileInputRef = useRef<HTMLInputElement>(null);

    const router = useRouter();
    const { toast } = useToast();

    const profileForm = useForm<AdminProfileFormValues>();
    const accessCodeForm = useForm<AccessCodeFormValues>({ resolver: zodResolver(accessCodeSchema) });

    const canEditField = useCallback((field: FieldName) => {
        const lastUpdateDate = lastUpdated[field];
        if (!lastUpdateDate) return true;
        const cooldownDays = field === 'photoURL' ? 1 : 7;
        return isBefore(lastUpdateDate, subDays(new Date(), cooldownDays));
    }, [lastUpdated]);

    useEffect(() => {
        const info = JSON.parse(localStorage.getItem('staffInfo') || '{}');
        if (info.email) {
            setAdminInfo(info);
            profileForm.reset({
                displayName: info.name,
                phone: info.phone || '',
                addressDetail: info.addressDetail || '',
                photoURL: info.photoURL || '',
            });

             const lastUpdatedDates: { [key in FieldName]?: Date | null } = {};
            setLastUpdated(lastUpdatedDates);
        } else {
            // Handle case where admin is not logged in or info is missing
            router.push('/auth/staff-login');
        }
    }, [profileForm, router]);

    const handleEditClick = (field: FieldName) => {
        if (!canEditField(field)) {
            toast({ variant: 'destructive', title: 'Data Dikunci', description: `Anda baru bisa mengubah data ini lagi dalam beberapa waktu.` });
            return;
        }
        setEditingField(field);
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
        if (e.target.files && e.target.files[0]) {
             if (!canEditField('photoURL')) {
                toast({ variant: 'destructive', title: 'Foto Profil Dikunci', description: `Anda baru bisa mengubah foto profil lagi setelah 24 jam.` });
                return;
            }
            const file = e.target.files[0];
            if (file.size > 2 * 1024 * 1024) { 
                toast({ variant: "destructive", title: "Ukuran File Terlalu Besar", description: "Ukuran foto maksimal 2 MB." });
                return;
            }
            try {
                const compressedDataUrl = await compressImage(file, 64);
                profileForm.setValue('photoURL', compressedDataUrl);
                onProfileSubmit({ photoURL: compressedDataUrl });
            } catch(err) {
                 toast({ variant: "destructive", title: "Gagal Memproses Gambar", description: "Terjadi kesalahan saat memproses gambar Anda." });
            }
        }
    };

    const onProfileSubmit = async (data: Partial<AdminProfileFormValues>) => {
        if (!adminInfo) return;
        setIsSubmitting(true);
        const fieldToUpdate = editingField || 'photoURL';
        
        const updatedInfo = { ...adminInfo, ...data };

        localStorage.setItem('staffInfo', JSON.stringify(updatedInfo));
        setAdminInfo(updatedInfo);
        
        toast({ title: 'Berhasil', description: 'Profil berhasil diperbarui.' });

        setLastUpdated(prev => ({...prev, [fieldToUpdate]: new Date()}))
        setIsEditDialogOpen(false);
        setEditingField(null);
        setIsSubmitting(false);
    };

    const onAccessCodeSubmit = async (data: AccessCodeFormValues) => {
        if (!adminInfo?.id) {
            toast({ variant: 'destructive', title: "Gagal", description: "ID Admin tidak ditemukan. Silakan login ulang." });
            return;
        }

        setIsSubmittingPassword(true);
        try {
            const result = await resetStaffAccessCode({
                staffId: adminInfo.id,
                currentAccessCode: data.currentAccessCode,
            });

            if (result.success) {
                toast({ title: "Berhasil", description: result.message });
                accessCodeForm.reset();
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Terjadi kesalahan.";
            toast({ variant: 'destructive', title: "Gagal", description: errorMessage });
        } finally {
            setIsSubmittingPassword(false);
        }
    };

    
    if (!adminInfo) {
        return <div className="flex items-center justify-center h-full"><Loader2 className="animate-spin" /></div>;
    }
    
    const fieldLabels: Record<FieldName, string> = {
        displayName: "Nama Lengkap",
        phone: "Nomor HP / WhatsApp",
        addressDetail: "Alamat",
        photoURL: "Foto Profil"
    };

    const renderDataRow = (field: FieldName, value: string | undefined | null) => {
        const Icon = field === 'displayName' ? User : field === 'phone' ? Phone : MapPin;
        const canEdit = canEditField(field);
        const lastUpdateDate = lastUpdated[field];
        
        return (
             <div className="flex items-start justify-between gap-4 p-4 border-b last:border-b-0">
                <div className="flex items-center gap-4">
                    <Icon className="h-5 w-5 text-muted-foreground" />
                    <div className="flex-1">
                        <p className="text-xs text-muted-foreground">{fieldLabels[field]}</p>
                        <p className="font-medium">{value || 'Belum diisi'}</p>
                        {!canEdit && lastUpdateDate && (
                            <p className="text-xs text-muted-foreground italic mt-1">
                                Bisa diedit lagi {formatDistanceToNow(addDays(lastUpdateDate, 7), { addSuffix: true, locale: id })}
                            </p>
                        )}
                    </div>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={() => handleEditClick(field)} disabled={!canEdit}>
                    {canEdit ? <Pencil className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                </Button>
            </div>
        )
    };


    return (
        <div className="space-y-6">
            <Card>
                <CardHeader className="bg-gradient-to-br from-primary/80 to-primary p-6">
                     <div className="flex items-center gap-4">
                        <div className="relative">
                            <Avatar className="h-20 w-20 border-4 border-background/50">
                                <AvatarImage src={adminInfo.photoURL || ''} alt={adminInfo.name} />
                                <AvatarFallback className="text-3xl bg-background text-primary">
                                    {adminInfo.name.charAt(0).toUpperCase()}
                                </AvatarFallback>
                            </Avatar>
                            <Button size="icon" className="absolute -bottom-2 -right-2 h-7 w-7 rounded-full" onClick={() => handleEditClick("photoURL")}>
                                {canEditField("photoURL") ? <Camera className="h-4 w-4"/> : <Lock className="h-4 w-4"/>}
                            </Button>
                            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/png, image/jpeg, image/webp" className="hidden" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <CardTitle className="text-2xl font-bold text-primary-foreground truncate">{adminInfo.name}</CardTitle>
                            <CardDescription className="text-primary-foreground/80 truncate">{adminInfo.email}</CardDescription>
                            <Badge variant="secondary" className="mt-2">Administrator</Badge>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="divide-y">
                        {renderDataRow("phone", adminInfo.phone)}
                        {renderDataRow("addressDetail", adminInfo.addressDetail)}
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                     <CardTitle className="text-base flex items-center gap-2"><KeyRound className="h-5 w-5" /> Keamanan</CardTitle>
                     <CardDescription>Ubah kode akses Anda secara berkala untuk menjaga keamanan.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Form {...accessCodeForm}>
                        <form onSubmit={accessCodeForm.handleSubmit(onAccessCodeSubmit)} className="space-y-4">
                             <FormField
                                control={accessCodeForm.control}
                                name="currentAccessCode"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Kode Akses Saat Ini</FormLabel>
                                        <FormControl><Input type="password" {...field} placeholder="Masukkan kode akses Anda yang sekarang" /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <Button type="submit" disabled={isSubmittingPassword}>
                                {isSubmittingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Kirim Kode Akses Baru ke Email
                            </Button>
                        </form>
                    </Form>
                </CardContent>
            </Card>

            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit {editingField ? fieldLabels[editingField] : ''}</DialogTitle>
                    </DialogHeader>
                    <Form {...profileForm}>
                        <form onSubmit={profileForm.handleSubmit((data) => onProfileSubmit(data))} className="space-y-4">
                            {editingField && (
                               <FormField
                                    control={profileForm.control}
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
