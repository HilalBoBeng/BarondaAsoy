
"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { doc, onSnapshot, updateDoc, Timestamp, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Loader2, User, Phone, MapPin, KeyRound, Camera, Pencil, Lock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { isBefore, subDays, addDays, formatDistanceToNow } from 'date-fns';
import { id } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { updateStaffAccessCode } from '@/ai/flows/update-staff-access-code';
import type { Staff } from '@/lib/types';

const profileEditSchema = z.object({
  displayName: z.string().min(1, "Nama tidak boleh kosong.").max(25, 'Nama tidak boleh lebih dari 25 karakter.'),
});

const accessCodeSchema = z.object({
  currentAccessCode: z.string().min(1, "Kode akses saat ini harus diisi."),
  newAccessCode: z.string().min(6, "Kode akses baru minimal 6 karakter."),
  confirmNewAccessCode: z.string(),
}).refine(data => data.newAccessCode === data.confirmNewAccessCode, {
    message: "Konfirmasi kode akses baru tidak cocok.",
    path: ["confirmNewAccessCode"],
});

type ProfileEditFormValues = z.infer<typeof profileEditSchema>;
type AccessCodeFormValues = z.infer<typeof accessCodeSchema>;
type FieldName = keyof Staff | 'accessCode';

export default function AdminProfilePage() {
    const [adminInfo, setAdminInfo] = useState<Staff | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<{ [key in FieldName]?: Date | null }>({});

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
        if (!adminInfo) return;
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
        if (!adminInfo?.id) return;
        setIsSubmitting(true);
        
        try {
            const result = await updateStaffAccessCode({
                staffId: adminInfo.id,
                currentAccessCode: data.currentAccessCode,
                newAccessCode: data.newAccessCode,
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
        return <div className="flex items-center justify-center h-full"><Loader2 className="animate-spin" /></div>;
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                     <div className="flex items-center gap-4">
                        <Avatar className="h-16 w-16">
                            <AvatarImage src={undefined} alt={adminInfo.name} />
                            <AvatarFallback className="text-2xl bg-primary text-primary-foreground">{adminInfo.name.charAt(0).toUpperCase()}</AvatarFallback>
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
                            <CardTitle className="text-base flex items-center gap-2"><KeyRound className="h-5 w-5" /> Keamanan</CardTitle>
                             <CardDescription>Ubah kode akses Anda secara berkala untuk menjaga keamanan.</CardDescription>
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
                                            <FormLabel>Kode Akses Saat Ini</FormLabel>
                                            <FormControl><Input readOnly value="••••••••" className="bg-muted" /></FormControl>
                                            {lastUpdated.accessCode && <p className="text-xs text-muted-foreground pt-2">Bisa diubah lagi {formatDistanceToNow(addDays(lastUpdated.accessCode, 7), { addSuffix: true, locale: id })}.</p>}
                                        </FormItem>
                                    )}
                                    <Button type="submit" disabled={isSubmitting || !canEditField('accessCode')}>
                                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Ganti Kode Akses
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
