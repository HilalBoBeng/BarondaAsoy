
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { KeyRound, User, Phone, MapPin, Star, Lock, Pencil } from "lucide-react";
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
import { updateStaffAccessCode } from '@/ai/flows/update-staff-access-code';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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
type FieldName = 'name' | 'accessCode';

export default function PetugasProfilePage() {
    const [staffInfo, setStaffInfo] = useState<Staff | null>(null);
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
                    setStaffInfo(staffData);
                    const newLastUpdated: { [key in FieldName]?: Date | null } = {};
                    if(staffData.lastCodeChangeTimestamp) {
                        newLastUpdated.accessCode = (staffData.lastCodeChangeTimestamp as Timestamp).toDate();
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
    
    const handleEditNameClick = () => {
        if (!staffInfo) return;
        profileEditForm.reset({ displayName: staffInfo.name });
        setIsEditDialogOpen(true);
    };

    const onProfileEditSubmit = async (data: ProfileEditFormValues) => {
        if (!staffInfo) return;
        setIsSubmitting(true);
        try {
            const staffRef = doc(db, 'staff', staffInfo.id);
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
        if (!staffInfo?.id) return;
        setIsSubmitting(true);
        
        try {
            const result = await updateStaffAccessCode({
                staffId: staffInfo.id,
                currentAccessCode: data.currentAccessCode,
                newAccessCode: data.newAccessCode
            });

            if (result.success) {
                toast({ title: 'Berhasil', description: result.message });
                accessCodeForm.reset();
                setLastUpdated(prev => ({...prev, accessCode: new Date() }));
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            toast({ variant: 'destructive', title: 'Gagal', description: error instanceof Error ? error.message : "Gagal mengubah kode akses." });
        } finally {
            setIsSubmitting(false);
        }
    };


    if (!staffInfo) {
        return <div className="flex items-center justify-center h-full"><Loader2 className="animate-spin h-8 w-8" /></div>;
    }

    return (
        <div className="space-y-6">
        <Card>
            <CardHeader>
                <div className="flex items-center gap-4">
                    <Avatar className="h-16 w-16">
                        <AvatarImage src={undefined} />
                        <AvatarFallback className="text-2xl bg-primary text-primary-foreground">{staffInfo.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div>
                        <div className="flex items-center gap-2">
                           <h2 className="text-xl font-bold">{staffInfo.name}</h2>
                           <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleEditNameClick}><Pencil className="h-4 w-4" /></Button>
                        </div>
                        <p className="text-sm text-muted-foreground">{staffInfo.email}</p>
                        <Badge variant="secondary" className="mt-2">Petugas</Badge>
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
                            <span>{staffInfo.name}</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <Phone className="h-4 w-4 text-muted-foreground" />
                            <span>{staffInfo.phone}</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            <span>{staffInfo.addressDetail}</span>
                        </div>
                         <div className="flex items-center gap-3">
                            <Star className="h-4 w-4 text-muted-foreground" />
                            <span>{staffInfo.points || 0} Poin</span>
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
