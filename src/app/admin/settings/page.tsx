
"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { getAuth, signOut, reauthenticateWithCredential, EmailAuthProvider, updatePassword } from 'firebase/auth';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { app, db } from '@/lib/firebase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Loader2, User, Mail, Shield, Phone, MapPin, KeyRound, Camera, Pencil, Lock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { isBefore, subDays, addDays, formatDistanceToNow } from 'date-fns';
import { id } from 'date-fns/locale';

const adminProfileSchema = z.object({
  displayName: z.string().min(1, 'Nama tidak boleh kosong.'),
  phone: z.string().min(1, 'Nomor HP tidak boleh kosong.'),
  addressDetail: z.string().min(1, 'Alamat tidak boleh kosong.'),
  photoURL: z.string().optional(),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Kata sandi saat ini harus diisi."),
  newPassword: z.string().min(8, "Kata sandi baru minimal 8 karakter."),
  confirmNewPassword: z.string(),
}).refine(data => data.newPassword === data.confirmNewPassword, {
    message: "Konfirmasi kata sandi baru tidak cocok.",
    path: ["confirmNewPassword"],
});

type AdminProfileFormValues = z.infer<typeof adminProfileSchema>;
type PasswordFormValues = z.infer<typeof passwordSchema>;
type FieldName = keyof AdminProfileFormValues;

export default function AdminSettingsPage() {
    const [adminInfo, setAdminInfo] = useState<{ name: string; email: string, photoURL?: string, phone?: string, addressDetail?: string } | null>(null);
    const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
    const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);
    
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [editingField, setEditingField] = useState<FieldName | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<{ [key in FieldName]?: Date | null }>({});
    const fileInputRef = useRef<HTMLInputElement>(null);

    const router = useRouter();
    const { toast } = useToast();

    const profileForm = useForm<AdminProfileFormValues>();
    const passwordForm = useForm<PasswordFormValues>({ resolver: zodResolver(passwordSchema) });

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
            // You might need to fetch these from a 'admins' collection if you want to persist them
            setLastUpdated(lastUpdatedDates);
        }
    }, [profileForm]);

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
                onProfileSubmit({ photoURL: compressedDataUrl }); // Directly submit photo
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

        // Note: This only updates localStorage. For persistent admin profiles,
        // you would save this to a dedicated 'admins' collection in Firestore.
        localStorage.setItem('staffInfo', JSON.stringify(updatedInfo));
        setAdminInfo(updatedInfo);
        
        toast({ title: 'Berhasil', description: 'Profil berhasil diperbarui.' });

        setLastUpdated(prev => ({...prev, [fieldToUpdate]: new Date()}))
        setIsEditDialogOpen(false);
        setEditingField(null);
        setIsSubmitting(false);
    };

    const onPasswordSubmit = async (data: PasswordFormValues) => {
        if (!adminInfo?.email) return;
        // This is a placeholder as admin auth isn't fully implemented with Firebase Auth
        toast({ title: "Fitur Dalam Pengembangan", description: "Ubah kata sandi admin akan tersedia di versi mendatang." });
    };
    
    if (!adminInfo) {
        return <Loader2 className="animate-spin" />;
    }

    const renderDataRow = (field: FieldName, value: string | undefined | null) => {
        const Icon = field === 'displayName' ? User : field === 'phone' ? Phone : MapPin;
        const canEdit = canEditField(field);
        const cooldownDays = field === 'photoURL' ? 1 : 7;
        const lastUpdateDate = lastUpdated[field];
        
        return (
             <div className="flex items-start justify-between gap-4 p-4 border-b last:border-b-0">
                <div className="flex items-center gap-4">
                    <Icon className="h-5 w-5 text-muted-foreground" />
                    <div className="flex-1">
                        <p className="text-xs text-muted-foreground">{field === 'displayName' ? 'Nama Lengkap' : field === 'phone' ? 'Nomor HP' : 'Alamat'}</p>
                        <p className="font-medium">{value || 'Belum diisi'}</p>
                        {!canEdit && lastUpdateDate && (
                            <p className="text-xs text-muted-foreground italic mt-1">
                                Bisa diedit lagi {formatDistanceToNow(addDays(lastUpdateDate, cooldownDays), { addSuffix: true, locale: id })}
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
                </CardHeader>
                <CardContent>
                     <div className="flex items-center justify-between p-3 border rounded-lg">
                        <p className="text-sm font-medium">Ubah Kata Sandi</p>
                        <Button variant="outline" onClick={() => setIsPasswordDialogOpen(true)}>Ubah</Button>
                     </div>
                </CardContent>
            </Card>

            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit {editingField === 'displayName' ? 'Nama' : editingField === 'phone' ? 'Nomor HP' : 'Alamat'}</DialogTitle>
                    </DialogHeader>
                    <Form {...profileForm}>
                        <form onSubmit={profileForm.handleSubmit((data) => onProfileSubmit(data))} className="space-y-4">
                            <FormField
                                control={profileForm.control}
                                name={editingField!}
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{editingField === 'displayName' ? 'Nama Baru' : editingField === 'phone' ? 'Nomor HP Baru' : 'Alamat Baru'}</FormLabel>
                                    <FormControl><Input {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
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
            
            <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Ubah Kata Sandi Admin</DialogTitle>
                    </DialogHeader>
                    <Form {...passwordForm}>
                        <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
                             <FormField
                                control={passwordForm.control}
                                name="currentPassword"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Kata Sandi Saat Ini</FormLabel>
                                        <FormControl><Input type="password" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={passwordForm.control}
                                name="newPassword"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Kata Sandi Baru</FormLabel>
                                        <FormControl><Input type="password" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={passwordForm.control}
                                name="confirmNewPassword"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Konfirmasi Kata Sandi Baru</FormLabel>
                                        <FormControl><Input type="password" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <DialogFooter>
                                <DialogClose asChild><Button type="button" variant="secondary">Batal</Button></DialogClose>
                                <Button type="submit" disabled={isSubmittingPassword}>
                                    {isSubmittingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
