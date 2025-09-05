
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { KeyRound, User, Phone, MapPin, Lock, Pencil, Camera, Trash, LogOut } from "lucide-react";
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
import { Drawer, DrawerContent, DrawerFooter, DrawerHeader, DrawerTitle, DrawerDescription, DrawerBody, DrawerClose } from "@/components/ui/drawer";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { updateStaffAccessCode } from '@/ai/flows/update-staff-access-code';
import Image from "next/image";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";


const profileEditSchema = z.object({
  displayName: z.string().optional(),
  phone: z.string().optional(),
  addressDetail: z.string().optional(),
  photoURL: z.string().optional(),
});

const accessCodeSchema = z.object({
  currentAccessCode: z.string().min(1, "Kode akses saat ini harus diisi."),
  newAccessCode: z.string().min(6, "Kode akses baru minimal 6 karakter.").optional(),
  confirmNewAccessCode: z.string().optional(),
}).refine(data => {
    if (data.newAccessCode) {
        return data.newAccessCode === data.confirmNewAccessCode;
    }
    return true;
}, {
    message: "Konfirmasi kode akses baru tidak cocok.",
    path: ["confirmNewAccessCode"],
});


type ProfileEditFormValues = z.infer<typeof profileEditSchema>;
type AccessCodeFormValues = z.infer<typeof accessCodeSchema>;
type FieldName = 'displayName' | 'phone' | 'addressDetail' | 'photoURL';

export default function AdminProfilePage() {
    const [adminInfo, setAdminInfo] = useState<Staff | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isAccessCodeSubmitting, setIsAccessCodeSubmitting] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [editingField, setEditingField] = useState<FieldName | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isZoomModalOpen, setIsZoomModalOpen] = useState(false);
    const [zoomedImageUrl, setZoomedImageUrl] = useState('');

    const router = useRouter();
    const { toast } = useToast();

    const form = useForm<ProfileEditFormValues>({ 
        resolver: zodResolver(profileEditSchema),
        defaultValues: {
            displayName: '',
            phone: '',
            addressDetail: '',
            photoURL: ''
        }
    });
    const accessCodeForm = useForm<AccessCodeFormValues>({ resolver: zodResolver(accessCodeSchema) });
    
    const canEditField = useCallback((field: FieldName | 'accessCode') => {
        if (!adminInfo) return false;
        
        let lastUpdateTimestamp: Timestamp | undefined | null = null;
        if (field === 'accessCode') {
            lastUpdateTimestamp = adminInfo.lastCodeChangeTimestamp;
        } else if (field === 'phone') {
            lastUpdateTimestamp = adminInfo.lastUpdated_phone;
        } else if (field === 'addressDetail') {
            lastUpdateTimestamp = adminInfo.lastUpdated_addressDetail;
        }

        if (!lastUpdateTimestamp) return true;
        const lastUpdateDate = lastUpdateTimestamp.toDate();
        const cooldownDays = field === 'photoURL' ? 1 : 7;
        return isBefore(lastUpdateDate, subDays(new Date(), cooldownDays));
    }, [adminInfo]);

    useEffect(() => {
        const info = JSON.parse(localStorage.getItem('staffInfo') || '{}');
        if (info.id) {
            const unsub = onSnapshot(doc(db, "staff", info.id), (docSnap) => {
                if (docSnap.exists()) {
                    const staffData = { id: docSnap.id, ...docSnap.data() } as Staff;
                    setAdminInfo(staffData);
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
        if (!canEditField(field)) {
             toast({ variant: 'destructive', title: 'Data Dikunci', description: `Anda baru bisa mengubah data ini lagi nanti.` });
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
            const fieldKey = editingField === 'displayName' ? 'name' : editingField;
            updateData[fieldKey] = valueToUpdate;
            updateData[`lastUpdated_${fieldKey}`] = serverTimestamp();
            
            await updateDoc(staffRef, updateData);
            
            toast({ title: 'Berhasil', description: 'Profil berhasil diperbarui.' });
            
            const updatedAdminInfo = { ...adminInfo, [fieldKey]: valueToUpdate };
            setAdminInfo(updatedAdminInfo);
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

    const handleLogout = () => {
        localStorage.removeItem('userRole');
        localStorage.removeItem('staffInfo');
        router.push('/auth/staff-login');
    }

    const onAccessCodeSubmit = async (data: AccessCodeFormValues) => {
        if (!adminInfo?.id || !data.newAccessCode) return;
        setIsAccessCodeSubmitting(true);
        
        try {
            const result = await updateStaffAccessCode({
                staffId: adminInfo.id,
                currentAccessCode: data.currentAccessCode,
                newAccessCode: data.newAccessCode
            });

            if (result.success) {
                toast({ title: 'Berhasil', description: "Kode akses diubah. Silakan masuk kembali." });
                accessCodeForm.reset({ currentAccessCode: '', newAccessCode: '', confirmNewAccessCode: '' });
                setTimeout(handleLogout, 2000);
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            toast({ variant: 'destructive', title: 'Gagal', description: error instanceof Error ? error.message : "Gagal mengubah kode akses." });
        } finally {
            setIsAccessCodeSubmitting(false);
        }
    };

    if (!adminInfo) {
        return (
            <div className="space-y-6">
                <Card className="overflow-hidden">
                    <CardHeader className="bg-muted p-6">
                         <div className="flex items-center gap-4">
                            <Skeleton className="h-20 w-20 rounded-full" />
                            <div className="flex-1 space-y-2">
                                <Skeleton className="h-7 w-48" />
                                <Skeleton className="h-4 w-64" />
                                <Skeleton className="h-5 w-24" />
                            </div>
                         </div>
                    </CardHeader>
                    <CardContent className="p-0">
                         <div className="divide-y">
                            {Array.from({length: 2}).map((_, i) => (
                                 <div key={i} className="flex items-start justify-between gap-4 p-4">
                                     <div className="flex-1 space-y-2">
                                         <Skeleton className="h-3 w-20" />
                                         <Skeleton className="h-5 w-40" />
                                     </div>
                                     <Skeleton className="h-8 w-8" />
                                 </div>
                            ))}
                         </div>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader>
                        <Skeleton className="h-5 w-32" />
                        <Skeleton className="h-4 w-48" />
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-10 w-full" /></div>
                        <div className="space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-10 w-full" /></div>
                        <div className="space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-10 w-full" /></div>
                        <Skeleton className="h-10 w-36" />
                    </CardContent>
                </Card>
            </div>
        );
    }
    
    const fieldLabels: Record<FieldName, string> = {
        displayName: "Nama Lengkap",
        phone: "Nomor HP / WhatsApp",
        addressDetail: "Alamat",
        photoURL: "Foto Profil"
    };
    
    const handleImageZoom = (url?: string | null) => {
        if (url) {
            setZoomedImageUrl(url);
            setIsZoomModalOpen(true);
        }
    };
    
    const roleDisplayMap: Record<string, string> = {
      admin: 'Administrator',
      bendahara: 'Bendahara',
      petugas: 'Petugas'
    };

    const dataRows = [
        { field: 'phone' as FieldName, value: adminInfo.phone },
        { field: 'addressDetail' as FieldName, value: adminInfo.addressDetail },
    ];

    return (
        <div className="space-y-6">
            <h1 className="text-xl font-bold">Profil Saya</h1>
            <Card className="overflow-hidden">
                <CardHeader className="bg-gradient-to-br from-primary/80 to-primary p-6">
                    <div className="flex items-center gap-4">
                        <div className="relative">
                             <button onClick={() => handleImageZoom(adminInfo.photoURL)}>
                                <Avatar className="h-20 w-20 border-4 border-background/50">
                                    <AvatarImage src={adminInfo.photoURL || undefined} alt={adminInfo.name} />
                                    <AvatarFallback className="text-3xl bg-background text-primary">
                                        {adminInfo.name?.charAt(0).toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>
                             </button>
                             <Button size="icon" className="absolute -bottom-2 -right-2 h-7 w-7 rounded-full" onClick={() => handleEditClick("photoURL")}>
                                {canEditField("photoURL") ? <Camera className="h-4 w-4"/> : <Lock className="h-4 w-4"/>}
                            </Button>
                            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/png, image/jpeg, image/webp" className="hidden" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <CardTitle className="text-2xl font-bold text-primary-foreground truncate">{adminInfo.name}</CardTitle>
                                 <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0 text-primary-foreground/80 hover:text-primary-foreground hover:bg-white/20" onClick={() => handleEditClick("displayName")}>
                                    {canEditField("displayName") ? <Pencil className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                                </Button>
                            </div>
                            <CardDescription className="text-primary-foreground/80 truncate">{adminInfo.email}</CardDescription>
                            <Badge variant="secondary" className={cn(
                                "mt-2 w-fit", 
                                adminInfo.role === 'admin' ? "bg-primary/80 text-primary-foreground hover:bg-primary/90" : 
                                "bg-indigo-500 text-white hover:bg-indigo-600"
                                )}>
                              {roleDisplayMap[adminInfo.role || 'petugas'] || 'Staf'}
                            </Badge>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="divide-y">
                        {dataRows.map(row => (
                            <div key={row.field} className="flex items-start justify-between gap-4 p-4">
                                <div className="flex-1">
                                    <p className="text-xs text-muted-foreground">{fieldLabels[row.field]}</p>
                                    <p className="font-medium">{row.value || 'Belum diisi'}</p>
                                </div>
                                <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={() => handleEditClick(row.field)}>
                                     {canEditField(row.field) ? <Pencil className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                                </Button>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Ubah Kode Akses</CardTitle>
                    <CardDescription>Jika Anda merasa kode akses Anda tidak aman, Anda dapat mengubahnya di sini.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Form {...accessCodeForm}>
                        <form onSubmit={accessCodeForm.handleSubmit(onAccessCodeSubmit)} className="space-y-4">
                            {canEditField('accessCode') ? (
                                <>
                                    <FormField control={accessCodeForm.control} name="currentAccessCode" render={({ field }) => (
                                        <FormItem><FormLabel>Kode Akses Saat Ini</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem>
                                    )} />
                                    <FormField control={accessCodeForm.control} name="newAccessCode" render={({ field }) => (
                                        <FormItem><FormLabel>Kode Akses Baru</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem>
                                    )} />
                                    <FormField control={accessCodeForm.control} name="confirmNewAccessCode" render={({ field }) => (
                                        <FormItem><FormLabel>Konfirmasi Kode Akses Baru</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem>
                                    )} />
                                </>
                            ) : (
                                <FormItem>
                                    <FormLabel>Kode Akses</FormLabel>
                                    <FormControl><Input readOnly value="••••••••" className="bg-muted" /></FormControl>
                                    {adminInfo.lastCodeChangeTimestamp && <p className="text-xs text-muted-foreground pt-2">Bisa diubah lagi {formatDistanceToNow(addDays((adminInfo.lastCodeChangeTimestamp as Timestamp).toDate(), 7), { addSuffix: true, locale: id })}.</p>}
                                </FormItem>
                            )}

                            <Button type="submit" disabled={isAccessCodeSubmitting || !canEditField('accessCode') || !accessCodeForm.formState.isValid}>
                                {isAccessCodeSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4"/>}
                                Ganti Kode Akses
                            </Button>
                        </form>
                    </Form>
                </CardContent>
            </Card>

             <Card>
                <CardHeader>
                    <CardTitle className="text-base text-destructive">Keluar</CardTitle>
                </CardHeader>
                <CardContent>
                     <Button variant="destructive" className="w-full" onClick={handleLogout}>
                        <LogOut className="mr-2 h-4 w-4" /> Keluar dari Akun
                    </Button>
                </CardContent>
            </Card>


            <Drawer open={isEditDialogOpen} onOpenChange={(isOpen) => { if (!isOpen) setEditingField(null); setIsEditDialogOpen(isOpen); }}>
                <DrawerContent>
                    <DrawerHeader>
                        <DrawerTitle>Edit {editingField ? fieldLabels[editingField] : ''}</DrawerTitle>
                    </DrawerHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onProfileEditSubmit)}>
                            <DrawerBody className="px-4">
                               {editingField && editingField !== 'photoURL' && (
                                <FormField
                                    control={form.control}
                                    name={editingField}
                                    render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{fieldLabels[editingField]}</FormLabel>
                                        <FormControl><Input {...field} inputMode={editingField === 'phone' ? 'numeric' : 'text'} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                    )}
                                />
                                )}
                                {editingField === 'photoURL' && form.getValues('photoURL') && (
                                    <div className="flex justify-center">
                                         <Avatar className="h-32 w-32 mt-2">
                                            <AvatarImage src={form.getValues('photoURL') || ''} alt="Preview" />
                                            <AvatarFallback>
                                                <Loader2 className="animate-spin" />
                                            </AvatarFallback>
                                        </Avatar>
                                    </div>
                                )}
                            </DrawerBody>
                            <DrawerFooter className="flex-col sm:flex-row sm:justify-between pt-4">
                               <div></div>
                               <div className="flex gap-2 justify-end">
                                    <DrawerClose asChild>
                                      <Button type="button" variant="secondary">Batal</Button>
                                    </DrawerClose>
                                    <Button type="submit" disabled={isSubmitting || !form.formState.isValid}>
                                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Simpan
                                    </Button>
                               </div>
                            </DrawerFooter>
                        </form>
                    </Form>
                </DrawerContent>
            </Drawer>

            <Dialog open={isZoomModalOpen} onOpenChange={setIsZoomModalOpen}>
                <DialogContent className="p-0 border-0 bg-transparent shadow-none max-w-lg w-full">
                    <DialogTitle className="sr-only">Foto Profil Diperbesar</DialogTitle>
                    <img src={zoomedImageUrl} alt="Zoomed profile" className="w-full h-auto rounded-lg" />
                </DialogContent>
            </Dialog>
        </div>
    );
}
