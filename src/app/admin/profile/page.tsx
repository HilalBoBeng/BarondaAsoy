
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { KeyRound, User, Phone, MapPin, Lock, Pencil } from "lucide-react";
import { useState, useEffect, useCallback } from 'react';
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
import { doc, onSnapshot, Timestamp, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { isBefore, addDays, formatDistanceToNow } from 'date-fns';
import { id } from 'date-fns/locale';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { resetStaffAccessCode } from "@/ai/flows/reset-staff-access-code";

const profileEditSchema = z.object({
  displayName: z.string().min(1, "Nama tidak boleh kosong.").max(25, 'Nama tidak boleh lebih dari 25 karakter.'),
});

const accessCodeSchema = z.object({
  currentAccessCode: z.string().min(1, "Kode akses saat ini harus diisi."),
});

type ProfileEditFormValues = z.infer<typeof profileEditSchema>;
type AccessCodeFormValues = z.infer<typeof accessCodeSchema>;
type FieldName = 'name' | 'accessCode';


export default function AdminProfilePage() {
    const [adminInfo, setAdminInfo] = useState<Staff | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<{ [key in FieldName]?: Date | null }>({});
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const router = useRouter();
    const { toast } = useToast();

    const profileEditForm = useForm<ProfileEditFormValues>({ resolver: zodResolver(profileEditSchema) });
    const accessCodeForm = useForm<AccessCodeFormValues>({ resolver: zodResolver(accessCodeSchema) });
    
    const canEditField = useCallback((field: FieldName) => {
        const lastUpdateDate = lastUpdated[field];
        if (!lastUpdateDate) return true;
        const cooldownDays = 7;
        return isBefore(lastUpdateDate, subDays(new Date(), cooldownDays));
    }, [lastUpdated]);

    useEffect(() => {
        const info = JSON.parse(localStorage.getItem('staffInfo') || '{}');
        if (info.id) {
            const unsub = onSnapshot(doc(db, "staff", info.id), (docSnap) => {
                if (docSnap.exists()) {
                    const staffData = { id: docSnap.id, ...docSnap.data() } as Staff;
                    setAdminInfo(staffData);
                     if (staffData.lastCodeChangeTimestamp) {
                        setLastUpdated(prev => ({...prev, accessCode: (staffData.lastCodeChangeTimestamp as Timestamp).toDate()}));
                     }
                } else {
                     router.push('/auth/staff-login');
                }
            });
            return () => unsub();
        } else {
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
        }
    }, [router]);
    
    const handleEditNameClick = () => {
        if (!adminInfo) return;
        profileEditForm.reset({ displayName: adminInfo.name });
        setIsEditDialogOpen(true);
    };
    
    const onProfileEditSubmit = async (data: ProfileEditFormValues) => {
        if (!adminInfo || adminInfo.id === 'admin_utama') {
            toast({ variant: 'destructive', title: 'Aksi Ditolak', description: 'Admin utama tidak dapat diubah.' });
            return;
        }
        setIsSubmitting(true);
        try {
            const staffRef = doc(db, 'staff', adminInfo.id);
            await updateDoc(staffRef, { name: data.displayName });
            toast({ title: 'Berhasil', description: 'Nama berhasil diperbarui.' });
            setIsEditDialogOpen(false);
        } catch (error) {
             toast({ variant: 'destructive', title: 'Gagal', description: 'Gagal memperbarui nama.' });
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
            toast({ variant: 'destructive', title: 'Aksi Ditolak', description: 'Kode akses admin utama tidak dapat diubah.' });
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
                accessCodeForm.reset();
                setLastUpdated(prev => ({ ...prev, accessCode: new Date() }));
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

    return (
        <div className="space-y-6">
        <Card>
            <CardHeader>
                <div className="flex items-center gap-4">
                    <Avatar className="h-16 w-16">
                        <AvatarImage src={undefined} />
                        <AvatarFallback className="text-2xl bg-primary text-primary-foreground">{adminInfo.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div>
                        <div className="flex items-center gap-2">
                           <h2 className="text-xl font-bold">{adminInfo.name}</h2>
                           <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleEditNameClick}><Pencil className="h-4 w-4" /></Button>
                        </div>
                        <p className="text-sm text-muted-foreground">{adminInfo.email}</p>
                        <Badge variant="secondary" className="mt-2">Administrator</Badge>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Informasi Akun</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                        <div className="flex items-center gap-3">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span>{adminInfo.name}</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <Phone className="h-4 w-4 text-muted-foreground" />
                            <span>{adminInfo.phone}</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            <span>{adminInfo.addressDetail}</span>
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
                                {canEditField('accessCode') ? (
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
                                        {lastUpdated.accessCode && <p className="text-xs text-muted-foreground pt-2">Bisa diubah lagi {formatDistanceToNow(addDays(lastUpdated.accessCode, 7), { addSuffix: true, locale: id })}.</p>}
                                    </FormItem>
                                )}

                                <Button type="submit" disabled={isSubmitting || !canEditField('accessCode')}>
                                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Kirim Kode Akses Baru
                                </Button>
                            </form>
                         </Form>
                    </CardContent>
                </Card>
            </CardContent>
        </Card>
        
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Edit Nama Lengkap</DialogTitle>
                </DialogHeader>
                <Form {...profileEditForm}>
                    <form onSubmit={profileEditForm.handleSubmit(onProfileEditSubmit)} className="space-y-4">
                       <FormField
                            control={profileEditForm.control}
                            name="displayName"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>Nama Lengkap</FormLabel>
                                <FormControl><Input {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
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
