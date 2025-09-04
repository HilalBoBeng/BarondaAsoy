
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { KeyRound, User, Phone, MapPin, Star, Lock, Pencil, Camera, Trash } from "lucide-react";
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
import { updateStaffAccessCode } from '@/ai/flows/update-staff-access-code';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription, DialogBody } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogHeader, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import Image from "next/image";
import { cn } from "@/lib/utils";

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

export default function PetugasProfilePage() {
    const [staffInfo, setStaffInfo] = useState<Staff | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isAccessCodeSubmitting, setIsAccessCodeSubmitting] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<{ [key in FieldName | 'accessCode']?: Date | null }>({});
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [editingField, setEditingField] = useState<FieldName | null>(null);
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const router = useRouter();
    const { toast } = useToast();

    const form = useForm<ProfileEditFormValues>({ resolver: zodResolver(profileEditSchema) });
    const accessCodeForm = useForm<AccessCodeFormValues>({ resolver: zodResolver(accessCodeSchema) });
    
    const canEditField = useCallback((field: FieldName | 'accessCode') => {
        const lastUpdateDate = lastUpdated[field];
        if (!lastUpdateDate) return true;
        const cooldownDays = field === 'photoURL' ? 1 : 7;
        return isBefore(lastUpdateDate, subDays(new Date(), cooldownDays));
    }, [lastUpdated]);

    useEffect(() => {
        const info = JSON.parse(localStorage.getItem('staffInfo') || '{}');
        if (info.id) {
            const unsub = onSnapshot(doc(db, "staff", info.id), (docSnap) => {
                if (docSnap.exists()) {
                    const staffData = { id: docSnap.id, ...docSnap.data() } as Staff;
                    setStaffInfo(staffData);
                    const newLastUpdated: { [key in FieldName | 'accessCode']?: Date | null } = {};
                    if(staffData.lastCodeChangeTimestamp) newLastUpdated.accessCode = (staffData.lastCodeChangeTimestamp as Timestamp).toDate();
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
        if (!staffInfo) return;

        if (field !== 'photoURL' && !canEditField(field)) {
            toast({ variant: 'destructive', title: 'Data Dikunci', description: `Anda baru bisa mengubah data ini lagi setelah 7 hari.` });
            return;
        }
        setEditingField(field);
        form.reset({
            displayName: staffInfo.name || '',
            phone: staffInfo.phone || '',
            addressDetail: staffInfo.addressDetail || '',
            photoURL: '',
        });
        if (field === 'photoURL') {
            fileInputRef.current?.click();
        } else {
            setIsEditDialogOpen(true);
        }
    };
    
    const onProfileEditSubmit = async (data: ProfileEditFormValues) => {
        if (!staffInfo || !editingField) return;
        setIsSubmitting(true);
        try {
            const staffRef = doc(db, 'staff', staffInfo.id);
            const valueToUpdate = data[editingField];
            
            const updateData: { [key: string]: any } = {};
            updateData[editingField === 'displayName' ? 'name' : editingField] = valueToUpdate;
            
            await updateDoc(staffRef, updateData);
            
            toast({ title: 'Berhasil', description: 'Profil berhasil diperbarui.' });
            
            const updatedStaffInfo = { ...staffInfo, [editingField === 'displayName' ? 'name' : editingField]: valueToUpdate };
            setStaffInfo(updatedStaffInfo);
            setLastUpdated(prev => ({ ...prev, [editingField!]: new Date() }));
            localStorage.setItem('staffInfo', JSON.stringify(updatedStaffInfo));

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
        if (!staffInfo?.id || !data.newAccessCode) return;
        setIsAccessCodeSubmitting(true);
        
        try {
            const result = await updateStaffAccessCode({
                staffId: staffInfo.id,
                currentAccessCode: data.currentAccessCode,
                newAccessCode: data.newAccessCode
            });

            if (result.success) {
                toast({ title: 'Berhasil', description: result.message });
                accessCodeForm.reset({ currentAccessCode: '', newAccessCode: '', confirmNewAccessCode: '' });
                setLastUpdated(prev => ({...prev, accessCode: new Date() }));
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            toast({ variant: 'destructive', title: 'Gagal', description: error instanceof Error ? error.message : "Gagal mengubah kode akses." });
        } finally {
            setIsAccessCodeSubmitting(false);
        }
    };

    if (!staffInfo) {
        return <div className="flex items-center justify-center h-full"><Loader2 className="animate-spin h-8 w-8" /></div>;
    }

    const fieldLabels: Record<FieldName, string> = {
        displayName: "Nama Lengkap",
        phone: "Nomor HP / WhatsApp",
        addressDetail: "Alamat",
        photoURL: "Foto Profil"
    };

    const dataRows = [
        { field: 'phone' as FieldName, value: staffInfo.phone, icon: Phone },
        { field: 'addressDetail' as FieldName, value: staffInfo.addressDetail, icon: MapPin },
        { field: 'points' as FieldName, value: `${staffInfo.points || 0} Poin`, icon: Star, noEdit: true },
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
                                    {staffInfo.name?.charAt(0).toUpperCase()}
                                </AvatarFallback>
                            </Avatar>
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <CardTitle className="text-2xl font-bold text-primary-foreground truncate">{staffInfo.name}</CardTitle>
                                <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0 text-primary-foreground/80 hover:text-primary-foreground hover:bg-white/20" onClick={() => handleEditClick("displayName")}>
                                    <Pencil className="h-4 w-4" />
                                </Button>
                            </div>
                            <CardDescription className="text-primary-foreground/80 truncate">{staffInfo.email}</CardDescription>
                            <Badge variant="secondary" className="mt-2">Petugas</Badge>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="divide-y">
                        {dataRows.map(row => (
                            <div key={row.field} className="flex items-start justify-between gap-4 p-4">
                                <div className="flex items-center gap-4">
                                    <row.icon className="h-5 w-5 text-muted-foreground" />
                                    <div className="flex-1">
                                        <p className="text-xs text-muted-foreground">{fieldLabels[row.field as Exclude<FieldName, 'photoURL'>] || 'Poin'}</p>
                                        <p className="font-medium">{row.value || 'Belum diisi'}</p>
                                    </div>
                                </div>
                                {!row.noEdit && (
                                    <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={() => handleEditClick(row.field as FieldName)}>
                                        <Pencil className="h-4 w-4" />
                                    </Button>
                                )}
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
                                    {lastUpdated.accessCode && <p className="text-xs text-muted-foreground pt-2">Bisa diubah lagi {formatDistanceToNow(addDays(lastUpdated.accessCode, 7), { addSuffix: true, locale: id })}.</p>}
                                </FormItem>
                            )}
                            <Button type="submit" disabled={isAccessCodeSubmitting || !canEditField('accessCode')}>
                                {isAccessCodeSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4"/>}
                                Ganti Kode Akses
                            </Button>
                        </form>
                    </Form>
                </CardContent>
            </Card>
            
            <Dialog open={isEditDialogOpen} onOpenChange={(isOpen) => { if (!isOpen) setEditingField(null); setIsEditDialogOpen(isOpen); }}>
                <DialogContent>
                    <DialogHeader className="text-left">
                        <DialogTitle>Edit {editingField ? fieldLabels[editingField] : ''}</DialogTitle>
                    </DialogHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onProfileEditSubmit)}>
                             <DialogBody className="space-y-4">
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
                            </DialogBody>
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
